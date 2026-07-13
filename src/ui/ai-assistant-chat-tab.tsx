import React, { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Card, Input, Segmented, Space, Typography } from 'antd';
import {
  BulbOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const MOCK_THIS_WEEK = {
  posts: 4,
  views: 3820,
  reacts: 214,
  comments: 47,
  reposts: 18,
  engagementRate: 7.3,
  avgViews: 955,
};

const MOCK_LAST_WEEK = {
  posts: 2,
  views: 1950,
  reacts: 98,
  comments: 21,
  reposts: 7,
  engagementRate: 6.5,
  avgViews: 975,
};

const MOCK_MERVE = {
  thisWeek: { posts: 3, views: 5100, reacts: 380, comments: 72, reposts: 24, engagementRate: 9.3, avgViews: 1700 },
  lastWeek: { posts: 5, views: 6200, reacts: 420, comments: 88, reposts: 31, engagementRate: 8.7, avgViews: 1240 },
};

const MOCK_PRIVOS = {
  thisWeek: MOCK_THIS_WEEK,
  lastWeek: MOCK_LAST_WEEK,
};

type AccountId = 'privos' | 'merve';

type ChatMessage = {
  id: number;
  sender: 'ai' | 'user';
  text: string;
};

const ACCOUNTS = [
  { id: 'merve', label: 'Merve S. BUBLIS', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQFwgjLdgucxVw/profile-displayphoto-scale_400_400/B4DZ3BGvSHHsAk-/0/1777061265216?e=1784764800&v=beta&t=p0YmkCfiXoakcZlBlNj6ZiehKclEdbRmkkPHuu2qRkE' },
  { id: 'privos', label: 'PrivOS AI', avatar: 'https://pbs.twimg.com/profile_images/2013183029779288065/GlhEZQnx_400x400.jpg' },
];

function calcHealthScore(data: typeof MOCK_THIS_WEEK, lastData: typeof MOCK_LAST_WEEK) {
  let score = 0;
  const breakdown: { label: string; earned: number; max: number; note: string }[] = [];

  const postPts = data.posts >= 3 ? 30 : data.posts >= 1 ? 15 : 0;
  breakdown.push({ label: 'Post frequency', earned: postPts, max: 30, note: data.posts >= 3 ? '3+ posts/week' : data.posts >= 1 ? '1-2 posts/week' : 'No posts' });
  score += postPts;

  const engPts = data.engagementRate > 5 ? 30 : data.engagementRate >= 2 ? 18 : 5;
  breakdown.push({ label: 'Engagement Rate', earned: engPts, max: 30, note: data.engagementRate + '%' });
  score += engPts;

  const viewPts = data.avgViews > 1000 ? 20 : data.avgViews >= 500 ? 12 : 5;
  breakdown.push({ label: 'Average views / post', earned: viewPts, max: 20, note: data.avgViews.toLocaleString() + ' views' });
  score += viewPts;

  const growth = lastData.views > 0 ? ((data.views - lastData.views) / lastData.views) * 100 : 0;
  const growthPts = growth > 10 ? 20 : growth >= 0 ? 10 : 0;
  breakdown.push({ label: 'Weekly growth', earned: growthPts, max: 20, note: (growth > 0 ? '+' : '') + growth.toFixed(1) + '% vs previous week' });
  score += growthPts;

  return { score, breakdown };
}

function scoreLabel(score: number) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs improvement';
}

function generateAIComment(thisWeek: typeof MOCK_THIS_WEEK, lastWeek: typeof MOCK_LAST_WEEK, score: number): string {
  const viewGrowth = ((thisWeek.views - lastWeek.views) / (lastWeek.views || 1) * 100).toFixed(1);
  const reactGrowth = ((thisWeek.reacts - lastWeek.reacts) / (lastWeek.reacts || 1) * 100).toFixed(1);
  const lines: string[] = [];

  lines.push('Weekly analysis score: ' + score + '/100\n');
  if (thisWeek.views > lastWeek.views) lines.push('Views increased by ' + viewGrowth + '% vs the previous week (' + thisWeek.views.toLocaleString() + ' vs ' + lastWeek.views.toLocaleString() + ').');
  else lines.push('Views decreased by ' + Math.abs(Number(viewGrowth)) + '% vs the previous week. Try improving headlines and posting time.');
  if (thisWeek.engagementRate > 5) lines.push('Engagement rate is strong at ' + thisWeek.engagementRate + '%.');
  else if (thisWeek.engagementRate >= 2) lines.push('Engagement rate is moderate at ' + thisWeek.engagementRate + '%. Add a question or CTA to invite comments.');
  else lines.push('Engagement rate is low at ' + thisWeek.engagementRate + '%. Focus on clearer CTAs and relevant topics.');
  if (thisWeek.posts >= 3) lines.push('You posted ' + thisWeek.posts + ' times this week. Posting frequency is healthy.');
  else lines.push('You posted ' + thisWeek.posts + ' times this week. Aim for 3-4 posts per week for better reach.');
  if (Number(reactGrowth) > 0) lines.push('Reacts increased by ' + reactGrowth + '%. The content is resonating better with the audience.');
  lines.push('\nImprovement ideas for next week:');
  if (thisWeek.posts < 3) lines.push('- Increase posting frequency to 3-4 posts per week');
  if (thisWeek.engagementRate < 5) lines.push('- Add a question, poll, or CTA at the end of each post');
  if (thisWeek.avgViews < 1000) lines.push('- Test posting during high-activity windows');
  lines.push('- Use focused hashtags such as #AI #Technology #Innovation');
  return lines.join('\n');
}

export default function AIAssistantChatTab() {
  const [activeAccount, setActiveAccount] = useState<AccountId>('privos');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thisWeek = activeAccount === 'privos' ? MOCK_PRIVOS.thisWeek : MOCK_MERVE.thisWeek;
  const lastWeek = activeAccount === 'privos' ? MOCK_PRIVOS.lastWeek : MOCK_MERVE.lastWeek;
  const { score, breakdown } = calcHealthScore(thisWeek, lastWeek);

  useEffect(() => {
    setChatMessages([{ id: 1, sender: 'ai', text: generateAIComment(thisWeek, lastWeek, score) }]);
  }, [activeAccount]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const simulateAIReply = (userMsg: string) => {
    setIsTyping(true);
    const lower = userMsg.toLowerCase();
    let reply = '';

    if (lower.includes('view')) {
      reply = 'Views update:\n\nThis week reached **' + thisWeek.views.toLocaleString() + ' views**, a ' + ((thisWeek.views - lastWeek.views) / lastWeek.views * 100).toFixed(1) + '% change vs the previous week.\n\nTo increase views:\n- Post during high-activity windows\n- Use images or video when possible\n- Make the headline specific and outcome-oriented';
    } else if (lower.includes('react') || lower.includes('like') || lower.includes('engagement')) {
      reply = 'Engagement update:\n\nYour engagement rate is **' + thisWeek.engagementRate + '%**.\n\nTo improve engagement:\n- Add a question at the end of each post\n- Tag relevant people when appropriate\n- Share a clear point of view, not only information';
    } else if (lower.includes('post') || lower.includes('content')) {
      reply = 'Content update:\n\nYou posted **' + thisWeek.posts + ' posts** this week. ' + (thisWeek.posts >= 3 ? 'Posting frequency is healthy.' : 'Aim for 3-4 posts per week.') + '\n\nContent ideas:\n- Practical case studies\n- Product or company behind-the-scenes\n- Polls or short surveys\n- AI and technology trends';
    } else if (lower.includes('score') || lower.includes('health')) {
      reply = 'Health Score: **' + score + '/100** (' + scoreLabel(score) + ')\n\nBreakdown:\n' + breakdown.map(b => '- ' + b.label + ': ' + b.earned + '/' + b.max + 'pts - ' + b.note).join('\n') + '\n\nFastest improvement path: ' + (score < 70 ? 'increase posting frequency and add CTAs.' : 'keep momentum and test carousel-style content.');
    } else if (lower.includes('compare') || lower.includes('merve') || lower.includes('privos')) {
      reply = 'Account comparison:\n\n**PrivOS LinkedIn**: ' + MOCK_PRIVOS.thisWeek.posts + ' posts | ' + MOCK_PRIVOS.thisWeek.views.toLocaleString() + ' views | ' + MOCK_PRIVOS.thisWeek.engagementRate + '% engagement\n\n**Merve LinkedIn**: ' + MOCK_MERVE.thisWeek.posts + ' posts | ' + MOCK_MERVE.thisWeek.views.toLocaleString() + ' views | ' + MOCK_MERVE.thisWeek.engagementRate + '% engagement\n\nMerve is currently stronger on views, while PrivOS has a higher engagement rate.';
    } else {
      reply = 'I understand your question: "' + userMsg + '"\n\nBased on this week data for **' + (activeAccount === 'privos' ? 'PrivOS' : 'Merve') + '**:\n- Health Score: ' + score + '/100\n- Views: ' + thisWeek.views.toLocaleString() + ' (' + (thisWeek.views > lastWeek.views ? 'up' : 'down') + ' vs previous week)\n- Engagement: ' + thisWeek.engagementRate + '%\n\nYou can ask about views, reacts, posts, health score, or account comparison.';
    }

    setTimeout(() => {
      setChatMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: reply }]);
      setIsTyping(false);
    }, 1200);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userMsg = inputValue.trim();
    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsg }]);
    setInputValue('');
    simulateAIReply(userMsg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text type="secondary" strong>Select Account:</Text>
          <Segmented
            size="large"
            value={activeAccount}
            onChange={(val) => setActiveAccount(val as AccountId)}
            options={ACCOUNTS.map(a => ({
              label: (
                <div style={{ padding: '4px 8px' }}>
                  <Space>
                    <Avatar size="small" src={a.avatar} />
                    <span>{a.label}</span>
                  </Space>
                </div>
              ),
              value: a.id,
            }))}
          />
        </Space>
      </Card>

      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RobotOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Privos AI Assistant</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, background: '#73d13d', borderRadius: '50%', display: 'inline-block' }} />
                Online - Analyzing real data
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 380, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, background: '#fafbff' }}>
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
              <Avatar
                size={34}
                icon={msg.sender === 'user' ? <UserOutlined /> : <RobotOutlined />}
                style={{
                  background: msg.sender === 'user' ? '#52c41a' : 'linear-gradient(135deg,#1890ff,#722ed1)',
                  flexShrink: 0,
                  fontSize: 14,
                }}
              />
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.sender === 'user' ? 'linear-gradient(135deg,#e6f7ff,#bae7ff)' : '#fff',
                border: msg.sender === 'user' ? '1px solid #91d5ff' : '1px solid #e8e8e8',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}>
                <Text style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#1a1a2e' }}>
                  {msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                </Text>
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Avatar size={34} icon={<RobotOutlined />} style={{ background: 'linear-gradient(135deg,#1890ff,#722ed1)', flexShrink: 0 }} />
              <div style={{ padding: '14px 18px', background: '#fff', borderRadius: '18px 18px 18px 4px', border: '1px solid #e8e8e8', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#1890ff',
                    animation: 'bounce 0.8s infinite', animationDelay: `${delay}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '8px 24px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            'Why did views drop?',
            'Content ideas for next week',
            'How to improve engagement rate',
            'Compare PrivOS and Merve',
          ].map(q => (
            <button
              key={q}
              onClick={() => setInputValue(q)}
              style={{
                background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 16,
                padding: '5px 14px', cursor: 'pointer', fontSize: 12, color: '#2f54eb',
                fontWeight: 500, transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#d6e4ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f0f5ff')}
            >
              {q}
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10 }}>
          <Input
            size="large"
            placeholder="Ask AI about data, trends, or post improvement ideas..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onPressEnter={handleSend}
            style={{ borderRadius: 24, fontSize: 14 }}
            prefix={<BulbOutlined style={{ color: '#aaa' }} />}
            disabled={isTyping}
          />
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={isTyping || !inputValue.trim()}
            style={{
              borderRadius: 24, padding: '0 24px',
              background: 'linear-gradient(135deg,#1890ff,#722ed1)',
              border: 'none', fontWeight: 600,
            }}
          >
            Send
          </Button>
        </div>
      </Card>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}