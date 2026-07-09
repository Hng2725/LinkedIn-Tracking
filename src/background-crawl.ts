/**
 * Background LinkedIn crawl — runs on server startup, saves to cache file.
 * UI reads from cache instantly (no timeout).
 */
import fs from 'fs';
import path from 'path';
// @ts-ignore
import { parseLinkedInHtml } from '../parse-linkedin.js';

const API_KEY = process.env.API_AUTH_KEY || '';
const CRAWL_INTERVAL_MS = 10 * 60 * 1000; // Re-crawl every 10 minutes

export function getCacheFile(accountId: string) {
	return path.join(__dirname, `../linkedin-cache-${accountId || 'default'}.json`);
}

export interface CrawlCache {
	posts: any[];
	followers?: number | null;
	lastCrawledAt: string;
	status: 'idle' | 'crawling' | 'done' | 'error';
	error?: string;
}

function readCache(accountId: string): CrawlCache {
	try {
		const file = getCacheFile(accountId);
		if (fs.existsSync(file)) {
			return JSON.parse(fs.readFileSync(file, 'utf-8'));
		}
	} catch (e) {}
	return { posts: [], lastCrawledAt: '', status: 'idle' };
}

function writeCache(accountId: string, cache: CrawlCache) {
	fs.writeFileSync(getCacheFile(accountId), JSON.stringify(cache, null, 2), 'utf-8');
}

export function getCachedData(accountId: string): CrawlCache {
	return readCache(accountId);
}

export async function doCrawl(url: string, accountId: string) {
	const cache = readCache(accountId);
	cache.status = 'crawling';
	writeCache(accountId, cache);

	console.log(`[BG-CRAWL] Starting LinkedIn crawl for ${accountId}...`);

	try {
		const headers = { 'api-key': API_KEY, 'Content-Type': 'application/json' };
		const encodedUrl = encodeURIComponent(url);
		const startRes = await fetch(
			`https://crawl-search-dev.roxane.one/api/social/fullHTML?platform=linkedin&url=${encodedUrl}`,
			{ headers }
		);
		const startData = await startRes.json();

		if (!startData?.taskId) {
			cache.status = 'error';
			cache.error = `Failed to start task: ${JSON.stringify(startData)}`;
			writeCache(accountId, cache);
			console.log('[BG-CRAWL] Error:', cache.error);
			return;
		}

		console.log(`[BG-CRAWL] Task started: ${startData.taskId}. Polling...`);

		let htmlResult = '';
		for (let i = 0; i < 1200; i++) { // 1200 * 3s = 60 minutes max
			await new Promise(r => setTimeout(r, 3000));
			try {
				const pollRes = await fetch(
					`https://crawl-search-dev.roxane.one/api/social/fullHTML/${startData.taskId}`,
					{ headers }
				);
				const pollData = await pollRes.json();

				if (pollData.status === 'COMPLETED') {
					console.log(`[BG-CRAWL] COMPLETED response keys: ${Object.keys(pollData).join(', ')}`);
					console.log(`[BG-CRAWL] COMPLETED response (first 500 chars): ${JSON.stringify(pollData).slice(0, 500)}`);
					htmlResult = pollData.results || pollData.htmlResult || pollData.htmlContent || pollData.result || pollData.html || pollData.data || pollData.content || '';
					if (typeof htmlResult === 'object') {
						htmlResult = JSON.stringify(htmlResult);
					}
					console.log(`[BG-CRAWL] Task completed! HTML length: ${htmlResult.length}`);
					break;
				} else if (pollData.status === 'FAILED') {
					cache.status = 'error';
					cache.error = `Task failed: ${JSON.stringify(pollData)}`;
					writeCache(accountId, cache);
					console.log('[BG-CRAWL] Error:', cache.error);
					return;
				}
				// Still running...
			} catch (pollErr: any) {
				console.log(`[BG-CRAWL] Poll warning: ${pollErr.message || 'fetch failed'}. Retrying next tick...`);
			}
		}

		if (!htmlResult) {
			cache.status = 'error';
			cache.error = 'Crawl timeout after 60 minutes';
			writeCache(accountId, cache);
			console.log('[BG-CRAWL] Timeout');
			return;
		}

		const parsed = parseLinkedInHtml(htmlResult, cache.posts, accountId);
		cache.posts = parsed.posts;
		if (parsed.followers !== undefined) cache.followers = parsed.followers;
		cache.lastCrawledAt = new Date().toISOString();
		cache.status = 'done';
		cache.error = undefined;
		writeCache(accountId, cache);
		console.log(`[BG-CRAWL] ✅ Done! ${parsed.posts.length} posts cached.`);

	} catch (err: any) {
		cache.status = 'error';
		cache.error = err.message || 'Unknown error';
		writeCache(accountId, cache);
		console.log('[BG-CRAWL] Error:', cache.error);
	}
}

const crawlingStates = new Map<string, boolean>();

async function doCrawlWithRetry(url: string, accountId: string) {
	if (crawlingStates.get(accountId)) {
		console.log(`[BG-CRAWL] Đang crawl cho ${accountId} rồi, bỏ qua.`);
		return;
	}
	crawlingStates.set(accountId, true);
	try {
		await doCrawl(url, accountId);
		// If crawl failed, auto-retry after 60s
		const cache = readCache(accountId);
		if (cache.status === 'error') {
			console.log(`[BG-CRAWL] Crawl ${accountId} thất bại, tự động thử lại sau 60s...`);
			setTimeout(() => {
				crawlingStates.set(accountId, false);
				doCrawlWithRetry(url, accountId);
			}, 60000);
			return;
		}
	} finally {
		crawlingStates.set(accountId, false);
	}
}

/** Trigger a single crawl on demand */
export function triggerCrawl(url: string, accountId: string) {
	doCrawlWithRetry(url, accountId);
}
