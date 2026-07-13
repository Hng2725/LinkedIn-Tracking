/**
 * MCP JSON-RPC method handlers for the relay demo app.
 * UI is delivered fully inline via resources/read — no external URL references.
 * In production: reads built assets from dist/ui/ and embeds them in HTML.
 * In development: reads source and builds on-the-fly via Vite.
 */
import fs from 'fs';
import path from 'path';
// @ts-ignore
import { parseLinkedInHtml } from '../parse-linkedin.js';
import { getCachedData, triggerCrawl } from './background-crawl';

import _pkg from '../package.json';
const pkg = _pkg as Record<string, any>;
const TOOL_NAME = 'hr_management_dashboard';
const UI_RESOURCE_URI = 'ui://demo-hr-management/form.html';

/** Read icon as data URI from package.json icon path */
function getIconDataUri(): string | undefined {
	const iconPath = pkg.icon?.startsWith('/') ? path.join(__dirname, '..', pkg.icon) : undefined;
	if (!iconPath || !fs.existsSync(iconPath)) return undefined;
	const ext = path.extname(iconPath).slice(1);
	const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
	const data = fs.readFileSync(iconPath).toString('base64');
	return `data:${mime};base64,${data}`;
}
const appIcon = getIconDataUri();
type EngagementPost = {
	id?: string;
	date?: string;
	summary?: string;
	views?: number;
	reacts?: number;
	comments?: number;
	reposts?: number;
	link?: string;
};

type EngagementAccountData = {
	label: string;
	posts: EngagementPost[];
};

function sumPosts(posts: EngagementPost[]) {
	const totals = posts.reduce<{ views: number; reacts: number; comments: number; reposts: number }>((acc, post) => {
		acc.views += Number(post.views) || 0;
		acc.reacts += Number(post.reacts) || 0;
		acc.comments += Number(post.comments) || 0;
		acc.reposts += Number(post.reposts) || 0;
		return acc;
	}, { views: 0, reacts: 0, comments: 0, reposts: 0 });
	const interactions = totals.reacts + totals.comments + totals.reposts;
	return {
		posts: posts.length,
		...totals,
		interactions,
		avgViews: posts.length ? Math.round(totals.views / posts.length) : 0,
		avgInteractions: posts.length ? Number((interactions / posts.length).toFixed(1)) : 0,
		engagementRate: totals.views > 0 ? Number(((interactions / totals.views) * 100).toFixed(2)) : 0,
	};
}

function buildEngagementPrompt(args: any): string {
	const question = String(args?.question || '').trim() || 'Analyze LinkedIn engagement and give recommendations.';
	const accountId = args?.accountId || 'all';
	const accounts = (args?.accounts || {}) as Record<string, EngagementAccountData>;
	const lines: string[] = [];

	lines.push('You are the PrivOS AI social media performance analyst.');
	lines.push('Analyze the real LinkedIn tracking data below. Answer in the same language as the user question.');
	lines.push('Focus on engagement quality, comparison, likely causes, and concrete next actions.');
	lines.push('Do not invent missing metrics. If data is missing, say so clearly.');
	lines.push('');
	lines.push(`User question: ${question}`);
	lines.push(`Selected account: ${accountId}`);
	lines.push('');
	lines.push('Dataset summary:');

	Object.entries(accounts).forEach(([id, account]) => {
		const posts = Array.isArray(account?.posts) ? account.posts : [];
		const summary = sumPosts(posts);
		lines.push(`\nAccount ${id} (${account?.label || id})`);
		lines.push(`Totals: posts=${summary.posts}, views=${summary.views}, reacts=${summary.reacts}, comments=${summary.comments}, reposts=${summary.reposts}, interactions=${summary.interactions}, avgViews=${summary.avgViews}, avgInteractions=${summary.avgInteractions}, engagementRate=${summary.engagementRate}%`);
		const topPosts = [...posts]
			.sort((a, b) => ((Number(b.reacts) || 0) + (Number(b.comments) || 0) + (Number(b.reposts) || 0)) - ((Number(a.reacts) || 0) + (Number(a.comments) || 0) + (Number(a.reposts) || 0)))
			.slice(0, 8);
		topPosts.forEach((post, index) => {
			lines.push(`${index + 1}. ${post.date || 'unknown date'} | views=${Number(post.views) || 0}, reacts=${Number(post.reacts) || 0}, comments=${Number(post.comments) || 0}, reposts=${Number(post.reposts) || 0} | ${String(post.summary || '').slice(0, 280)}`);
		});
	});

	lines.push('\nRequired response format:');
	lines.push('1. Short direct answer to the user question.');
	lines.push('2. Comparison between PrivOS and Merve when relevant.');
	lines.push('3. Key observations from posts/comments/reacts/reposts/views.');
	lines.push('4. Practical recommendations and next content actions.');
	return lines.join('\n');
}

