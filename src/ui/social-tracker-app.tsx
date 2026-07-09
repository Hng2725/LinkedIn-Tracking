import React, { useState, useMemo, useEffect } from 'react';
import { usePrivosContext, useLists, usePrivosApp } from '@privos/app-react';
import { Card, Avatar, Typography, DatePicker, Row, Col, Statistic, List, Space, Tag, Radio, Select, Divider, Segmented, Tabs, Input, Button } from 'antd';
import { UserOutlined, EyeOutlined, LikeOutlined, CommentOutlined, LinkOutlined, CrownOutlined, ThunderboltOutlined, FacebookOutlined, TwitterOutlined, LinkedinOutlined, DashboardOutlined, RobotOutlined, SendOutlined, SyncOutlined } from '@ant-design/icons';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import AIAssistantTab from './ai-assistant-tab';
import dayjs, { Dayjs } from 'dayjs';


const { Title, Text, Paragraph } = Typography;

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877f2', icon: <FacebookOutlined /> },
  { id: 'x', label: 'X (Twitter)', color: '#000000', icon: <TwitterOutlined /> },
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: <LinkedinOutlined /> }
] as const;

type PlatformId = typeof PLATFORMS[number]['id'];

const MOCK_ACCOUNTS = [
  {
    id: 'merve',
    name: 'Merve S. BUBLIS',
    avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQFwgjLdgucxVw/profile-displayphoto-scale_400_400/B4DZ3BGvSHHsAk-/0/1777061265216?e=1784764800&v=beta&t=p0YmkCfiXoakcZlBlNj6ZiehKclEdbRmkkPHuu2qRkE',
    platforms: {
      facebook: { username: '@merve.fb', bio: '', followers: 0, totalPosts: 0 },
      x: { username: '@merve_x', bio: '', followers: 0, totalPosts: 0 },
      linkedin: { username: 'in/merve-sumeyye-bublis-3984406a', bio: 'Co-Founder', followers: 0, totalPosts: 0 },
    }
  },
  {
    id: 'privos',
    name: 'PrivOS AI',
    avatar: 'https://pbs.twimg.com/profile_images/2013183029779288065/GlhEZQnx_400x400.jpg',
    platforms: {
      facebook: { username: 'privos', bio: '', followers: 0, totalPosts: 0 },
      x: { username: '@privos_ai', bio: '', followers: 0, totalPosts: 0 },
      linkedin: { username: 'in/privos', bio: 'Ai Operating System for Enterprises: Where Teams & AI Agents Collaborate', followers: 163, totalPosts: 8 },
    }
  }
];

const generateFakePosts = (accountId: string, platformId: PlatformId) => {
  const posts = [];
  const today = dayjs();
  for (let i = 0; i < 40; i++) {
    const date = today.subtract(i, 'day');
    const numPosts = Math.floor(Math.random() * 3);
    for (let j = 0; j < numPosts; j++) {
      const isMerve = accountId === 'merve';
      posts.push({
        id: `${accountId}-${platformId}-post-${i}-${j}`,
        date: date.format('YYYY-MM-DD'),
        views: Math.floor(Math.random() * 5000) + 1000,
        reacts: Math.floor(Math.random() * 800) + 50,
        comments: Math.floor(Math.random() * 100) + 5,
        reposts: Math.floor(Math.random() * 50) + 1,
        summary: isMerve
          ? `[${platformId.toUpperCase()}] Tech insight #${i}-${j}: Exploring new web technologies.`
          : `[${platformId.toUpperCase()}] AI update #${i}-${j}: Pushing boundaries with Agents.`,
        link: `https://example.com/post/${accountId}/${platformId}/${i}-${j}`
      });
    }
  }
  return posts;
};

const POSTS_DB: Record<string, any[]> = {
  'merve-facebook': [],
  'merve-x': [],
  'merve-linkedin': [],
  'privos-facebook': [],
  'privos-x': [],
  'privos-linkedin': [],
};

