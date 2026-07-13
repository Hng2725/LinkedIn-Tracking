import React, { useEffect, useRef, useState } from 'react';
import { usePrivosContext, useLists, usePrivosApp } from '@privos/app-react';
import { Avatar, Button, Card, Input, Typography } from 'antd';
import {
  BulbOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

type AccountId = 'privos' | 'merve';

type ChatMessage = {
  id: number;
  sender: 'ai' | 'user';
  text: string;
};

type EngagementPost = {
  id?: string;
  date?: string;
  summary?: string;
  views?: number;
  reacts?: number;
  comments?: number;
  reposts?: number;
  link?: string;
  createdAt?: string;
};

const parseToolItems = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.content)) {
    const textBlock = res.content.find((c: any) => c.type === 'text' && c.text);
    if (textBlock) {
      try {
        const parsed = JSON.parse(textBlock.text);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.items)) return parsed.items;
      } catch (e) { }
    }
    if (res.content.every((c: any) => c?._id)) return res.content;
  }
  return [];
};


const normalizeName = (value: any) => String(value || '').trim().toLowerCase();
const isNumericOnlyItem = (item: any) => /^\d+$/.test(String(item?.name || item?.title || '').trim());
const isStageMarker = (item: any) => {
  const name = normalizeName(item?.name || item?.title);
  return name === 'privos linkedin' || name === 'merve linkedin';
};

const normalizePost = (post: any, item: any): EngagementPost | null => {
  if (!post || post.type === 'followers') return null;
  const date = post.date || post.createdAt || item.createdAt;
  if (!dayjs(date).isValid()) return null;
  return {
    id: post.id || item._id,
    date: dayjs(date).format('YYYY-MM-DD'),
    summary: post.summary || item.name || item.title || '',
    views: Number(post.views) || 0,
    reacts: Number(post.reacts) || 0,
    comments: Number(post.comments) || 0,
    reposts: Number(post.reposts) || 0,
    link: post.link,
    createdAt: post.createdAt || item.createdAt,
  };
};
const sumPosts = (posts: EngagementPost[]) => {
  const totals = posts.reduce((acc, post) => {
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
};

const buildEngagementPrompt = (question: string, postsByAccount: Record<AccountId, EngagementPost[]>) => {
  const lines: string[] = [];
  const normalizedQuestion = question.toLowerCase();
  const compareIntent = /\b(compare|comparison|versus|vs\.?|against|between|so s[aá]nh)\b/i.test(question) || (normalizedQuestion.includes('privos') && normalizedQuestion.includes('merve'));
  const mentionsPrivos = normalizedQuestion.includes('privos');
  const mentionsMerve = normalizedQuestion.includes('merve');
  const accountEntries = compareIntent
    ? ([['privos', 'PrivOS AI'], ['merve', 'Merve S. BUBLIS']] as const)
    : mentionsMerve && !mentionsPrivos
      ? ([['merve', 'Merve S. BUBLIS']] as const)
      : mentionsPrivos && !mentionsMerve
        ? ([['privos', 'PrivOS AI']] as const)
        : ([['privos', 'PrivOS AI'], ['merve', 'Merve S. BUBLIS']] as const);

  lines.push('You are the PrivOS AI social media performance analyst.');
  lines.push('Analyze the real LinkedIn tracking data below. Answer in the same language as the user question.');
  lines.push('Focus on engagement quality, likely causes, and concrete next actions.');
  lines.push(compareIntent ? 'The user asked for comparison, so compare PrivOS and Merve directly.' : 'The user did not ask for comparison. Do not force PrivOS-vs-Merve comparison. If the question names one account, analyze only that account. If no account is named, summarize the available data without ranking the accounts against each other.');
  lines.push('Do not invent missing metrics. If data is missing, say so clearly.');
  lines.push('');
  lines.push(`User question: ${question}`);
  lines.push('');
  lines.push('Dataset summary:');
  accountEntries.forEach(([id, label]) => {
    const posts = postsByAccount[id];
    const summary = sumPosts(posts);
    lines.push(`\nAccount ${id} (${label})`);
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
  lines.push(compareIntent ? '2. Comparison between PrivOS and Merve.' : '2. Account-specific or overall observations only, without forced account comparison.');
  lines.push('3. Key observations from posts/comments/reacts/reposts/views.');
  lines.push('4. Practical recommendations and next content actions.');
  lines.push('Use clean Markdown formatting. Use Markdown tables only when they improve readability, especially for requested comparisons or post rankings.');
  return lines.join('\n');
};

const extractSandboxText = (data: any): string => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.result === 'string') return data.result;
  if (typeof data.answer === 'string') return data.answer;
  if (typeof data.message === 'string' && data.status !== 'running') return data.message;
  if (Array.isArray(data.content)) {
    const parts = data.content
      .map((item: any) => typeof item?.text === 'string' ? item.text : typeof item === 'string' ? item : '')
      .filter(Boolean);
    if (parts.length) return parts.join('\n').trim();
  }
  if (Array.isArray(data.json)) {
    const parts: string[] = [];
    data.json.forEach((event: any) => {
      if (typeof event?.text === 'string') parts.push(event.text);
      if (typeof event?.content === 'string') parts.push(event.content);
      if (typeof event?.result === 'string') parts.push(event.result);
      if (typeof event?.message?.content === 'string') parts.push(event.message.content);
    });
    if (parts.length) return parts.join('\n').trim();
  }
  if (data.body) return extractSandboxText(data.body);
  if (data.data) return extractSandboxText(data.data);
  if (data.result) return extractSandboxText(data.result);
  return '';
};

const findAttemptId = (data: any): string | null => {
  if (!data || typeof data !== 'object') return null;
  for (const key of ['attemptId', 'attempt_id', 'id']) {
    if (typeof data[key] === 'string' && data[key]) return data[key];
  }
  if (typeof data.attempt?._id === 'string') return data.attempt._id;
  if (typeof data.attempt?.id === 'string') return data.attempt.id;
  for (const value of Object.values(data)) {
    const nested = findAttemptId(value);
    if (nested) return nested;
  }
  return null;
};

const describeResponseShape = (value: any) => {
  if (!value || typeof value !== 'object') return typeof value;
  return Object.keys(value).slice(0, 12).join(', ') || 'empty object';
};

const unwrapRestResponse = (res: any) => {
  const statusCode = Number(res?.statusCode ?? res?.status ?? 200);
  const body = res?.body ?? res?.data ?? res?.result ?? res;
  return { statusCode, body };
};
const parseServerToolJson = (res: any): any => {
  if (Array.isArray(res?.content)) {
    const textBlock = res.content.find((item: any) => item?.type === 'text' && item.text);
    if (textBlock) {
      try { return JSON.parse(textBlock.text); } catch (e) { return { error: textBlock.text }; }
    }
  }
  return res;
};
const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

function isMarkdownTableLine(line: string) {
  return line.startsWith('|') && line.endsWith('|') && line.split('|').length >= 4;
}

function isMarkdownDividerLine(line: string) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function parseMarkdownTable(lines: string[], startIndex: number) {
  const tableLines: string[] = [];
  let index = startIndex;
  while (index < lines.length && isMarkdownTableLine(lines[index].trim())) {
    tableLines.push(lines[index].trim());
    index++;
  }

  const rows = tableLines
    .filter(line => !isMarkdownDividerLine(line))
    .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()));

  return { rows, nextIndex: index };
}

