import { doCrawl } from '../src/background-crawl.js';
import fs from 'fs';
import path from 'path';

// Lấy Access Token từ Privos
async function getPrivosAccessToken(privosUrl: string, clientId: string, clientSecret: string): Promise<string> {
	const res = await fetch(`${privosUrl}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
	});
	if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${res.statusText}`);
	const data = await res.json();
	if (!data.access_token) throw new Error('No access_token in response');
	return data.access_token;
}

import WebSocket from 'ws';

class PrivosWSClient {
    ws: WebSocket;
    callbacks: Map<number, {resolve: Function, reject: Function}> = new Map();
    nextId = 1;

    constructor(url: string, token: string) {
        this.ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
        this.ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.id && this.callbacks.has(msg.id)) {
                if (msg.error) this.callbacks.get(msg.id)!.reject(new Error(msg.error.message));
                else this.callbacks.get(msg.id)!.resolve(msg.result);
                this.callbacks.delete(msg.id);
            }
        });
    }

    async connect() {
        return new Promise<void>((resolve, reject) => {
            this.ws.on('open', resolve);
            this.ws.on('error', reject);
        });
    }

    async callTool(name: string, args: any): Promise<any> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id,
                method: 'tools/call',
                params: { name, arguments: args }
            }));
            setTimeout(() => {
                if (this.callbacks.has(id)) {
                    this.callbacks.delete(id);
                    reject(new Error(`Timeout calling tool ${name}`));
                }
            }, 30000);
        });
    }

    close() {
        this.ws.close();
    }
}

function getCreatedId(res: any): string | null {
	if (res?._id) return res._id;
	if (Array.isArray(res?.content)) {
		const textBlock = res.content.find((c: any) => c.type === 'text');
		if (textBlock) {
			try {
				const parsed = JSON.parse(textBlock.text);
				return parsed._id || parsed.item?._id || null;
			} catch (e) {}
		}
	}
	return null;
}

