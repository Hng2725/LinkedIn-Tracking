import React, { useState, useEffect, useMemo } from 'react';
import { usePrivosContext, useLists, usePrivosApp } from '@privos/app-react';
import {
  Card, Avatar, Typography, Button, Row, Col,
  Progress, Tag, Tooltip, DatePicker, Radio,
  Space, Modal, Slider, InputNumber, notification, Segmented
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  EyeOutlined, LikeOutlined, CommentOutlined, FileTextOutlined,
  DownloadOutlined, AimOutlined,
  CheckCircleOutlined, SyncOutlined,
  LinkedinOutlined, FacebookOutlined, TwitterOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
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
type WeeklyStats = typeof MOCK_THIS_WEEK;
type AccountId = 'privos' | 'merve';
type ComparisonViewMode = 'single' | 'range';
type ComparisonRange = [Dayjs, Dayjs];
type GoalMetric = 'posts' | 'views' | 'reacts' | 'comments' | 'reposts';
const EMPTY_WEEK_STATS: WeeklyStats = {
  posts: 0,
  views: 0,
  reacts: 0,
  comments: 0,
  reposts: 0,
  engagementRate: 0,
  avgViews: 0,
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
const calcWeeklyStats = (posts: any[], start: Dayjs, end: Dayjs): WeeklyStats => {
  const inRange = posts.filter((post) => {
    const postDate = dayjs(post.date || post.createdAt);
    if (!postDate.isValid()) return false;
    return postDate.valueOf() >= start.valueOf() && postDate.valueOf() <= end.valueOf();
  });
  const totals = inRange.reduce((acc, post) => ({
    views: acc.views + (Number(post.views) || 0),
    reacts: acc.reacts + (Number(post.reacts) || 0),
    comments: acc.comments + (Number(post.comments) || 0),
    reposts: acc.reposts + (Number(post.reposts) || 0),
  }), { views: 0, reacts: 0, comments: 0, reposts: 0 });
  const postsCount = inRange.length;
  const interactions = totals.reacts + totals.comments + totals.reposts;
  const engagementRate = totals.views > 0
    ? Number(((interactions / totals.views) * 100).toFixed(1))
    : postsCount > 0
      ? Number(((interactions / postsCount) * 100).toFixed(1))
      : 0;
  return {
    posts: postsCount,
    views: totals.views,
    reacts: totals.reacts,
    comments: totals.comments,
    reposts: totals.reposts,
    engagementRate,
    avgViews: postsCount > 0 ? Math.round(totals.views / postsCount) : 0,
  };
};
const buildComparisonChartData = (current: WeeklyStats, baseline: WeeklyStats) => [
  { metric: 'Posts', tuanNay: current.posts, tuanTruoc: baseline.posts, tuanNayRaw: current.posts, tuanTruocRaw: baseline.posts },
  { metric: 'Views', tuanNay: Math.round(current.views / 100), tuanTruoc: Math.round(baseline.views / 100), tuanNayRaw: current.views, tuanTruocRaw: baseline.views },
  { metric: 'Reacts', tuanNay: current.reacts, tuanTruoc: baseline.reacts, tuanNayRaw: current.reacts, tuanTruocRaw: baseline.reacts },
  { metric: 'Comments', tuanNay: current.comments, tuanTruoc: baseline.comments, tuanNayRaw: current.comments, tuanTruocRaw: baseline.comments },
  { metric: 'Reposts', tuanNay: current.reposts, tuanTruoc: baseline.reposts, tuanNayRaw: current.reposts, tuanTruocRaw: baseline.reposts },
];

const formatRangeLabel = (range: ComparisonRange) => {
  const [start, end] = range;
  if (start.isSame(end, 'day')) return start.format('MMM D, YYYY');
  return start.format('MMM D') + ' - ' + end.format('MMM D, YYYY');
};
const normalizeRange = (range: ComparisonRange): ComparisonRange => [range[0].startOf('day'), range[1].endOf('day')];

const WEEKLY_COMPARISON_CHART = [
  { metric: 'Posts', tuanNay: MOCK_THIS_WEEK.posts * 200, tuanTruoc: MOCK_LAST_WEEK.posts * 200, tuanNayRaw: MOCK_THIS_WEEK.posts, tuanTruocRaw: MOCK_LAST_WEEK.posts },
  { metric: 'Views', tuanNay: MOCK_THIS_WEEK.views, tuanTruoc: MOCK_LAST_WEEK.views, tuanNayRaw: MOCK_THIS_WEEK.views, tuanTruocRaw: MOCK_LAST_WEEK.views },
  { metric: 'Reacts', tuanNay: MOCK_THIS_WEEK.reacts * 10, tuanTruoc: MOCK_LAST_WEEK.reacts * 10, tuanNayRaw: MOCK_THIS_WEEK.reacts, tuanTruocRaw: MOCK_LAST_WEEK.reacts },
  { metric: 'Comments', tuanNay: MOCK_THIS_WEEK.comments * 30, tuanTruoc: MOCK_LAST_WEEK.comments * 30, tuanNayRaw: MOCK_THIS_WEEK.comments, tuanTruocRaw: MOCK_LAST_WEEK.comments },
];

// ─── HEALTH SCORE LOGIC ───────────────────────────────────────────────────────
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

function scoreColor(score: number) {
  if (score >= 75) return '#52c41a';
  if (score >= 50) return '#faad14';
  return '#ff4d4f';
}

function scoreLabel(score: number) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs improvement';
}

function buildRadarData(periodA: typeof MOCK_THIS_WEEK, periodB: typeof MOCK_LAST_WEEK) {
  const scalePair = (a: number, b: number) => {
    const max = Math.max(a, b);
    if (max <= 0) return { A: 0, B: 0 };
    return {
      A: Math.round((a / max) * 100),
      B: Math.round((b / max) * 100),
    };
  };

  const rows = [
    { subject: 'Frequency', rawA: periodA.posts, rawB: periodB.posts },
    { subject: 'Engagement', rawA: periodA.engagementRate, rawB: periodB.engagementRate, suffix: '%' },
    { subject: 'Views', rawA: periodA.views, rawB: periodB.views },
    { subject: 'Reacts', rawA: periodA.reacts, rawB: periodB.reacts },
    { subject: 'Comments', rawA: periodA.comments, rawB: periodB.comments },
  ];

  return rows.map((row) => {
    const scaled = scalePair(row.rawA, row.rawB);
    return {
      subject: row.subject,
      A: scaled.A,
      B: scaled.B,
      ARaw: row.rawA,
      BRaw: row.rawB,
      suffix: row.suffix || '',
    };
  });
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = previous > 0 ? ((current - previous) / previous * 100) : 0;
  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.5;
  return (
    <Tag
      icon={isFlat ? <MinusOutlined /> : isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      color={isFlat ? 'default' : isUp ? 'success' : 'error'}
      style={{ fontSize: 12, fontWeight: 600 }}
    >
      {isFlat ? '0%' : `${isUp ? '+' : ''}${delta.toFixed(1)}%`}
    </Tag>
  );
}

// ─── CUSTOM TOOLTIP FOR BAR CHART ─────────────────────────────────────────────
const CustomRadarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload;
    const suffix = d?.suffix || '';
    return (
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Text strong style={{ fontSize: 13 }}>{label}</Text>
        <div style={{ marginTop: 6 }}>
          <div style={{ color: '#1890ff' }}>Period A: <strong>{Number(d?.ARaw ?? 0).toLocaleString()}{suffix}</strong></div>
          <div style={{ color: '#b37feb' }}>Period B: <strong>{Number(d?.BRaw ?? 0).toLocaleString()}{suffix}</strong></div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload;
    return (
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Text strong style={{ fontSize: 13 }}>{label}</Text>
        <div style={{ marginTop: 6 }}>
          <div style={{ color: '#1890ff' }}>Period A: <strong>{Number(d?.tuanNayRaw ?? d?.tuanNay ?? 0).toLocaleString()}</strong></div>
          <div style={{ color: '#b37feb' }}>Period B: <strong>{Number(d?.tuanTruocRaw ?? d?.tuanTruoc ?? 0).toLocaleString()}</strong></div>
        </div>
      </div>
    );
  }
  return null;
};

// MAIN COMPONENT
export default function AnalysisTab() {
  const { roomId } = usePrivosContext();
  const { data: lists } = useLists(roomId);
  const app = usePrivosApp();
  const [activeAccount, setActiveAccount] = useState<'privos' | 'merve'>('privos');
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalMetric, setGoalMetric] = useState<GoalMetric>('reacts');
  const [goalTarget, setGoalTarget] = useState(100);
  const [goalSet, setGoalSet] = useState(false);
  const [realPostsByAccount, setRealPostsByAccount] = useState<Record<AccountId, any[]>>({ privos: [], merve: [] });
  const [comparisonModeA, setComparisonModeA] = useState<ComparisonViewMode>('range');
  const [comparisonModeB, setComparisonModeB] = useState<ComparisonViewMode>('range');
  const [comparisonRangeA, setComparisonRangeA] = useState<ComparisonRange>([dayjs().subtract(6, 'day'), dayjs()]);
  const [comparisonRangeB, setComparisonRangeB] = useState<ComparisonRange>([dayjs().subtract(13, 'day'), dayjs().subtract(7, 'day')]);
  const thisWeek = activeAccount === 'privos' ? MOCK_PRIVOS.thisWeek : MOCK_MERVE.thisWeek;
  const lastWeek = activeAccount === 'privos' ? MOCK_PRIVOS.lastWeek : MOCK_MERVE.lastWeek;
  const accountPosts = realPostsByAccount[activeAccount];
  const normalizedRangeA = useMemo(() => normalizeRange(comparisonRangeA), [comparisonRangeA]);
  const normalizedRangeB = useMemo(() => normalizeRange(comparisonRangeB), [comparisonRangeB]);
  const comparisonThisWeek = useMemo(
    () => calcWeeklyStats(accountPosts, normalizedRangeA[0], normalizedRangeA[1]),
    [accountPosts, normalizedRangeA]
  );
  const comparisonLastWeek = useMemo(
    () => calcWeeklyStats(accountPosts, normalizedRangeB[0], normalizedRangeB[1]),
    [accountPosts, normalizedRangeB]
  );
  const comparisonLabelA = formatRangeLabel(comparisonRangeA);
  const comparisonLabelB = formatRangeLabel(comparisonRangeB);
  const { score, breakdown } = useMemo(() => calcHealthScore(thisWeek, lastWeek), [thisWeek, lastWeek]);
  const radarData = buildRadarData(comparisonThisWeek, comparisonLastWeek);
  const compChartData = useMemo(
    () => buildComparisonChartData(comparisonThisWeek, comparisonLastWeek),
    [comparisonThisWeek, comparisonLastWeek]
  );
  const minComparisonDate = dayjs().subtract(35, 'day').startOf('day');
  const maxComparisonDate = dayjs().endOf('day');
  const disabledComparisonDate = (current: Dayjs) => {
    return current && (current.valueOf() < minComparisonDate.valueOf() || current.valueOf() > maxComparisonDate.valueOf());
  };

  useEffect(() => {
    if (!lists || !app) return;
    let cancelled = false;
    const loadRealWeeklyStats = async () => {
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
      allItems.forEach((item: any) => {
        const itemName = normalizeName(item?.name || item?.title);
        if (!item.stageId) return;
        if (itemName === 'privos linkedin') privosStageId = item.stageId;
        if (itemName === 'merve linkedin') merveStageId = item.stageId;
      });
      const postsByAccount: Record<AccountId, any[]> = { privos: [], merve: [] };
      allItems.forEach((item: any) => {
        if (!item.stageId || isNumericOnlyItem(item) || isStageMarker(item)) return;
        const account: AccountId | null = item.stageId === privosStageId
          ? 'privos'
          : item.stageId === merveStageId
            ? 'merve'
            : null;
        if (!account) return;
        const pushPost = (post: any) => {
          if (!post || post.type === 'followers') return;
          postsByAccount[account].push({
            ...post,
            date: post.date || item.createdAt,
            createdAt: post.createdAt || item.createdAt,
          });
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
      if (!cancelled) {
        setRealPostsByAccount(postsByAccount);
      }
    };
    loadRealWeeklyStats().catch(() => {
      if (!cancelled) {
        setRealPostsByAccount({ privos: [], merve: [] });
      }
    });
    return () => { cancelled = true; };
  }, [lists, app]);
  const handleExportPDF = () => {
    notification.success({
      message: 'PDF report exported',
      description: `Weekly Health Report - ${activeAccount === 'privos' ? 'PrivOS AI' : 'Merve'} - Score: ${score}/100`,
      icon: <DownloadOutlined style={{ color: '#52c41a' }} />,
      duration: 3,
    });
  };

  const color = scoreColor(score);
  const GOAL_METRICS: { id: GoalMetric; label: string; unit: string; presets: number[]; min: number; max: number; step: number }[] = [
    { id: 'posts', label: 'Posts', unit: 'posts/week', presets: [5, 10, 20, 50], min: 1, max: 100, step: 1 },
    { id: 'views', label: 'Views', unit: 'views/week', presets: [50, 100, 200, 500, 1000], min: 10, max: 5000, step: 10 },
    { id: 'reacts', label: 'Reacts', unit: 'reacts/week', presets: [50, 100, 200, 500], min: 10, max: 2000, step: 10 },
    { id: 'comments', label: 'Comments', unit: 'comments/week', presets: [10, 20, 50, 100, 200], min: 1, max: 1000, step: 1 },
    { id: 'reposts', label: 'Reposts', unit: 'reposts/week', presets: [5, 10, 20, 50, 100], min: 1, max: 500, step: 1 },
  ];
  const activeGoalConfig = GOAL_METRICS.find(metric => metric.id === goalMetric)!;
  const currentGoalValue = thisWeek[goalMetric];
  const goalProgress = goalTarget > 0 ? Math.min(100, Math.round(currentGoalValue / goalTarget * 100)) : 0;

  const PLATFORMS = [
    { id: 'facebook', label: 'Facebook', color: '#1877f2', icon: <FacebookOutlined /> },
    { id: 'x', label: 'X (Twitter)', color: '#000', icon: <TwitterOutlined /> },
    { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: <LinkedinOutlined /> },
  ];
  const ACCOUNTS = [
    { id: 'merve', label: 'Merve S. BUBLIS', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQFwgjLdgucxVw/profile-displayphoto-scale_400_400/B4DZ3BGvSHHsAk-/0/1777061265216?e=1784764800&v=beta&t=p0YmkCfiXoakcZlBlNj6ZiehKclEdbRmkkPHuu2qRkE' },
    { id: 'privos', label: 'PrivOS AI', avatar: 'https://pbs.twimg.com/profile_images/2013183029779288065/GlhEZQnx_400x400.jpg' },
  ];
  const renderComparisonPicker = (
    title: string,
    mode: ComparisonViewMode,
    setMode: (mode: ComparisonViewMode) => void,
    range: ComparisonRange,
    setRange: (range: ComparisonRange) => void,
  ) => (
    <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 12, padding: 14, height: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Text strong>{title}</Text>
          <Radio.Group
            size="small"
            value={mode}
            onChange={e => {
              const nextMode = e.target.value as ComparisonViewMode;
              setMode(nextMode);
              if (nextMode === 'single') setRange([range[1], range[1]]);
            }}
          >
            <Radio.Button value="single">Single Day</Radio.Button>
            <Radio.Button value="range">Date Range</Radio.Button>
          </Radio.Group>
        </div>
        {mode === 'single' ? (
          <DatePicker
            value={range[0]}
            onChange={(val) => val && setRange([val, val])}
            disabledDate={disabledComparisonDate}
            style={{ width: '100%', borderRadius: 6 }}
            allowClear={false}
          />
        ) : (
          <DatePicker.RangePicker
            value={range}
            onChange={(vals) => {
              if (vals && vals[0] && vals[1]) {
                let start = vals[0];
                let end = vals[1];
                if (end.diff(start, 'day') > 35) end = start.add(35, 'day');
                setRange([start, end]);
              }
            }}
            disabledDate={disabledComparisonDate}
            style={{ width: '100%', borderRadius: 6 }}
            allowClear={false}
          />
        )}
      </Space>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* HEADER: Platform + Account */}
      <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
        <Row gutter={[24, 24]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Typography.Text type="secondary" strong>Select Platform:</Typography.Text>
              <Segmented
                size="large"
                value="linkedin"
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
              <Typography.Text type="secondary" strong>Select Account:</Typography.Text>
              <Segmented
                size="large"
                value={activeAccount}
                onChange={(val) => setActiveAccount(val as 'privos' | 'merve')}
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
          </Col>
        </Row>
      </Card>

      {/* SECTION 1: Engagement Comparison */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 22, background: 'linear-gradient(180deg,#1890ff,#722ed1)', borderRadius: 2 }} />
            <Title level={4} style={{ margin: 0 }}>Engagement Comparison by Time Period</Title>
          </div>
          <Space>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportPDF} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8 }}>
              Export PDF
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 32, paddingBottom: 4 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {renderComparisonPicker('Period A', comparisonModeA, setComparisonModeA, comparisonRangeA, setComparisonRangeA)}
            </Col>
            <Col xs={24} md={12}>
              {renderComparisonPicker('Period B', comparisonModeB, setComparisonModeB, comparisonRangeB, setComparisonRangeB)}
            </Col>
          </Row>
        </div>

        <div style={{ clear: 'both', marginTop: 0, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {[
            { label: 'Posts', cur: comparisonThisWeek.posts, prev: comparisonLastWeek.posts, icon: <FileTextOutlined />, color: '#722ed1' },
            { label: 'Views', cur: comparisonThisWeek.views, prev: comparisonLastWeek.views, icon: <EyeOutlined />, color: '#1890ff' },
            { label: 'Reacts', cur: comparisonThisWeek.reacts, prev: comparisonLastWeek.reacts, icon: <LikeOutlined />, color: '#52c41a' },
            { label: 'Comments', cur: comparisonThisWeek.comments, prev: comparisonLastWeek.comments, icon: <CommentOutlined />, color: '#faad14' },
            { label: 'Reposts', cur: comparisonThisWeek.reposts, prev: comparisonLastWeek.reposts, icon: <SyncOutlined />, color: '#eb2f96' },
          ].map(item => (
            <div key={item.label}>
              <div style={{
                background: `linear-gradient(135deg, ${item.color}12, ${item.color}06)`,
                border: `1px solid ${item.color}30`,
                borderRadius: 14,
                padding: '16px 14px',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                <div style={{ fontSize: 22, color: item.color, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2 }}>{item.cur.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>{item.label}</div>
                <DeltaBadge current={item.cur} previous={item.prev} />
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Period B: {item.prev.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={15}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#555' }}>Comparison chart</Text>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={compChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={20} barCategoryGap="25%">
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} padding={{ left: 20, right: 20 }} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomBarTooltip />} />
                <Legend />
                <Bar dataKey="tuanNay" name={comparisonLabelA} fill="#1890ff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="tuanTruoc" name={comparisonLabelB} fill="#b37feb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Col>
          <Col xs={24} md={9}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#555' }}>Comparison radar</Text>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <RechartsTooltip content={<CustomRadarTooltip />} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name={comparisonLabelA} dataKey="A" stroke="#1890ff" fill="#1890ff" fillOpacity={0.35} />
                <Radar name={comparisonLabelB} dataKey="B" stroke="#b37feb" fill="#b37feb" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>

      {/* SECTION 2: Weekly Health Score */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 22, background: 'linear-gradient(180deg,#52c41a,#faad14)', borderRadius: 2 }} />
            <Title level={4} style={{ margin: 0 }}>Weekly Health Score</Title>
          </div>
          <Tooltip title="Set next KPI goal">
            <Button icon={<AimOutlined />} onClick={() => setGoalModalOpen(true)} style={{ color: '#1890ff', borderColor: '#1890ff', borderRadius: 8 }}>
              Goal
            </Button>
          </Tooltip>
        </div>

        <Row gutter={[32, 24]} align="middle">
          <Col xs={24} md={8} style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Progress
                type="circle"
                percent={score}
                size={170}
                strokeColor={{ '0%': '#ff4d4f', '50%': '#faad14', '100%': '#52c41a' }}
                strokeWidth={10}
                trailColor="#f0f0f0"
                format={() => (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1.1 }}>{score}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>/ 100</div>
                  </div>
                )}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <Tag color={score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error'} style={{ fontSize: 14, padding: '4px 16px', borderRadius: 20, fontWeight: 600 }}>
                {scoreLabel(score)}
              </Tag>
            </div>
            {goalSet && (
              <div style={{ marginTop: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 12px' }}>
                <Text style={{ fontSize: 12 }}>
                  <AimOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                  Goal: {goalTarget.toLocaleString()} {activeGoalConfig.unit}
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Progress percent={goalProgress} size="small" strokeColor="#52c41a" showInfo={false} />
                  <Text style={{ fontSize: 11, color: '#666' }}>{goalProgress}% of goal - current {activeGoalConfig.label.toLowerCase()}: {currentGoalValue.toLocaleString()}</Text>
                </div>
              </div>
            )}
          </Col>

          <Col xs={24} md={16}>
            <Text strong style={{ color: '#555', display: 'block', marginBottom: 14 }}>Score breakdown:</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {breakdown.map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#333' }}>{item.label}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={item.earned === item.max ? 'success' : item.earned > item.max / 2 ? 'warning' : 'error'} style={{ margin: 0, fontSize: 12 }}>
                        {item.earned}/{item.max} pts
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.note}</Text>
                    </div>
                  </div>
                  <Progress
                    percent={Math.round(item.earned / item.max * 100)}
                    showInfo={false}
                    size="small"
                    strokeColor={item.earned === item.max ? '#52c41a' : item.earned > item.max / 2 ? '#faad14' : '#ff4d4f'}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, background: '#f8f9ff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e8ecff' }}>
              <Text strong style={{ fontSize: 12, color: '#666' }}>Scoring rules:</Text>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {[
                  ['Frequency (30pts)', '3+ posts=30 | 1-2=15 | 0=0'],
                  ['Engagement (30pts)', '>5%=30 | 2-5%=18 | <2%=5'],
                  ['Avg Views (20pts)', '>1000=20 | 500-1000=12 | <500=5'],
                  ['Growth (20pts)', '>10%=20 | 0-10%=10 | decline=0'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <Text style={{ fontSize: 11, color: '#888' }}><strong>{k}</strong>: {v}</Text>
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>
      </Card>
      {/* GOAL MODAL */}
      <Modal
        title={<><AimOutlined style={{ color: '#1890ff', marginRight: 8 }} />Set Next KPI Goal</>}
        open={goalModalOpen}
        onCancel={() => setGoalModalOpen(false)}
        onOk={() => {
          setGoalSet(true);
          setGoalModalOpen(false);
          notification.success({ message: `Goal set: ${goalTarget.toLocaleString()} ${activeGoalConfig.unit}`, duration: 3 });
        }}
        okText="Confirm"
        cancelText="Cancel"
      >
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
            Choose a weekly KPI goal. Use smaller targets like 50, 100, or 200 for quick tracking.
          </Text>
          <div style={{ marginBottom: 18 }}>
            <Text strong>Metric:</Text>
            <Segmented
              block
              value={goalMetric}
              onChange={(value) => {
                const nextMetric = value as GoalMetric;
                const nextConfig = GOAL_METRICS.find(metric => metric.id === nextMetric)!;
                setGoalMetric(nextMetric);
                setGoalTarget(nextConfig.presets[1] || nextConfig.min);
              }}
              options={GOAL_METRICS.map(metric => ({ label: metric.label, value: metric.id }))}
              style={{ marginTop: 10 }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <Text strong>{activeGoalConfig.label} goal / week:</Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, marginBottom: 12 }}>
              {activeGoalConfig.presets.map(value => (
                <Button
                  key={value}
                  size="small"
                  type={goalTarget === value ? 'primary' : 'default'}
                  onClick={() => setGoalTarget(value)}
                >
                  {value.toLocaleString()}
                </Button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider min={activeGoalConfig.min} max={activeGoalConfig.max} step={activeGoalConfig.step} value={goalTarget} onChange={setGoalTarget} style={{ flex: 1 }} />
              <InputNumber min={activeGoalConfig.min} max={activeGoalConfig.max} step={activeGoalConfig.step} value={goalTarget} onChange={v => typeof v === 'number' && setGoalTarget(v)} style={{ width: 110 }} />
            </div>
          </div>
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '12px 16px' }}>
            <Text style={{ fontSize: 13 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
              Current {activeGoalConfig.label.toLowerCase()}: <strong>{currentGoalValue.toLocaleString()}</strong>.
              {' '}Goal <strong>{goalTarget.toLocaleString()}</strong> needs{' '}
              <strong style={{ color: goalTarget > currentGoalValue ? '#ff4d4f' : '#52c41a' }}>
                {goalTarget > currentGoalValue ? '+' + (goalTarget - currentGoalValue).toLocaleString() : 'Reached'}
              </strong>
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
}