async function getPrivosAccessToken(): Promise<string> {
	const privosUrl = process.env.PRIVOS_URL;
	const clientId = process.env.CLIENT_ID;
	const clientSecret = process.env.CLIENT_SECRET;
	if (!privosUrl || !clientId || !clientSecret) throw new Error('Missing PrivOS OAuth credentials');
	const res = await fetch(`${privosUrl}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
	});
	if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${res.statusText}`);
	const data: any = await res.json();
	if (!data.access_token) throw new Error('No access_token in OAuth response');
	return data.access_token;
}

function extractSandboxText(data: any): string {
	if (!data) return '';
	if (typeof data.text === 'string') return data.text;
	if (typeof data.result === 'string') return data.result;
	if (typeof data.message === 'string' && data.status !== 'running') return data.message;
	if (Array.isArray(data.json)) {
		const parts: string[] = [];
		data.json.forEach((event: any) => {
			if (typeof event?.text === 'string') parts.push(event.text);
			if (typeof event?.content === 'string') parts.push(event.content);
			if (typeof event?.result === 'string') parts.push(event.result);
		});
		return parts.join('\n').trim();
	}
	if (data.body) return extractSandboxText(data.body);
	return '';
}

async function startPrivosSandboxAI(roomId: string, prompt: string): Promise<{ attemptId?: string; answer?: string }> {
	const privosUrl = process.env.PRIVOS_URL;
	if (!privosUrl) throw new Error('Missing PRIVOS_URL');
	const token = await getPrivosAccessToken();
	const startRes = await fetch(`${privosUrl}/api/v1/agents.sandbox.generate-async`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ roomId, prompt }),
	});
	if (!startRes.ok) throw new Error(`Sandbox generate failed: ${startRes.status} ${startRes.statusText}`);
	const startData: any = await startRes.json();
	const attemptId = startData?.attemptId || startData?.body?.attemptId || startData?.id;
	if (attemptId) return { attemptId };
	const answer = extractSandboxText(startData);
	if (answer) return { answer };
	throw new Error('Sandbox generate response did not include attemptId');
}

async function pollPrivosSandboxAI(roomId: string, attemptId: string): Promise<{ status: string; answer?: string }> {
	const privosUrl = process.env.PRIVOS_URL;
	if (!privosUrl) throw new Error('Missing PRIVOS_URL');
	const token = await getPrivosAccessToken();
	const pollUrl = `${privosUrl}/api/v1/agents.sandbox.attempt-status?roomId=${encodeURIComponent(roomId)}&attemptId=${encodeURIComponent(attemptId)}&partial=1`;
	const pollRes = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
	if (!pollRes.ok) throw new Error(`Sandbox poll failed: ${pollRes.status} ${pollRes.statusText}`);
	const pollData: any = await pollRes.json();
	const status = pollData?.status || pollData?.body?.status || 'running';
	const answer = extractSandboxText(pollData);
	if (status === 'failed' || status === 'cancelled') throw new Error(`Sandbox attempt ${status}`);
	if (status === 'completed' || status === 'complete' || pollData?.completed) return { status: 'completed', answer };
	return { status: 'running', answer };
}


async function pollLinkedInEngagementAnalysis(args: any) {
	const roomId = args?.roomId;
	const attemptId = args?.attemptId;
	if (!roomId) throw new Error('Missing roomId');
	if (!attemptId) throw new Error('Missing attemptId');
	const result = await pollPrivosSandboxAI(roomId, attemptId);
	return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}
