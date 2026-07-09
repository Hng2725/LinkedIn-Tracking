const fs = require('fs');
const cheerio = require('cheerio');

function parseLinkedInHtml(html, existingPosts = [], accountId = 'privos') {
  const $ = cheerio.load(html);
  
  const posts = [];
  
  function parseDate(dateStr) {
    const now = new Date();
    const match = dateStr.match(/(\d+)\s*(m|h|d|w|mo|yr)/);
    if (!match) return now.toISOString().split('T')[0];
    
    const amount = parseInt(match[1]);
    const unit = match[2];
    
    if (unit === 'm') now.setMinutes(now.getMinutes() - amount);
    else if (unit === 'h') now.setHours(now.getHours() - amount);
    else if (unit === 'd') now.setDate(now.getDate() - amount);
    else if (unit === 'w') now.setDate(now.getDate() - (amount * 7));
    else if (unit === 'mo') now.setMonth(now.getMonth() - amount);
    else if (unit === 'yr') now.setFullYear(now.getFullYear() - amount);
    
    return now.toISOString().split('T')[0];
  }
  
  let existingPostsMap = new Map();
  if (Array.isArray(existingPosts)) {
    existingPosts.forEach(p => existingPostsMap.set(p.id, p));
  }

  $('.feed-shared-update-v2').each((i, el) => {
    // Description text
    let text = $(el).find('.update-components-text, .feed-shared-update-v2__description').text().trim();
    if (!text) {
        text = $(el).find('[data-urn]').text().trim().split('\n')[0] || "No description";
    }

    // ID
    let urn = $(el).attr('data-urn') || $(el).find('[data-urn]').attr('data-urn');
    let postId = urn ? `${accountId}-linkedin-${urn.replace(/:/g, '-')}` : `${accountId}-linkedin-post-${i}`;

    // Date
    let dateStr = $(el).find('.update-components-actor__sub-description').text().trim();
    if (!dateStr) dateStr = '0d';
    const postDate = parseDate(dateStr);
    
    // Reacts
    const reactsText = $(el).find('.social-details-social-counts__reactions-count, [aria-label*="reaction"]').text().trim() || '0';
    const reactsMatch = reactsText.match(/(\d+)/);
    const reacts = reactsMatch ? parseInt(reactsMatch[0]) : 0;

    // Comments
    const commentsEl = $(el).find('[aria-label*="comment"]');
    const commentsText = commentsEl.length ? commentsEl.text() : '0';
    const commentsMatch = commentsText.match(/(\d+)/);
    const comments = commentsMatch ? parseInt(commentsMatch[0]) : 0;

    // Reposts
    const repostsEl = $(el).find('[aria-label*="repost"]');
    const repostsText = repostsEl.length ? repostsEl.text() : '0';
    const repostsMatch = repostsText.match(/(\d+)/);
    const reposts = repostsMatch ? parseInt(repostsMatch[0]) : 0;

    // Views
    let views = 0;

    if (existingPostsMap.has(postId)) {
      const existing = existingPostsMap.get(postId);
      existing.views = views;
      existing.reacts = reacts;
      existing.comments = comments;
      existing.reposts = reposts;
      existing.date = postDate; // Update date to correct any previously wrong stored dates
      // We do not overwrite summary unnecessarily, but summary might be updated
      existing.summary = text.substring(0, 150).replace(/\s+/g, ' ') + '...';
      if (urn) existing.link = `https://www.linkedin.com/feed/update/${urn}/`;
    } else {
      existingPostsMap.set(postId, {
        id: postId,
        date: postDate,
        views,
        reacts,
        comments,
        reposts,
        summary: text.substring(0, 150).replace(/\s+/g, ' ') + '...',
        link: urn ? `https://www.linkedin.com/feed/update/${urn}/` : (accountId === 'merve' ? `https://www.linkedin.com/in/merve-sumeyye-bublis-3984406a/recent-activity/all/` : `https://www.linkedin.com/company/privos/posts/`)
      });
    }
  });

  const finalPosts = Array.from(existingPostsMap.values());

  let followers = null;
  const text = $('html').text();
  
  let regexFollowers = /([\d,\.\+]+)\s*(?:followers?|người\s*theo\s*dõi)/i;
  let m = html.match(regexFollowers) || text.match(regexFollowers);
  
  if (m) {
    followers = parseInt(m[1].replace(/[,.]/g, '').replace('+', ''), 10);
  } else {
    // Look for "185" specifically to see what's around it
    const idx = text.indexOf('185');
    if (idx !== -1) {
      followers = "DEBUG_185: " + text.substring(Math.max(0, idx - 30), idx + 30).replace(/\s+/g, ' ');
    } else {
      followers = "DEBUG_NOT_FOUND: " + text.substring(0, 100).replace(/\s+/g, ' ');
    }
  }

  return { posts: finalPosts, followers };
}

module.exports = { parseLinkedInHtml };
