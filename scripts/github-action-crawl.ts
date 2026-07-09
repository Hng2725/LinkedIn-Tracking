import { doCrawl } from '../src/background-crawl.js';

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
		} catch (error) {
			// Fault Isolation: Bắt lỗi riêng từng job để không làm chết job tiếp theo
			console.error(`[QUEUE] ❌ Job failed for ${acc.id}:`, error);
		}
	}
	
	console.log('\n[QUEUE] All jobs in queue have been processed.');
}

main().catch(console.error);