async function analyzeLinkedInEngagement(args: any) {
	const roomId = args?.roomId;
	if (!roomId) throw new Error('Missing roomId');
	const prompt = buildEngagementPrompt(args);
	const result = await startPrivosSandboxAI(roomId, prompt);
	return { content: [{ type: 'text', text: JSON.stringify({ status: result.answer ? 'completed' : 'running', answer: result.answer, attemptId: result.attemptId }) }] };
}

/** Cache the built UI HTML — invalidated when dist changes (dev watch mode) */
let cachedUiHtml: string | null = null;
let lastBuildMtime = 0;

/**
 * When set, the UI is served live from a Vite dev server at this public origin
 * (HMR + breakpoints) instead of an inlined production bundle. See dev-server.ts.
 */
let devPublicUrl: string | null = null;

/** Enable dev mode: iframe loads UI from the Vite dev server at `publicUrl`. */
export function setDevPublicUrl(publicUrl: string): void {
	devPublicUrl = publicUrl.replace(/\/$/, '');
}

/** Clear cache so next resources/read picks up rebuilt UI */
export function invalidateUiCache(): void {
	cachedUiHtml = null;
}

/** Handle an incoming MCP JSON-RPC request and return the result */
export async function handleMcpMessage(method: string, _id: number, params: any): Promise<any> {
	switch (method) {
		case 'initialize':
			return {
				protocolVersion: '2025-03-26',
				capabilities: {
					tools: {},
					extensions: {
						'io.modelcontextprotocol/ui': {
							mimeTypes: ['text/html;profile=mcp-app'],
						},
					},
				},
				serverInfo: {
				name: pkg.title || pkg.name,
				version: pkg.version,
				...(appIcon && { icon: appIcon }),
				// Advertise the manifest's requested scopes so the hub can refresh
				// `requestedScopes` on reconnect/refresh without a re-pair.
				...(Array.isArray(pkg.scopes) && { scopes: pkg.scopes }),
			},
			};

		case 'notifications/initialized':
			return {};

		case 'tools/list':
			return {
				tools: [
					{
						name: TOOL_NAME,
						title: pkg.title || 'Demo HR Management',
						description: pkg.description || 'HR management dashboard',
						inputSchema: {
							type: 'object',
							properties: { roomId: { type: 'string' } },
						},
						_meta: {
							ui: { resourceUri: UI_RESOURCE_URI },
						},
					},
					{
						name: 'crawl_linkedin',
						title: 'Crawl LinkedIn Data',
						description: 'Crawl and parse LinkedIn page',
						inputSchema: { type: 'object', properties: { accountId: { type: 'string' }, existingPosts: { type: 'array' } } }
					},
					{
						name: 'trigger_crawl_linkedin',
						title: 'Trigger Crawl',
						description: 'Start the background crawl process',
						inputSchema: { type: 'object', properties: { url: { type: 'string' }, accountId: { type: 'string' } } }
					},
					{
						name: 'analyze_linkedin_engagement',
						title: 'Analyze LinkedIn Engagement',
						description: 'Use PrivOS AI to analyze LinkedIn post engagement data and provide comparison, insights, and recommendations.',
						inputSchema: {
							type: 'object',
							properties: {
								roomId: { type: 'string' },
								question: { type: 'string' },
								accountId: { type: 'string' },
								accounts: { type: 'object' }
							},
							required: ['roomId', 'question', 'accounts']
						}
					},
					{
						name: 'poll_linkedin_engagement_analysis',
						title: 'Poll LinkedIn Engagement Analysis',
						description: 'Poll a running PrivOS AI LinkedIn engagement analysis attempt.',
						inputSchema: {
							type: 'object',
							properties: {
								roomId: { type: 'string' },
								attemptId: { type: 'string' }
							},
							required: ['roomId', 'attemptId']
						}
					}
				],
			};

		case 'tools/call':
			if (params?.name === 'analyze_linkedin_engagement') {
				return analyzeLinkedInEngagement(params?.arguments || {});
			}
			if (params?.name === 'poll_linkedin_engagement_analysis') {
				return pollLinkedInEngagementAnalysis(params?.arguments || {});
			}
			if (params?.name === 'trigger_crawl_linkedin') {
				const url = params?.arguments?.url;
				const accountId = params?.arguments?.accountId || 'default';
				if (!url) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Missing url parameter' }) }] };
				triggerCrawl(url, accountId);
				return { content: [{ type: 'text', text: JSON.stringify({ status: 'crawling', message: `Đã nhận lệnh cho ${accountId}! Tiến trình crawl đang chạy ngầm, vui lòng đợi vài phút rồi bấm Lấy Dữ Liệu.` }) }] };
			}

			if (params?.name === 'crawl_linkedin') {
				const accountId = params?.arguments?.accountId || 'default';
				// Read from background cache — returns instantly, no timeout
				const cache = getCachedData(accountId);
				if (cache.status === 'crawling') {
					return { content: [{ type: 'text', text: JSON.stringify({ status: 'crawling', message: 'Đang crawl ngầm... vui lòng thử lại sau.' }) }] };
				}
				if (cache.status === 'error') {
					return { content: [{ type: 'text', text: JSON.stringify({ error: cache.error }) }] };
				}
				if (cache.posts.length > 0) {
					return { content: [{ type: 'text', text: JSON.stringify({ posts: cache.posts, followers: cache.followers }) }] };
				}
				return { content: [{ type: 'text', text: JSON.stringify({ status: 'idle', message: 'Chưa có dữ liệu cache. Hãy bấm nút Bắt Đầu Crawl Ngầm.' }) }] };
			}

			if (params?.name !== TOOL_NAME) {
				throw new Error(`Unknown tool: ${params?.name || '<missing>'}`);
			}
			return {
				content: [
					{
						type: 'resource',
						resource: {
							uri: UI_RESOURCE_URI,
							mimeType: 'text/html;profile=mcp-app',
							text: getInlineUiHtml(),
						},
					},
				],
			};

		case 'resources/read':
			return {
				contents: [
					{
						uri: params?.uri || UI_RESOURCE_URI,
						mimeType: 'text/html;profile=mcp-app',
						text: getInlineUiHtml(),
					},
				],
			};

		default:
			throw new Error(`Unknown method: ${method}`);
	}
}