export default function SocialTrackerApp() {
  const { roomId } = usePrivosContext();
  const { data: lists, loading: listsLoading } = useLists(roomId);
  const app = usePrivosApp();

  const [selectedAccId, setSelectedAccId] = useState<string>('merve');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('linkedin');

  const [viewMode, setViewMode] = useState<'single' | 'range'>('range');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(35, 'day'), dayjs()]);
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'reacts' | 'comments'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [privosSocialList, setPrivosSocialList] = useState<any>(null);
  const [dummyItem, setDummyItem] = useState<any>(null);
  const [latestItems, setLatestItems] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedPosts, setSyncedPosts] = useState<any[]>([]);
  const [merveSyncedPosts, setMerveSyncedPosts] = useState<any[]>([]);

  const [debugInfo, setDebugInfo] = useState<string>('Đang khởi tạo...');
  const [privosStageId, setPrivosStageId] = useState<string | null>(null);
  const [merveStageId, setMerveStageId] = useState<string | null>(null);
  const [merveItem, setMerveItem] = useState<any>(null);
  const [privosFollowerItem, setPrivosFollowerItem] = useState<any>(null);
  const [merveFollowerItem, setMerveFollowerItem] = useState<any>(null);

  useEffect(() => {
    if (!lists || !app) {
      setDebugInfo(`lists=${!!lists}, app=${!!app}, listsLoading=${listsLoading}`);
      return;
    }

    const allListNames = lists.map((l: any) => l.name).join(', ');
    setDebugInfo(`Tìm thấy ${lists.length} list(s): [${allListNames}]`);

    const targetList = lists.find((l: any) => l.name === 'Tracking Data' || l.key === 'TRACKING_DATA');
    if (!targetList) {
      setDebugInfo(`Không tìm thấy "Tracking Data" trong ${lists.length} lists: [${allListNames}]`);
      return;
    }

    setPrivosSocialList(targetList);
    setDebugInfo(`✅ Tìm thấy list "${targetList.name}" (id=${targetList._id}). Đang getItems...`);

    app.callServerTool({
      name: 'privos.lists.get',
      arguments: { listId: targetList._id }
    }).then((listDetailsRes: any) => {
      let stages = [];
      if (listDetailsRes?.stages) {
        stages = listDetailsRes.stages;
      } else if (listDetailsRes?.content && Array.isArray(listDetailsRes.content)) {
        const textBlock = listDetailsRes.content.find((c: any) => c.type === 'text');
        if (textBlock) {
          try {
            const parsedList = JSON.parse(textBlock.text);
            if (parsedList.stages) stages = parsedList.stages;
            else if (parsedList.list?.stages) stages = parsedList.list.stages;
          } catch (e) { }
        }
      }
      targetList.stages = stages;

      return app.callServerTool({
        name: 'privos.lists.getItems',
        arguments: { listId: targetList._id, sortBy: 'createdAt', sortOrder: 'desc' }
      });
    }).then((res: any) => {
      let itemsList: any[] = [];

      if (res?.items) {
        itemsList = res.items;
      } else if (Array.isArray(res?.content)) {
        const textBlock = res.content.find((c: any) => c.type === 'text' && c.text);
        if (textBlock) {
          try {
            const parsed = JSON.parse(textBlock.text);
            itemsList = parsed?.items || (Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            itemsList = [];
          }
        }
        if (itemsList.length === 0 && res.content.every((c: any) => c._id)) {
          itemsList = res.content;
        }
      } else if (Array.isArray(res)) {
        itemsList = res;
      }

      setDebugInfo(`✅ getItems: parsed items=${itemsList.length}. Đầu: ${itemsList.slice(0, 8).map(i => `"${i.name || i.title}"`).join(', ')}`);
      setLatestItems(itemsList.slice(0, 5).map((i: any) => `${i.name || i.title}`));

      // Find the target stage ID
      let pStageId: string | null = null;
      let mStageId: string | null = null;

      const stageNames = (targetList.stages || []).map((s: any) => `"${s.name}"`).join(', ');

      if (targetList.stages && Array.isArray(targetList.stages)) {
        const pStage = targetList.stages.find((s: any) => s.name?.toLowerCase().includes('privos') || (s.name?.toLowerCase().includes('linkedin') && !s.name?.toLowerCase().includes('merve')));
        if (pStage) pStageId = pStage._id;

        const mStage = targetList.stages.find((s: any) => s.name?.toLowerCase().includes('merve'));
        if (mStage) mStageId = mStage._id;
      }

      // Fallback: discover stage IDs by inspecting the item names (strictly)
      itemsList.forEach((item: any) => {
        if (item.stageId) {
          const nameLower = (item.name || item.title || '').toLowerCase().trim();

          if (nameLower.includes('linkedin followers - merve') || nameLower === 'merve' || nameLower === 'test merve' || nameLower === 'merve linkedin') {
            if (!mStageId) mStageId = item.stageId;
          } else if (nameLower.includes('linkedin followers - privos') || nameLower === 'privos' || nameLower === 'test privos' || nameLower === 'privos linkedin') {
            if (!pStageId) pStageId = item.stageId;
          }
        }
      });

      setPrivosStageId(pStageId);
      setMerveStageId(mStageId);
      setMerveItem(null);

      setDebugInfo(prev => prev + ` | ✅ List "${targetList.name}". Stages: ${stageNames}. pStage=${pStageId?.slice(-4) || 'null'}, mStage=${mStageId?.slice(-4) || 'null'}`);

      setDummyItem(pStageId ? { _id: pStageId, isStage: true } : itemsList[0]);

      const loadedPosts: any[] = [];
      const mPosts: any[] = [];
      let pFollower: any = null;
      let mFollower: any = null;
      const foundNames: string[] = [];

      itemsList.forEach((item: any) => {
        let isFollowerItem = false;
        if (item.description) {
          try {
            const parsed = JSON.parse(item.description);
            if (parsed && typeof parsed === 'object' && parsed.type === 'followers') {
              if (parsed.id?.includes('merve')) mFollower = item;
              else pFollower = item;
              isFollowerItem = true;
            }
          } catch (e) {}
        }
        if (isFollowerItem) return;

        const isPrivos = pStageId ? item.stageId === pStageId : (!mStageId || item.stageId !== mStageId);
        const isMerve = mStageId && item.stageId === mStageId;
        if (!isPrivos && !isMerve) return;

        if (item.description) {
          try {
            const parsed = JSON.parse(item.description);
            if (Array.isArray(parsed) && parsed[0]?.summary === 'Test post') {
              app.callServerTool({ name: 'privos.lists.updateItem', arguments: { itemId: item._id, description: '' } }).catch(() => { });
              return;
            }

            if (Array.isArray(parsed)) {
              parsed.forEach(p => {
                p._privosItemId = item._id;
                if (p.id?.includes('merve')) mPosts.push(p);
                else loadedPosts.push(p);
              });
            } else if (parsed && typeof parsed === 'object') {
              parsed._privosItemId = item._id;

              if (parsed.id?.includes('merve') || (item.name || '').toLowerCase().includes('merve')) {
                mPosts.push(parsed);
              } else {
                loadedPosts.push(parsed);
              }
            }
          } catch (e) { }
        }
      });

      setPrivosFollowerItem(pFollower);
      setMerveFollowerItem(mFollower);

      if (loadedPosts.length > 0 || mPosts.length > 0) {
        loadedPosts.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
        mPosts.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
        setSyncedPosts(loadedPosts);
        setMerveSyncedPosts(mPosts);
        setDebugInfo(prev => prev + ` | ✅ Đã nạp ${loadedPosts.length} privos posts, ${mPosts.length} merve posts. pFollower=${!!pFollower}, mFollower=${!!mFollower}. Names: ${foundNames.join(', ')}`);
      } else {
        setDebugInfo(prev => prev + ` | ⚠️ Chưa có post nào được lưu độc lập. pFollower=${!!pFollower}, mFollower=${!!mFollower}. Names: ${foundNames.join(', ')}`);
      }
    }).catch((err: any) => {
      setDebugInfo(`❌ Lỗi getItems: ${err?.message || JSON.stringify(err)}`);
    });
  }, [lists, app]);

  const [syncDebug, setSyncDebug] = useState<string>('');

  const handleSyncData = async () => {
    if (!app || selectedPlatform !== 'linkedin') return;
    const isMerve = selectedAccId === 'merve';
    const isPrivos = selectedAccId === 'privos';
    if (!isMerve && !isPrivos) return;

    setIsSyncing(true);
    setSyncDebug(`Bắt đầu crawl cho ${selectedAccId}...`);
    try {
      const currentSynced = isMerve ? merveSyncedPosts : syncedPosts;
      setSyncDebug('Đang gọi crawl_linkedin...');
      const res: any = await app.callServerTool({
        name: 'crawl_linkedin',
        arguments: { accountId: selectedAccId, existingPosts: currentSynced }
      });
      setSyncDebug(`crawl_linkedin trả về: keys=${res ? Object.keys(res).join(',') : 'null'}, content?=${!!res?.content}, content[0]?.text length=${res?.content?.[0]?.text?.length || 0}`);

      if (res?.content?.[0]?.text) {
        const newData = res.content[0].text;
        let parsed: any;
        try { parsed = JSON.parse(newData); } catch (e) { parsed = null; }

        if (parsed?.error) {
          setSyncDebug(prev => prev + ` | ⚠️ Crawl error: ${parsed.error}`);
        } else if (parsed?.status === 'crawling') {
          setSyncDebug(prev => prev + ` | ⏳ ${parsed.message}`);
        } else if (parsed?.status === 'idle') {
          setSyncDebug(prev => prev + ` | ⏳ ${parsed.message}`);
        } else if (Array.isArray(parsed) || (parsed?.posts && Array.isArray(parsed.posts))) {
          const postsArray = Array.isArray(parsed) ? parsed : parsed.posts;
          const followers = Array.isArray(parsed) ? null : parsed.followers;

          if (postsArray.length === 0) {
            setSyncDebug(prev => prev + ` | ⚠️ Chưa có bài viết nào được tìm thấy trong cache.`);
            return;
          }

          setSyncDebug(prev => prev + ` | Parsed ${postsArray.length} posts${followers !== null ? ` (Followers: ${followers})` : ''}. Đang đồng bộ từng bài vào PrivOS...`);

          let created = 0, updated = 0;

          const stageId = isMerve ? merveStageId : privosStageId;

          if (!stageId) {
            setSyncDebug(prev => prev + ` | ⚠️ Không tìm thấy stage cho tài khoản ${selectedAccId}`);
            return;
          }

          if (followers !== null) {
            const existingFollowers = isMerve ? merveFollowerItem : privosFollowerItem;
            const followerJson = JSON.stringify({ type: 'followers', count: followers, date: new Date().toISOString().split('T')[0], id: `${selectedAccId}-followers` });
            const title = `[LinkedIn Followers - ${selectedAccId}] ${followers.toLocaleString()}`;

            if (existingFollowers?._id) {
              await app.callServerTool({
                name: 'privos.lists.updateItem',
                arguments: { itemId: existingFollowers._id, name: title, description: followerJson }
              });
              updated++;
            } else {
              const createRaw: any = await app.callServerTool({
                name: 'privos.lists.createItem',
                arguments: { listId: privosSocialList._id, title: title, description: followerJson }
              });

              let createdId = null;
              if (createRaw?._id) createdId = createRaw._id;
              else if (Array.isArray(createRaw?.content)) {
                const textBlock = createRaw.content.find((c: any) => c.type === 'text' && c.text);
                if (textBlock) {
                  try {
                    const parsedObj = JSON.parse(textBlock.text);
                    createdId = parsedObj._id || parsedObj.item?._id;
                  } catch (e) { }
                }
              }

              if (createdId && stageId) {
                await app.callServerTool({
                  name: 'privos.lists.moveItemToStage',
                  arguments: { itemId: createdId, stageId: stageId }
                });
              }
              created++;
            }
          }

          // For each post, we create or update an item in chunks to prevent timeout
          const CHUNK_SIZE = 5;
          let processedCount = 0;
          const validPosts = postsArray.filter((p: any) => p.id?.includes(selectedAccId));
          
          for (let i = 0; i < validPosts.length; i += CHUNK_SIZE) {
            const chunk = validPosts.slice(i, i + CHUNK_SIZE);
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(chunk.map(async (post: any) => {
              const existingPost = currentSynced.find(p => p.id === post.id);
              const postJson = JSON.stringify(post);
              const title = `[LinkedIn] ${post.summary.slice(0, 50)}`;

              if (existingPost?._privosItemId) {
                await app.callServerTool({
                  name: 'privos.lists.updateItem',
                  arguments: { itemId: existingPost._privosItemId, name: title, description: postJson }
                });
                updated++;
              } else {
                const createRaw: any = await app.callServerTool({
                  name: 'privos.lists.createItem',
                  arguments: { listId: privosSocialList._id, title: title, description: postJson }
                });

                let createdId = null;
                if (createRaw?._id) {
                  createdId = createRaw._id;
                } else if (Array.isArray(createRaw?.content)) {
                  const textBlock = createRaw.content.find((c: any) => c.type === 'text' && c.text);
                  if (textBlock) {
                    try {
                      const parsedObj = JSON.parse(textBlock.text);
                      createdId = parsedObj._id || parsedObj.item?._id;
                    } catch (e) { }
                  }
                }

                if (createdId && stageId) {
                  await app.callServerTool({
                    name: 'privos.lists.moveItemToStage',
                    arguments: { itemId: createdId, stageId: stageId }
                  });
                }
                created++;
              }
              processedCount++;
              setSyncDebug(`Đang đồng bộ bài ${processedCount}/${validPosts.length}...`);
            }));
          }

          setSyncDebug(prev => prev + ` | ✅ Đã đồng bộ: Tạo mới ${created}, Cập nhật ${updated} items. Xin tải lại trang để thấy kết quả.`);
        } else {
          setSyncDebug(prev => prev + ` | ⚠️ Crawl trả về data không hợp lệ: ${newData.slice(0, 200)}`);
        }
      } else {
        setSyncDebug(prev => prev + ' | ⚠️ Không có text trong response crawl!');
      }
    } catch (err: any) {
      setSyncDebug(`❌ Lỗi: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };


  const account = MOCK_ACCOUNTS.find(a => a.id === selectedAccId)!;
  const platformData = account.platforms[selectedPlatform];
  const activePlatform = PLATFORMS.find(p => p.id === selectedPlatform)!;

  // Calculate date constraints
  const minDate = dayjs().subtract(35, 'day');
  const maxDate = dayjs();

  const disabledDate = (current: Dayjs) => {
    return current && (current.valueOf() < minDate.startOf('day').valueOf() || current.valueOf() > maxDate.endOf('day').valueOf());
  };

  // Filter posts within date range
  const { filteredPosts, chartData, stats, topPosts, avgViews, engagementRate, currentFollowers } = useMemo(() => {
    let allPosts = [];
    if (selectedAccId === 'privos' && selectedPlatform === 'linkedin') {
      allPosts = syncedPosts;
    } else if (selectedAccId === 'merve' && selectedPlatform === 'linkedin') {
      allPosts = merveSyncedPosts;
    } else {
      const dbKey = `${selectedAccId}-${selectedPlatform}`;
      allPosts = POSTS_DB[dbKey] || [];
    }
    const mFollowerCount = merveFollowerItem?.description ? (() => { try { return JSON.parse(merveFollowerItem.description).count; } catch (e) { return null; } })() : null;
    const pFollowerCount = privosFollowerItem?.description ? (() => { try { return JSON.parse(privosFollowerItem.description).count; } catch (e) { return null; } })() : null;
    const currentFollowers = selectedAccId === 'merve' ? (mFollowerCount ?? platformData.followers) : (pFollowerCount ?? platformData.followers);

    if (!dateRange || !dateRange[0] || !dateRange[1]) return { filteredPosts: [], chartData: [], stats: { views: 0, reacts: 0, comments: 0, reposts: 0 }, topPosts: [], avgViews: 0, engagementRate: '0.0', currentFollowers };

    const startDate = dateRange[0];
    const endDate = dateRange[1];

    // Filter posts
    const currentPosts = allPosts.filter(p => {
      const pTime = dayjs(p.date).startOf('day').valueOf();
      const sTime = startDate.startOf('day').valueOf();
      const eTime = endDate.startOf('day').valueOf();
      return pTime >= sTime && pTime <= eTime;
    });

    // Sort posts
    currentPosts.sort((a, b) => {
      let valA = a[sortBy] as number | string;
      let valB = b[sortBy] as number | string;
      if (sortBy === 'date') {
        valA = dayjs(a.date).unix();
        valB = dayjs(b.date).unix();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate aggregated stats
    const totalStats = currentPosts.reduce((acc, curr) => {
      acc.views += curr.views || 0;
      acc.reacts += curr.reacts || 0;
      acc.comments += curr.comments || 0;
      acc.reposts += curr.reposts || 0;
      return acc;
    }, { views: 0, reacts: 0, comments: 0, reposts: 0 });

    const topPostsList = currentPosts.length > 0 ? [...currentPosts].sort((a, b) => ((b.reacts || 0) + (b.views || 0)) - ((a.reacts || 0) + (a.views || 0))).slice(0, 3) : [];
    const avgV = currentPosts.length > 0 ? Math.round(totalStats.views / currentPosts.length) : 0;
    const eRate = totalStats.views > 0 ? ((totalStats.reacts + totalStats.comments + totalStats.reposts) / totalStats.views * 100).toFixed(1) : '0.0';

    // Prepare chart data (group by day)
    const dailyDataMap = new Map();
    const daysDiff = endDate.diff(startDate, 'day');
    for (let i = 0; i <= daysDiff; i++) {
      const d = startDate.add(i, 'day').format('YYYY-MM-DD');
      dailyDataMap.set(d, { date: d, views: 0, reacts: 0, comments: 0, reposts: 0 });
    }

    currentPosts.forEach(p => {
      if (dailyDataMap.has(p.date)) {
        const item = dailyDataMap.get(p.date);
        item.views += p.views || 0;
        item.reacts += p.reacts || 0;
        item.comments += p.comments || 0;
        item.reposts += p.reposts || 0;
      }
    });

    const dailyChart = Array.from(dailyDataMap.values()).sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

    return { filteredPosts: currentPosts, chartData: dailyChart, stats: totalStats, topPosts: topPostsList, avgViews: avgV, engagementRate: eRate, currentFollowers };
  }, [selectedAccId, selectedPlatform, dateRange, sortBy, sortOrder, syncedPosts, merveSyncedPosts, merveFollowerItem, privosFollowerItem, platformData]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', background: '#f5f7fa', minHeight: '100vh', borderRadius: '8px' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 32, color: '#1890ff' }}>Multi-Platform KPI Tracker</Title>

      <Card size="small" style={{ marginBottom: 16, background: '#f0f0f0', border: '1px dashed #999' }}>
        <Text style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>🔍 DEBUG: {debugInfo}</Text>
      </Card>

      {privosSocialList ? (
        <Card style={{ marginBottom: 24, background: '#e6f4ff', borderColor: '#91caff' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {!merveStageId && selectedAccId === 'merve' && (
              <div style={{ background: '#fff2f0', color: '#ff4d4f', padding: '12px', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', border: '1px solid #ffccc7' }}>
                ⚠️ Chưa tìm thấy Stage Merve. Hãy tạo một thẻ (item) trong List này có tên chứa "Merve" để làm Stage, sau đó F5 trang. (Hãy nhìn vào dòng chữ "DEBUG: ..." ở khung xám bên trên xem có id stage nào được liệt kê không nhé!)
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#1677ff' }}>
                <RobotOutlined /> {
                  selectedAccId === 'merve' ? (merveStageId ? `Đã kết nối Stage Merve` : '⚠️ Chưa tìm thấy Stage Merve') :
                    selectedAccId === 'privos' ? (privosStageId ? `Đã kết nối Stage "PrivOS Linkedin"` : `Đã kết nối List "${privosSocialList.name}"`) :
                      `Đã kết nối List "${privosSocialList.name}"`
                }
              </Text>
              <Space direction="horizontal" wrap>
                <Button
                  type="primary"
                  disabled={selectedPlatform !== 'linkedin' || (selectedAccId !== 'privos' && selectedAccId !== 'merve')}
                  onClick={async () => {
                    if (!app) return;
                    setSyncDebug(`Đang gửi lệnh bắt đầu crawl cho ${selectedAccId}...`);
                    const url = selectedAccId === 'merve'
                      ? 'https://www.linkedin.com/in/merve-sumeyye-bublis-3984406a/recent-activity/all/'
                      : 'https://www.linkedin.com/company/privos/posts/?feedView=all&viewAsMember=true';
                    const res: any = await app.callServerTool({ name: 'trigger_crawl_linkedin', arguments: { url, accountId: selectedAccId } });
                    if (res?.content?.[0]?.text) {
                      const parsed = JSON.parse(res.content[0].text);
                      setSyncDebug(parsed.message || 'Đã gửi lệnh');
                    }
                  }}
                >
                  🚀 Bắt Đầu Crawl Ngầm
                </Button>
                <Button
                  onClick={handleSyncData}
                  loading={isSyncing}
                  disabled={selectedPlatform !== 'linkedin' || (selectedAccId !== 'privos' && selectedAccId !== 'merve')}
                >
                  <SyncOutlined spin={isSyncing} /> Cập nhật dữ liệu
                </Button>
              </Space>
            </div>
            {syncDebug && (
              <Text style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: '#666' }}>📋 SYNC: {syncDebug}</Text>
            )}
          </Space>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24, background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="warning">Không tìm thấy List "Tracking Data". Hãy bấm nút bên dưới để hệ thống tự động tạo List, Group Kanban và Item chuẩn xác nhất cho bạn!</Text>
            <Button
              type="primary"
              size="large"
              loading={isSyncing}
              onClick={async () => {
                if (!app || !roomId) return;
                try {
                  setIsSyncing(true);
                  // 1. Create List with Stage
                  const listRes: any = await app.callServerTool({
                    name: 'privos.lists.create',
                    arguments: {
                      roomId: roomId,
                      name: 'Tracking Data',
                      description: 'Auto-generated list for KPI Tracking',
                      stages: [{ name: 'PrivOS Linkedin', color: '#0a66c2' }]
                    }
                  });
                  // 2. Create Item
                  if (listRes?.list?._id) {
                    const itemRes: any = await app.callServerTool({
                      name: 'privos.lists.createItem',
                      arguments: {
                        listId: listRes.list._id,
                        title: 'dummy li privos',
                        description: ''
                      }
                    });

                    // 3. Move Item to Stage
                    if (itemRes?._id && listRes.stages && listRes.stages[0]) {
                      await app.callServerTool({
                        name: 'privos.lists.moveItemToStage',
                        arguments: { itemId: itemRes._id, stageId: listRes.stages[0]._id }
                      });
                    }
                  }
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  alert('Lỗi tạo tự động: ' + e);
                } finally {
                  setIsSyncing(false);
                }
              }}
            >
              🚀 Tự động thiết lập toàn bộ List & Item
            </Button>
          </Space>
        </Card>
      )}

      <Tabs
        defaultActiveKey="dashboard"
        items={[
          {
            key: 'dashboard',
            label: <span style={{ fontSize: 16 }}><DashboardOutlined /> KPI Dashboard</span>,
            children: (
              <>
                {/* Header: Platform & Account Switcher */}
                <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
                  <Row gutter={[24, 24]} align="middle" justify="space-between">
                    <Col xs={24} md={12}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text type="secondary" strong>Select Platform:</Text>
                        <Segmented
                          size="large"
                          value={selectedPlatform}
                          onChange={(val) => setSelectedPlatform(val as PlatformId)}
                          options={PLATFORMS.map(p => ({
                            label: (
                              <div style={{ padding: '4px 8px' }}>
                                <Space>
                                  <span style={{ color: p.color }}>{p.icon}</span>
                                  <span>{p.label}</span>
                                </Space>
                              </div>
                            ),
                            value: p.id,
                          }))}
                        />
                      </Space>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }} align="end">
                        <Text type="secondary" strong>Select Account:</Text>
                        <Segmented
                          size="large"
                          value={selectedAccId}
                          onChange={(val) => setSelectedAccId(val as string)}
                          options={MOCK_ACCOUNTS.map(a => ({
                            label: (
                              <div style={{ padding: '4px 8px' }}>
                                <Space>
                                  <Avatar size="small" src={a.avatar} />
                                  <span>{a.name}</span>
                                </Space>
                              </div>
                            ),
                            value: a.id,
                          }))}
                        />
                      </Space>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '24px 0' }} />

                  <Row gutter={[24, 24]} align="middle">
                    <Col xs={24}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        <Avatar size={100} src={account.avatar} style={{ border: `3px solid ${activePlatform.color}` }} />
                        <div>
                          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {account.name}
                            <span style={{ color: activePlatform.color, fontSize: 24, display: 'flex', alignItems: 'center' }}>{activePlatform.icon}</span>
                          </Title>
                          <Text type="secondary" style={{ fontSize: 18 }}>{platformData.username}</Text>
                          <Paragraph style={{ margin: '12px 0 0 0', color: '#666', fontSize: 16 }}>{platformData.bio}</Paragraph>
                          <Space size="large" style={{ marginTop: 12 }}>
                            <Text strong style={{ fontSize: 16 }}>{currentFollowers.toLocaleString()} <Text type="secondary" strong={false}>Followers</Text></Text>
                            <Text strong style={{ fontSize: 16 }}>{platformData.totalPosts.toLocaleString()} <Text type="secondary" strong={false}>Posts</Text></Text>
                          </Space>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* Filters & Summary Stats */}
                <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
                  <Row gutter={[24, 24]} align="middle">
                    <Col xs={24} md={8}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <Text strong>Timeframe:</Text>
                          <Radio.Group value={viewMode} onChange={e => {
                            setViewMode(e.target.value);
                            if (e.target.value === 'single') setDateRange([dayjs(), dayjs()]);
                            else setDateRange([dayjs().subtract(35, 'day'), dayjs()]);
                          }}>
                            <Radio.Button value="single">Single Day</Radio.Button>
                            <Radio.Button value="range">Date Range</Radio.Button>
                          </Radio.Group>
                        </Space>
                        {viewMode === 'single' ? (
                          <DatePicker
                            value={dateRange[0]}
                            onChange={(val) => val && setDateRange([val, val])}
                            disabledDate={disabledDate}
                            style={{ width: '100%', borderRadius: 6 }}
                            allowClear={false}
                          />
                        ) : (
                          <DatePicker.RangePicker
                            value={dateRange}
                            onChange={(vals) => {
                              if (vals && vals[0] && vals[1]) {
                                let start = vals[0];
                                let end = vals[1];
                                if (end.diff(start, 'day') > 35) {
                                  end = start.add(35, 'day');
                                }
                                setDateRange([start, end]);
                              }
                            }}
                            disabledDate={disabledDate}
                            style={{ width: '100%', borderRadius: 6 }}
                            allowClear={false}
                          />
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>Allowed: up to 35 days limit.</Text>
                      </Space>
                    </Col>
                    <Col xs={24} md={16}>
                      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fafafa', padding: '20px 0', borderRadius: 12, border: '1px solid #f0f0f0', width: '100%', boxSizing: 'border-box' }}>
                        <Statistic title="Total Views" value={stats.views} valueStyle={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }} prefix={<EyeOutlined />} style={{ flex: 1, textAlign: 'center' }} />
                        <Divider type="vertical" style={{ height: '50px' }} />
                        <Statistic title="Total Reacts" value={stats.reacts} valueStyle={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }} prefix={<LikeOutlined />} style={{ flex: 1, textAlign: 'center' }} />
                        <Divider type="vertical" style={{ height: '50px' }} />
                        <Statistic title="Total Comments" value={stats.comments} valueStyle={{ fontSize: 24, fontWeight: 600, color: '#faad14' }} prefix={<CommentOutlined />} style={{ flex: 1, textAlign: 'center' }} />
                        <Divider type="vertical" style={{ height: '50px' }} />
                        <Statistic title="Total Reposts" value={stats.reposts} valueStyle={{ fontSize: 24, fontWeight: 600, color: '#722ed1' }} prefix={<SendOutlined />} style={{ flex: 1, textAlign: 'center' }} />
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* Charts */}
                <Card title={`${activePlatform.label} Engagement`} style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
                  <div style={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer>
                      {viewMode === 'single' ? (
                        <BarChart data={[
                          { name: 'Views', value: stats.views, color: '#1890ff' },
                          { name: 'Reacts', value: stats.reacts, color: '#52c41a' },
                          { name: 'Comments', value: stats.comments, color: '#faad14' },
                          { name: 'Reposts', value: stats.reposts, color: '#722ed1' }
                        ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {
                              [
                                { name: 'Views', value: stats.views, color: '#1890ff' },
                                { name: 'Reacts', value: stats.reacts, color: '#52c41a' },
                                { name: 'Comments', value: stats.comments, color: '#faad14' },
                                { name: 'Reposts', value: stats.reposts, color: '#722ed1' }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorReacts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorComments" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#faad14" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#faad14" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorReposts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#722ed1" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#722ed1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(val) => dayjs(val).format('MMM DD')} />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Area type="monotone" dataKey="views" name="Views" stroke="#1890ff" fillOpacity={1} fill="url(#colorViews)" />
                          <Area type="monotone" dataKey="reacts" name="Reacts" stroke="#52c41a" fillOpacity={1} fill="url(#colorReacts)" />
                          <Area type="monotone" dataKey="comments" name="Comments" stroke="#faad14" fillOpacity={1} fill="url(#colorComments)" />
                          <Area type="monotone" dataKey="reposts" name="Reposts" stroke="#722ed1" fillOpacity={1} fill="url(#colorReposts)" />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={16}>
                    {/* Post List */}
                    <Card
                      title="Posts in selected period"
                      style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      bordered={false}
                      extra={
                        <Space>
                          <Text type="secondary">Sort by:</Text>
                          <Select value={sortBy} onChange={setSortBy} style={{ width: 120 }}>
                            <Select.Option value="date">Date</Select.Option>
                            <Select.Option value="views">Views</Select.Option>
                            <Select.Option value="reacts">Reacts</Select.Option>
                            <Select.Option value="comments">Comments</Select.Option>
                            <Select.Option value="reposts">Reposts</Select.Option>
                          </Select>
                          <Radio.Group value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                            <Radio.Button value="desc">Desc</Radio.Button>
                            <Radio.Button value="asc">Asc</Radio.Button>
                          </Radio.Group>
                        </Space>
                      }
                    >
                      <List
                        itemLayout="vertical"
                        dataSource={filteredPosts}
                        pagination={{ pageSize: 10, align: 'center' }}
                        renderItem={(item) => (
                          <List.Item
                            key={item.id}
                            style={{ borderBottom: '1px solid #f0f0f0', padding: '16px 0' }}
                            actions={[
                              <Space key="views"><EyeOutlined /> {item.views}</Space>,
                              <Space key="reacts"><LikeOutlined /> {item.reacts}</Space>,
                              <Space key="comments"><CommentOutlined /> {item.comments}</Space>,
                              <Space key="reposts"><SendOutlined /> {item.reposts}</Space>,
                              <a href={item.link} target="_blank" rel="noreferrer" key="link"><LinkOutlined /> View Original</a>
                            ]}
                          >
                            <List.Item.Meta
                              title={<Space><Tag color="blue">{item.date}</Tag></Space>}
                              description={<Text style={{ fontSize: 16, color: '#333' }}>{item.summary}</Text>}
                            />
                          </List.Item>
                        )}
                        locale={{ emptyText: 'No posts found in the selected period.' }}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} lg={8}>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {/* Insights Card */}
                      <Card title="Quick Insights" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
                        <Row gutter={[16, 16]}>
                          <Col span={12}>
                            <Statistic title="Avg Views / Post" value={avgViews} prefix={<EyeOutlined />} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="Engagement Rate" value={engagementRate} suffix="%" prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />} />
                          </Col>
                        </Row>
                      </Card>

                      {/* Top Post Card */}
                      {topPosts.length > 0 && (
                        <Card
                          title={<Space><CrownOutlined style={{ color: '#faad14' }} /> Top 3 Posts</Space>}
                          style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: 'linear-gradient(145deg, #fff9e6, #fff)' }}
                          bordered={false}
                        >
                          {topPosts.map((post, index) => (
                            <div key={post.id} style={{ marginBottom: index !== topPosts.length - 1 ? 16 : 0 }}>
                              <Space style={{ marginBottom: 8 }}>
                                <Tag color={index === 0 ? "gold" : index === 1 ? "silver" : "orange"}>Top {index + 1}</Tag>
                                <Text type="secondary">{post.date}</Text>
                              </Space>
                              <Paragraph strong style={{ fontSize: 14, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.summary}</Paragraph>
                              <Space size="middle" style={{ fontSize: 12 }}>
                                <Text><EyeOutlined /> {post.views}</Text>
                                <Text><LikeOutlined /> {post.reacts}</Text>
                                <Text><CommentOutlined /> {post.comments}</Text>
                                <Text><SendOutlined /> {post.reposts}</Text>
                                <a href={post.link} target="_blank" rel="noreferrer"><LinkOutlined /></a>
                              </Space>
                              {index !== topPosts.length - 1 && <Divider style={{ margin: '12px 0' }} />}
                            </div>
                          ))}
                        </Card>
                      )}
                    </Space>
                  </Col>
                </Row>
              </>
            )
          },
          {
            key: 'chat',
            label: <span style={{ fontSize: 16 }}><RobotOutlined /> AI Assistant</span>,
            children: (
              <AIAssistantTab />
            )
          }
        ]}
      />
    </div>
  );
}