// Hàm đẩy dữ liệu lên Privos qua WebSocket (MCP JSON-RPC) theo đúng Workflow
async function pushToPrivos(accountId: string) {
	const privosUrl = process.env.PRIVOS_URL;
	const clientId = process.env.CLIENT_ID;
	const clientSecret = process.env.CLIENT_SECRET;

	if (!privosUrl || !clientId || !clientSecret) {
		console.warn(`[Push] Bỏ qua việc push lên Privos cho ${accountId} vì thiếu ENV credentials.`);
		return;
	}

	try {
		console.log(`[Push] Đang lấy token để push cho ${accountId}...`);
		const token = await getPrivosAccessToken(privosUrl, clientId, clientSecret);
		
		const cachePath = path.join(process.cwd(), `linkedin-cache-${accountId}.json`);
		if (!fs.existsSync(cachePath)) return;
		const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

		const wsUrl = privosUrl.replace(/^http/, 'ws') + '/api/v1/mcp-apps.relay';
		console.log(`[Push] Đang kết nối WebSocket tới ${wsUrl}...`);
		
		const client = new PrivosWSClient(wsUrl, token);
		await client.connect();
		console.log(`[Push] Đã kết nối WS. Đang xử lý data cho ${accountId}...`);

		const TARGET_LIST_ID = '6a488ba39de21b2fd30e246e'; // ID CỦA BẠN

		// 1. Lấy Stage ID tương ứng
		const listDetail = await client.callTool('privos.lists.get', { listId: TARGET_LIST_ID });
		let stages: any[] = [];
		if (listDetail?.stages) stages = listDetail.stages;
		else if (listDetail?.content && Array.isArray(listDetail.content)) {
			const textBlock = listDetail.content.find((c: any) => c.type === 'text');
			if (textBlock) {
				try {
					const parsed = JSON.parse(textBlock.text);
					stages = parsed.stages || parsed.list?.stages || [];
				} catch (e) {}
			}
		}
		const stage = stages.find((s: any) => s.name.toLowerCase().includes(accountId.toLowerCase()));
		const stageId = stage ? stage._id : null;

		// 2. Lấy các items hiện có để so sánh
		const getItemsRes = await client.callTool('privos.lists.getItems', { listId: TARGET_LIST_ID, count: 100 });
		let items: any[] = [];
		if (getItemsRes?.items) items = getItemsRes.items;
		else if (Array.isArray(getItemsRes?.content)) {
			const textBlock = getItemsRes.content.find((c: any) => c.type === 'text');
			if (textBlock) {
				try {
					const parsed = JSON.parse(textBlock.text);
					items = parsed.items || [];
				} catch (e) {}
			}
		}

		let created = 0, updated = 0;

		// 3. Xử lý Followers
		if (data.followers !== undefined && data.followers !== null) {
			const title = `[LinkedIn Followers - ${accountId}] ${data.followers.toLocaleString()}`;
			const followerJson = JSON.stringify({ type: 'followers', count: data.followers, date: new Date().toISOString().split('T')[0], id: `${accountId}-followers` });
			
			const existingFollower = items.find(item => item.title && item.title.includes(`[LinkedIn Followers - ${accountId}]`));
			if (existingFollower) {
				await client.callTool('privos.lists.updateItem', { itemId: existingFollower._id, title, description: followerJson });
				updated++;
			} else {
				const createRes = await client.callTool('privos.lists.createItem', { listId: TARGET_LIST_ID, title, description: followerJson });
				const createdId = getCreatedId(createRes);
				if (createdId && stageId) await client.callTool('privos.lists.moveItemToStage', { itemId: createdId, stageId });
				created++;
			}
		}

		// 4. Xử lý từng Post
		const postsArray = Array.isArray(data.posts) ? data.posts : [];
		for (const post of postsArray) {
			if (!post.id || !post.id.includes(accountId)) continue;
			
			const existing = items.find(item => {
				try { return JSON.parse(item.description).id === post.id; }
				catch (e) { return false; }
			});
			
			const title = `[LinkedIn] ${post.summary.slice(0, 50)}`;
			const postJson = JSON.stringify(post);
			
			if (existing) {
				await client.callTool('privos.lists.updateItem', { itemId: existing._id, title, description: postJson });
				updated++;
			} else {
				const createRes = await client.callTool('privos.lists.createItem', { listId: TARGET_LIST_ID, title, description: postJson });
				const createdId = getCreatedId(createRes);
				if (createdId && stageId) await client.callTool('privos.lists.moveItemToStage', { itemId: createdId, stageId });
				created++;
			}
		}

		console.log(`[Push] ✅ Xong cho ${accountId}: Tạo mới ${created}, Cập nhật ${updated} items.`);
		client.close();
	} catch (error) {
		console.error(`[Push] ❌ Lỗi khi đẩy lên Privos cho ${accountId}:`, error);
	}
}

const MOCK_ACCOUNTS = [
	{
		id: 'privos',
		platforms: {
			linkedin: {
				url: 'https://www.linkedin.com/company/privos-ai/posts/?feedView=all'
			}
		}
	},
	{
		id: 'merve',
		platforms: {
			linkedin: {
				url: 'https://www.linkedin.com/in/merve-sumeyye-bublis-3984406a/recent-activity/all/'
			}
		}
	}
];

async function main() {
	console.log('Starting automated crawl from GitHub Actions (Queue Mode)...');

	for (const acc of MOCK_ACCOUNTS) {
		console.log(`\n[QUEUE] Processing job for account: ${acc.id}`);
		const url = acc.platforms.linkedin.url;
		try {
			await doCrawl(url, acc.id);
			console.log(`[QUEUE] ✅ Job completed successfully for: ${acc.id}`);

			// Gọi hàm push lên Privos sau khi crawl xong
			await pushToPrivos(acc.id);
		} catch (error) {
			// Fault Isolation: Bắt lỗi riêng từng job để không làm chết job tiếp theo
			console.error(`[QUEUE] ❌ Job failed for ${acc.id}:`, error);
		}
	}

	console.log('\n[QUEUE] All jobs in queue have been processed.');
}

main().catch(console.error);