function MarkdownMessage({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) {
      nodes.push(<div key={index} style={{ height: 8 }} />);
      continue;
    }

    if (isMarkdownTableLine(line) && lines[index + 1] && isMarkdownDividerLine(lines[index + 1].trim())) {
      const { rows, nextIndex } = parseMarkdownTable(lines, index);
      const [header, ...bodyRows] = rows;
      nodes.push(
        <div key={index} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
            {header && (
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={cellIndex} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d9d9d9', background: '#f5f7ff', color: '#1a1a2e', fontWeight: 700 }}>
                      {renderInlineMarkdown(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = nextIndex - 1;
      continue;
    }

    if (line.startsWith('### ')) {
      nodes.push(<div key={index} style={{ fontWeight: 700, fontSize: 15, margin: '8px 0 4px' }}>{renderInlineMarkdown(line.slice(4))}</div>);
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(<div key={index} style={{ fontWeight: 700, fontSize: 16, margin: '10px 0 5px' }}>{renderInlineMarkdown(line.slice(3))}</div>);
      continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<div key={index} style={{ fontWeight: 800, fontSize: 17, margin: '10px 0 6px' }}>{renderInlineMarkdown(line.slice(2))}</div>);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      nodes.push(<div key={index} style={{ display: 'flex', gap: 8, margin: '4px 0' }}><span style={{ color: '#722ed1' }}>•</span><span>{renderInlineMarkdown(bullet[1])}</span></div>);
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      nodes.push(<div key={index} style={{ display: 'flex', gap: 8, margin: '4px 0' }}><span style={{ color: '#722ed1', fontWeight: 700 }}>{numbered[1]}.</span><span>{renderInlineMarkdown(numbered[2])}</span></div>);
      continue;
    }

    nodes.push(<div key={index} style={{ margin: '3px 0' }}>{renderInlineMarkdown(line)}</div>);
  }

  return <div style={{ fontSize: 14, lineHeight: 1.65, color: '#1a1a2e' }}>{nodes}</div>;
}

export default function AIAssistantChatTab() {
  const { roomId } = usePrivosContext();
  const { data: lists } = useLists(roomId);
  const app = usePrivosApp();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [postsByAccount, setPostsByAccount] = useState<Record<AccountId, EngagementPost[]>>({ privos: [], merve: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatMessages([{
      id: 1,
      sender: 'ai',
      text: 'Ask me about LinkedIn performance, PrivOS vs Merve comparison, weak posts, strong posts, or how to improve engagement. I will use the real Tracking Data list.',
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  useEffect(() => {
    if (!isTyping) return;
    const statuses = [
      'Preparing real LinkedIn data for PrivOS AI...',
      'PrivOS AI is reading the tracking data...',
      'PrivOS AI is comparing engagement signals...',
      'PrivOS AI is drafting recommendations...',
    ];
    let index = 0;
    setThinkingStatus(statuses[index]);
    const timer = window.setInterval(() => {
      index = (index + 1) % statuses.length;
      setThinkingStatus(statuses[index]);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isTyping]);

  useEffect(() => {
    if (!lists || !app) return;
    let cancelled = false;

    const loadTrackingPosts = async () => {
      const targetList = lists.find((l: any) => l.name === 'Tracking Data' || l.key === 'TRACKING_DATA');
      if (!targetList?._id) return;
      const allItems: any[] = [];
      let offset = 0;
      const pageSize = 100;

      while (!cancelled) {
        const res = await app.callServerTool({
          name: 'privos.lists.getItems',
          arguments: { listId: targetList._id, offset, count: pageSize, sortBy: 'createdAt', sortOrder: 'desc' }
        });
        const pageItems = parseToolItems(res);
        allItems.push(...pageItems);
        if (pageItems.length < pageSize) break;
        offset += pageItems.length;
      }
      if (cancelled) return;

      let privosStageId: string | null = null;
      let merveStageId: string | null = null;
      allItems.forEach((item) => {
        const itemName = normalizeName(item?.name || item?.title);
        if (!item.stageId) return;
        if (itemName === 'privos linkedin') privosStageId = item.stageId;
        if (itemName === 'merve linkedin') merveStageId = item.stageId;
      });

      const nextPosts: Record<AccountId, EngagementPost[]> = { privos: [], merve: [] };
      allItems.forEach((item) => {
        if (!item.stageId || isNumericOnlyItem(item) || isStageMarker(item)) return;
        const account: AccountId | null = item.stageId === privosStageId ? 'privos' : item.stageId === merveStageId ? 'merve' : null;
        if (!account) return;

        const pushPost = (post: any) => {
          const normalized = normalizePost(post, item);
          if (normalized) nextPosts[account].push(normalized);
        };

        if (item.description) {
          try {
            const parsed = JSON.parse(item.description);
            if (Array.isArray(parsed)) parsed.forEach(pushPost);
            else if (parsed && typeof parsed === 'object') pushPost(parsed);
            else pushPost(item);
          } catch (e) {
            pushPost(item);
          }
        } else {
          pushPost(item);
        }
      });

      nextPosts.privos.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      nextPosts.merve.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
      if (!cancelled) setPostsByAccount(nextPosts);
    };

    loadTrackingPosts().catch(() => {
      if (!cancelled) setPostsByAccount({ privos: [], merve: [] });
    });

    return () => { cancelled = true; };
  }, [lists, app]);

  const pollRestAnalysis = async (attemptId: string) => {
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const pollRes = await app.rest({
        method: 'GET',
        path: 'agents.sandbox.attempt-status',
        query: { roomId, attemptId, partial: 1 },
        timeoutMs: 15000,
      });
      const { statusCode, body } = unwrapRestResponse(pollRes);
      if (statusCode === 401 || statusCode === 403) throw new Error(`PrivOS AI permission denied (${statusCode})`);
      if (statusCode >= 400) throw new Error(`PrivOS AI poll failed (${statusCode})`);
      const status = body?.status || body?.body?.status;
      if (status === 'failed' || status === 'cancelled') throw new Error(`PrivOS AI attempt ${status}`);
      if (status === 'completed' || status === 'complete' || body?.completed) {
        return extractSandboxText(body) || 'Analysis completed, but no answer was returned.';
      }
    }
    throw new Error('AI analysis timed out');
  };

  const pollToolAnalysis = async (attemptId: string) => {
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const pollRes = await app.callServerTool({
        name: 'poll_linkedin_engagement_analysis',
        arguments: { roomId, attemptId },
      });
      const parsed = parseServerToolJson(pollRes);
      if (parsed?.status === 'failed' || parsed?.status === 'cancelled') throw new Error(`PrivOS AI attempt ${parsed.status}`);
      if (parsed?.status === 'completed') return parsed.answer || 'Analysis completed, but no answer was returned.';
    }
    throw new Error('AI analysis timed out');
  };

  const startWithRest = async (prompt: string) => {
    setThinkingStatus('Preparing real LinkedIn data for PrivOS AI...');
    const startRes = await app.rest({
      method: 'POST',
      path: 'agents.sandbox.generate-async',
      body: { roomId, prompt },
      timeoutMs: 30000,
    });
    const { statusCode, body } = unwrapRestResponse(startRes);
    if (statusCode === 401 || statusCode === 403) throw new Error(`PrivOS AI permission denied (${statusCode})`);
    if (statusCode >= 400) throw new Error(`PrivOS AI start failed (${statusCode})`);
    const immediate = extractSandboxText(body);
    const attemptId = findAttemptId(body);
    if (attemptId) return pollRestAnalysis(attemptId);
    if (immediate) return immediate;
    throw new Error(`REST response had no answer or attemptId. Response keys: ${describeResponseShape(body)}`);
  };

  const startWithTool = async (userMsg: string) => {
    setThinkingStatus('Starting PrivOS AI analysis...');
    const startRes = await app.callServerTool({
      name: 'analyze_linkedin_engagement',
      arguments: {
        roomId,
        question: userMsg,
        accountId: 'all',
        accounts: {
          privos: { label: 'PrivOS AI', posts: postsByAccount.privos },
          merve: { label: 'Merve S. BUBLIS', posts: postsByAccount.merve },
        },
      },
    });
    const parsed = parseServerToolJson(startRes);
    if (parsed?.answer) return parsed.answer;
    if (parsed?.attemptId) return pollToolAnalysis(parsed.attemptId);
    if (parsed?.error) throw new Error(parsed.error);
    throw new Error(`MCP tool response had no answer or attemptId. Response keys: ${describeResponseShape(parsed)}`);
  };

  const requestAIReply = async (userMsg: string) => {
    if (!app || !roomId) throw new Error('PrivOS app context is not ready');
    const prompt = buildEngagementPrompt(userMsg, postsByAccount);
    let restError = '';
    try {
      return await startWithRest(prompt);
    } catch (err: any) {
      restError = err?.message || String(err);
    }
    try {
      return await startWithTool(userMsg);
    } catch (err: any) {
      throw new Error(`REST failed: ${restError}. MCP tool failed: ${err?.message || String(err)}`);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    const userMsg = inputValue.trim();
    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsg }]);
    setInputValue('');
    setIsTyping(true);
    setThinkingStatus('Preparing real LinkedIn data for PrivOS AI...');

    try {
      const reply = await requestAIReply(userMsg);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: `I could not reach PrivOS AI right now. ${err?.message || 'Please try again.'}`,
      }]);
    } finally {
      setThinkingStatus('');
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                Online - Using PrivOS AI and Tracking Data
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 500, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, background: '#fafbff' }}>
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
                <MarkdownMessage text={msg.text} />
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Avatar size={34} icon={<RobotOutlined />} style={{ background: 'linear-gradient(135deg,#1890ff,#722ed1)', flexShrink: 0 }} />
              <div style={{ padding: '14px 18px', background: '#fff', borderRadius: '18px 18px 18px 4px', border: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text style={{ fontSize: 13, color: '#555' }}>{thinkingStatus || 'PrivOS AI is working...'}</Text>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#1890ff',
                      animation: 'bounce 0.8s infinite', animationDelay: `${delay}s`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '8px 24px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            'Compare PrivOS and Merve engagement',
            'Which posts performed best and why?',
            'How can PrivOS get more comments?',
            'Give me next week content actions',
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
            placeholder="Ask AI about real LinkedIn data, trends, weak posts, or improvements..."
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