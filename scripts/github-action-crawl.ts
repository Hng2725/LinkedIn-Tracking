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

// Hàm đẩy dữ liệu lên Privos
async function pushToPrivos(accountId: string) {
	const privosUrl = process.env.PRIVOS_URL;
	const clientId = process.env.CLIENT_ID;
	const clientSecret = process.env.CLIENT_SECRET;

	if (!privosUrl || !clientId || !clientSecret) {
		console.warn(`[Push] Bỏ qua việc push lên Privos cho ${accountId} vì thiếu ENV credentials (PRIVOS_URL, vv...).`);
		return;
	}

	try {
		console.log(`[Push] Đang lấy token để push cho ${accountId}...`);
		const token = await getPrivosAccessToken(privosUrl, clientId, clientSecret);

		// Đọc data từ file cache vừa crawl xong
		const cachePath = path.join(process.cwd(), `linkedin-cache-${accountId}.json`);
		if (!fs.existsSync(cachePath)) {
			console.log(`[Push] Không tìm thấy cache file ${cachePath}`);
			return;
		}
		const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

		// Gọi API Privos để đẩy data (TODO: Bạn cần sửa đường dẫn endpoint này cho đúng với schema của Privos)
		const apiEndpoint = `${privosUrl}/api/v1/lists/6a488ba39de21b2fd30e246e/items`;

		console.log(`[Push] Đang gửi dữ liệu lên ${apiEndpoint}...`);
		const response = await fetch(apiEndpoint, {
			method: 'POST', // hoặc PUT tùy Privos yêu cầu
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ accountId, ...data })
		});

		if (!response.ok) {
			const err = await response.text();
			throw new Error(`API Error: ${response.status} - ${err}`);
		}

		console.log(`[Push] ✅ Đã đẩy dữ liệu thành công cho ${accountId}!`);
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
