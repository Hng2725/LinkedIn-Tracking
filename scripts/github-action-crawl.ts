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

// Hàm đẩy dữ liệu lên Privos qua WebSocket (MCP JSON-RPC)
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
		if (!fs.existsSync(cachePath)) {
			console.log(`[Push] Không tìm thấy cache file ${cachePath}`);
			return;
		}
		
		// Đọc file json
		const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

		// Đổi http -> ws
		const wsUrl = privosUrl.replace(/^http/, 'ws') + '/api/v1/mcp-apps.relay';
		console.log(`[Push] Đang kết nối WebSocket tới ${wsUrl}...`);
		
		const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } });

		await new Promise((resolve, reject) => {
			ws.on('open', () => {
				console.log(`[Push] Đã kết nối WS. Đang gửi data bằng JSON-RPC...`);
				
				// Mã List ID của bạn (hãy đảm bảo đã thay đúng mã của bạn ở đây)
				const TARGET_LIST_ID = '6a488ba39de21b2fd30e246e'; // ID của bạn
				
				const req = {
					jsonrpc: '2.0',
					id: Date.now(),
					method: 'tools/call', // Gọi MCP Tool của Privos
					params: {
						name: 'privos.lists.createItem',
						arguments: {
							listId: TARGET_LIST_ID,
							title: `[Auto-Crawl] Dữ liệu LinkedIn của ${accountId} (${new Date().toLocaleDateString()})`,
							description: JSON.stringify(data)
						}
					}
				};
				ws.send(JSON.stringify(req));
			});

			ws.on('message', (raw) => {
				const msg = JSON.parse(raw.toString());
				if (msg.error) {
					console.error('[Push] ❌ Lỗi từ Privos:', msg.error);
					reject(new Error(msg.error.message));
				} else if (msg.result) {
					console.log(`[Push] ✅ Đã đẩy dữ liệu thành công lên Privos cho ${accountId}!`);
					resolve(true);
				}
				ws.close();
			});

			ws.on('error', (err) => {
				console.error('[Push] WS Error:', err);
				reject(err);
			});
			
			// Đề phòng timeout
			setTimeout(() => {
				ws.close();
				resolve(false);
			}, 15000);
		});

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