/**
 * Build HTML referencing a live Vite dev server (HMR + TypeScript breakpoints).
 * Loads @vite/client and the React Fast Refresh preamble cross-origin from the
 * tunnel, then the real entry module — equivalent to what Vite injects into a
 * transformed index.html, but emitted here since the relay serves the document.
 */
function getDevUiHtml(publicUrl: string): string {
	const base = `${publicUrl}/ui`;
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${pkg.title || 'Demo HR Management'} (dev)</title>
  <script type="module" src="${base}/@vite/client"></script>
  <script type="module">
    import RefreshRuntime from "${base}/@react-refresh";
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${base}/main.tsx"></script>
</body>
</html>`;
}

/**
 * Build a fully self-contained HTML page with inlined JS and CSS.
 * Reads from dist/ui/ (Vite build output). Run `npm run build` first.
 */
function getInlineUiHtml(): string {
	// Dev mode: serve live from the Vite dev server for HMR + breakpoints.
	if (devPublicUrl) return getDevUiHtml(devPublicUrl);

	const distDir = path.join(__dirname, '../dist/ui');

	// In dev watch mode, check if build output changed since last cache
	const assetsPath = path.join(distDir, 'assets');
	if (fs.existsSync(assetsPath)) {
		const stat = fs.statSync(assetsPath);
		if (stat.mtimeMs !== lastBuildMtime) {
			cachedUiHtml = null;
			lastBuildMtime = stat.mtimeMs;
		}
	}

	if (cachedUiHtml) return cachedUiHtml;

	// Find built JS and CSS files in dist/ui/assets/
	const assetsDir = path.join(distDir, 'assets');
	if (!fs.existsSync(assetsDir)) {
		throw new Error('UI not built. Run `npm run build` first, then restart.');
	}

	const files = fs.readdirSync(assetsDir);
	const jsFile = files.find((f) => f.endsWith('.js'));
	const cssFile = files.find((f) => f.endsWith('.css'));

	const jsContent = jsFile ? fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8') : '';
	const cssContent = cssFile ? fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8') : '';

	cachedUiHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${pkg.title || 'Demo HR Management'}</title>
  <style>${cssContent}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${jsContent}</script>
</body>
</html>`;

	return cachedUiHtml;
}
