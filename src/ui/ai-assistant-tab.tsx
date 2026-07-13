import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Card, Avatar, Typography, Input, Button, Row, Col,
  Progress, Tag, Divider, Tooltip,
  Space, Modal, Slider, InputNumber, notification, Segmented
} from 'antd';
import {
  RobotOutlined, SendOutlined, UserOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  EyeOutlined, LikeOutlined, CommentOutlined, FileTextOutlined,
  DownloadOutlined, AimOutlined,
  CheckCircleOutlined, SyncOutlined, BulbOutlined,
  LinkedinOutlined, FacebookOutlined, TwitterOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const { Title, Text, Paragraph } = Typography;

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

const WEEKLY_COMPARISON_CHART = [
  { metric: 'Bài đăng', tuanNay: MOCK_THIS_WEEK.posts * 200, tuanTruoc: MOCK_LAST_WEEK.posts * 200, tuanNayRaw: MOCK_THIS_WEEK.posts, tuanTruocRaw: MOCK_LAST_WEEK.posts },
  { metric: 'Views', tuanNay: MOCK_THIS_WEEK.views, tuanTruoc: MOCK_LAST_WEEK.views, tuanNayRaw: MOCK_THIS_WEEK.views, tuanTruocRaw: MOCK_LAST_WEEK.views },
  { metric: 'Reacts', tuanNay: MOCK_THIS_WEEK.reacts * 10, tuanTruoc: MOCK_LAST_WEEK.reacts * 10, tuanNayRaw: MOCK_THIS_WEEK.reacts, tuanTruocRaw: MOCK_LAST_WEEK.reacts },
  { metric: 'Comments', tuanNay: MOCK_THIS_WEEK.comments * 30, tuanTruoc: MOCK_LAST_WEEK.comments * 30, tuanNayRaw: MOCK_THIS_WEEK.comments, tuanTruocRaw: MOCK_LAST_WEEK.comments },
];

// ─── HEALTH SCORE LOGIC ───────────────────────────────────────────────────────
function calcHealthScore(data: typeof MOCK_THIS_WEEK, lastData: typeof MOCK_LAST_WEEK) {
  let score = 0;
  const breakdown: { label: string; earned: number; max: number; note: string }[] = [];

  // 1. Post frequency (30pts)
  const postPts = data.posts >= 3 ? 30 : data.posts >= 1 ? 15 : 0;
  breakdown.push({ label: 'Tần suất đăng bài', earned: postPts, max: 30, note: data.posts >= 3 ? '≥3 bài/tuần 🔥' : data.posts >= 1 ? '1-2 bài/tuần' : 'Không có bài' });
  score += postPts;

  // 2. Engagement rate (30pts)
  const engPts = data.engagementRate > 5 ? 30 : data.engagementRate >= 2 ? 18 : 5;
  breakdown.push({ label: 'Engagement Rate', earned: engPts, max: 30, note: `${data.engagementRate}% ${data.engagementRate > 5 ? '🏆' : data.engagementRate >= 2 ? '✓' : '⚠️'}` });
  score += engPts;

  // 3. Avg views (20pts)
  const viewPts = data.avgViews > 1000 ? 20 : data.avgViews >= 500 ? 12 : 5;
  breakdown.push({ label: 'Lượt xem TB / bài', earned: viewPts, max: 20, note: `${data.avgViews.toLocaleString()} views` });
  score += viewPts;

  // 4. Growth vs last week (20pts)
  const growth = lastData.views > 0 ? ((data.views - lastData.views) / lastData.views) * 100 : 0;
  const growthPts = growth > 10 ? 20 : growth >= 0 ? 10 : 0;
  breakdown.push({ label: 'Tăng trưởng tuần', earned: growthPts, max: 20, note: `${growth > 0 ? '+' : ''}${growth.toFixed(1)}% so tuần trước` });
  score += growthPts;

  return { score, breakdown };
}

// ─── SCORE COLOR ─────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 75) return '#52c41a';
  if (score >= 50) return '#faad14';
  return '#ff4d4f';
}

function scoreLabel(score: number) {
  if (score >= 85) return 'Xuất sắc 🏆';
  if (score >= 70) return 'Tốt 👍';
  if (score >= 50) return 'Trung bình 📈';
  return 'Cần cải thiện ⚠️';
}

// ─── AI COMMENT GENERATOR ─────────────────────────────────────────────────────
function generateAIComment(thisWeek: typeof MOCK_THIS_WEEK, lastWeek: typeof MOCK_LAST_WEEK, score: number): string {
  const viewGrowth = ((thisWeek.views - lastWeek.views) / (lastWeek.views || 1) * 100).toFixed(1);
  const reactGrowth = ((thisWeek.reacts - lastWeek.reacts) / (lastWeek.reacts || 1) * 100).toFixed(1);
  const lines: string[] = [];

  lines.push(`📊 **Phân tích tuần này của bạn (điểm: ${score}/100)**\n`);

  // Views
  if (thisWeek.views > lastWeek.views) {
    lines.push(`✅ Lượt xem tăng **${viewGrowth}%** so với tuần trước (${thisWeek.views.toLocaleString()} vs ${lastWeek.views.toLocaleString()}). Tiêu đề bài viết của bạn đang hoạt động tốt!`);
  } else {
    lines.push(`⚠️ Lượt xem giảm **${Math.abs(Number(viewGrowth))}%** so với tuần trước. Hãy thử cải thiện tiêu đề hoặc thời điểm đăng bài.`);
  }

  // Engagement
  if (thisWeek.engagementRate > 5) {
    lines.push(`🔥 Tỷ lệ tương tác **${thisWeek.engagementRate}%** rất ấn tượng! Nội dung của bạn đang kết nối tốt với độc giả.`);
  } else if (thisWeek.engagementRate >= 2) {
    lines.push(`📌 Tỷ lệ tương tác **${thisWeek.engagementRate}%** ở mức trung bình. Thêm câu hỏi mở ở cuối bài để tăng comment.`);
  } else {
    lines.push(`⚠️ Tỷ lệ tương tác **${thisWeek.engagementRate}%** còn thấp. Hãy tập trung vào nội dung kêu gọi hành động (CTA) rõ ràng hơn.`);
  }

  // Posts
  if (thisWeek.posts >= 3) {
    lines.push(`📅 Bạn đã đăng **${thisWeek.posts} bài** tuần này — tần suất tốt! Duy trì đều đặn giúp thuật toán ưu tiên nội dung của bạn.`);
  } else {
    lines.push(`📅 Chỉ đăng **${thisWeek.posts} bài** tuần này. Khuyến nghị ít nhất **3-4 bài/tuần** để tăng độ phủ và tương tác.`);
  }

  // Reacts growth
  if (Number(reactGrowth) > 0) {
    lines.push(`👍 Lượt react tăng **${reactGrowth}%**. Nội dung của bạn đang cộng hưởng tốt với khán giả.`);
  }

  lines.push(`\n💡 **Gợi ý cải thiện tuần tới:**`);
  if (thisWeek.posts < 3) lines.push(`  • Tăng tần suất đăng lên 3-4 bài/tuần`);
  if (thisWeek.engagementRate < 5) lines.push(`  • Thêm poll hoặc câu hỏi cuối mỗi bài để tăng comment`);
  if (thisWeek.avgViews < 1000) lines.push(`  • Thử đăng vào khung giờ vàng (8-9h sáng, 12h trưa, 6-8h tối)`);
  lines.push(`  • Sử dụng hashtag liên quan #AI #Technology #Innovation để mở rộng reach`);

  return lines.join('\n');
}

// ─── RADAR CHART DATA ─────────────────────────────────────────────────────────
function buildRadarData(thisWeek: typeof MOCK_THIS_WEEK, lastWeek: typeof MOCK_LAST_WEEK) {
  return [
    { subject: 'Tần suất', A: Math.min(100, thisWeek.posts * 25), B: Math.min(100, lastWeek.posts * 25) },
    { subject: 'Engagement', A: Math.min(100, thisWeek.engagementRate * 10), B: Math.min(100, lastWeek.engagementRate * 10) },
    { subject: 'Views', A: Math.min(100, thisWeek.avgViews / 20), B: Math.min(100, lastWeek.avgViews / 20) },
    { subject: 'Reacts', A: Math.min(100, thisWeek.reacts / 3), B: Math.min(100, lastWeek.reacts / 3) },
    { subject: 'Comments', A: Math.min(100, thisWeek.comments * 2), B: Math.min(100, lastWeek.comments * 2) },
  ];
}

// ─── DELTA BADGE ─────────────────────────────────────────────────────────────
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
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = WEEKLY_COMPARISON_CHART.find(x => x.metric === label);
    return (
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Text strong style={{ fontSize: 13 }}>{label}</Text>
        <div style={{ marginTop: 6 }}>
          <div style={{ color: '#1890ff' }}>Tuần này: <strong>{d?.tuanNayRaw?.toLocaleString()}</strong></div>
          <div style={{ color: '#aaa' }}>Tuần trước: <strong>{d?.tuanTruocRaw?.toLocaleString()}</strong></div>
        </div>
      </div>
    );
  }
  return null;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AIAssistantTab() {
  const [activeAccount, setActiveAccount] = useState<'privos' | 'merve'>('privos');
  const [chatMessages, setChatMessages] = useState<{ id: number; sender: 'ai' | 'user'; text: string; typing?: boolean }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalViews, setGoalViews] = useState(5000);
  const [goalSet, setGoalSet] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const thisWeek = activeAccount === 'privos' ? MOCK_PRIVOS.thisWeek : MOCK_MERVE.thisWeek;
  const lastWeek = activeAccount === 'privos' ? MOCK_PRIVOS.lastWeek : MOCK_MERVE.lastWeek;
  const { score, breakdown } = useMemo(() => calcHealthScore(thisWeek, lastWeek), [thisWeek, lastWeek]);
  const radarData = buildRadarData(thisWeek, lastWeek);

  // Comparison chart tuned per account
  const compChartData = [
    { metric: 'Bài đăng', tuanNay: thisWeek.posts, tuanTruoc: lastWeek.posts },
    { metric: 'Views /100', tuanNay: Math.round(thisWeek.views / 100), tuanTruoc: Math.round(lastWeek.views / 100) },
    { metric: 'Reacts', tuanNay: thisWeek.reacts, tuanTruoc: lastWeek.reacts },
    { metric: 'Comments', tuanNay: thisWeek.comments, tuanTruoc: lastWeek.comments },
    { metric: 'Reposts', tuanNay: thisWeek.reposts, tuanTruoc: lastWeek.reposts },
  ];

  // Auto-init AI message when account changes
  useEffect(() => {
    const aiIntro = generateAIComment(thisWeek, lastWeek, score);
    setChatMessages([
      {
        id: 1,
        sender: 'ai',
        text: aiIntro,
      },
    ]);
  }, [activeAccount]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const simulateAIReply = (userMsg: string) => {
    setIsTyping(true);
    const lower = userMsg.toLowerCase();
    let reply = '';

    if (lower.includes('view') || lower.includes('lượt xem')) {
      reply = `📊 Về lượt xem:\n\nTuần này bạn đạt **${thisWeek.views.toLocaleString()} views**, tăng ${((thisWeek.views - lastWeek.views) / lastWeek.views * 100).toFixed(1)}% so tuần trước.\n\n💡 Để tăng views:\n• Đăng vào giờ vàng: 8-9h sáng & 6-8h tối\n• Dùng hình ảnh/video thay vì text thuần\n• Tiêu đề bài nên có con số cụ thể (VD: "5 cách..." thay vì "Những cách...")`;
    } else if (lower.includes('react') || lower.includes('like') || lower.includes('tương tác')) {
      reply = `👍 Về tương tác:\n\nTỷ lệ engagement của bạn đang là **${thisWeek.engagementRate}%** ${thisWeek.engagementRate > 5 ? '— rất tốt! 🏆' : '— cần cải thiện.'}\n\n💡 Tăng react:\n• Thêm câu hỏi cuối bài: "Bạn nghĩ sao?"\n• Tag người liên quan\n• Chia sẻ quan điểm cá nhân thay vì chỉ thông tin khô`;
    } else if (lower.includes('bài đăng') || lower.includes('post') || lower.includes('nội dung')) {
      reply = `✍️ Về nội dung:\n\nBạn đã đăng **${thisWeek.posts} bài** tuần này. ${thisWeek.posts >= 3 ? 'Tần suất tốt!' : 'Nên tăng lên 3-4 bài/tuần.'}\n\n💡 Content ideas:\n• Chia sẻ case study thực tế\n• Behind-the-scenes công ty/sản phẩm\n• Poll/survey để tăng comment\n• Trend trong ngành AI & Tech`;
    } else if (lower.includes('điểm') || lower.includes('score') || lower.includes('health')) {
      reply = `🏆 Health Score của bạn: **${score}/100** (${scoreLabel(score)})\n\nBreakdown:\n${breakdown.map(b => `• ${b.label}: ${b.earned}/${b.max}pts — ${b.note}`).join('\n')}\n\n💡 Để tăng điểm nhanh nhất: ${score < 70 ? 'tăng tần suất đăng bài và thêm CTA cuối mỗi bài.' : 'duy trì đà và thử nội dung dạng carousel.'}`;
    } else if (lower.includes('so sánh') || lower.includes('compare') || lower.includes('merve') || lower.includes('privos')) {
      reply = `🆚 So sánh 2 tài khoản:\n\n**PrivOS LinkedIn**: ${MOCK_PRIVOS.thisWeek.posts} bài | ${MOCK_PRIVOS.thisWeek.views.toLocaleString()} views | ${MOCK_PRIVOS.thisWeek.engagementRate}% engagement\n\n**Merve LinkedIn**: ${MOCK_MERVE.thisWeek.posts} bài | ${MOCK_MERVE.thisWeek.views.toLocaleString()} views | ${MOCK_MERVE.thisWeek.engagementRate}% engagement\n\n📌 Merve đang outperform về views nhưng PrivOS có engagement rate cao hơn. Gợi ý: học style content của Merve để tăng reach cho PrivOS.`;
    } else {
      reply = `🤖 Tôi hiểu bạn đang hỏi về: "${userMsg}"\n\nDựa trên dữ liệu tuần này của **${activeAccount === 'privos' ? 'PrivOS' : 'Merve'}**:\n• Health Score: ${score}/100\n• Views: ${thisWeek.views.toLocaleString()} (${thisWeek.views > lastWeek.views ? '▲' : '▼'} so tuần trước)\n• Engagement: ${thisWeek.engagementRate}%\n\n💬 Bạn có thể hỏi tôi về: views, reacts, bài đăng, health score, hoặc so sánh 2 tài khoản!`;
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

  const handleExportPDF = () => {
    notification.success({
      message: 'Đã xuất báo cáo PDF!',
      description: `Weekly Health Report - ${activeAccount === 'privos' ? 'PrivOS AI' : 'Merve'} - Điểm: ${score}/100`,
      icon: <DownloadOutlined style={{ color: '#52c41a' }} />,
      duration: 3,
    });
  };

  const color = scoreColor(score);

  const PLATFORMS = [
    { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: <LinkedinOutlined /> },
    { id: 'facebook', label: 'Facebook', color: '#1877f2', icon: <FacebookOutlined /> },
    { id: 'x', label: 'X (Twitter)', color: '#000', icon: <TwitterOutlined /> },
  ];
  const ACCOUNTS = [
    { id: 'privos', label: 'PrivOS AI', avatar: 'https://pbs.twimg.com/profile_images/2013183029779288065/GlhEZQnx_400x400.jpg' },
    { id: 'merve', label: 'Merve S. BUBLIS', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQFwgjLdgucxVw/profile-displayphoto-scale_400_400/B4DZ3BGvSHHsAk-/0/1777061265216?e=1784764800&v=beta&t=p0YmkCfiXoakcZlBlNj6ZiehKclEdbRmkkPHuu2qRkE' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── HEADER: Platform + Account (KPI Dashboard style) ── */}
      <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bordered={false}>
        <Row gutter={[24, 16]} align="middle">
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

      {/* ── SECTION 1: Weekly Stats Comparison ── */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 22, background: 'linear-gradient(180deg,#1890ff,#722ed1)', borderRadius: 2 }} />
            <Title level={4} style={{ margin: 0 }}>📊 So Sánh Tương Tác: Tuần Này vs Tuần Trước</Title>
          </div>
          <Space>
            <Tooltip title="Đặt mục tiêu KPI tuần tới">
              <Button icon={<AimOutlined />} onClick={() => setGoalModalOpen(true)} style={{ color: '#1890ff', borderColor: '#1890ff', borderRadius: 8 }}>
                Mục Tiêu
              </Button>
            </Tooltip>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportPDF} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8 }}>
              Xuất PDF
            </Button>
          </Space>
        </div>

        {/* Stat Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            { label: 'Bài Đăng', cur: thisWeek.posts, prev: lastWeek.posts, icon: <FileTextOutlined />, color: '#722ed1', unit: 'bài' },
            { label: 'Lượt Xem', cur: thisWeek.views, prev: lastWeek.views, icon: <EyeOutlined />, color: '#1890ff', unit: 'views' },
            { label: 'Lượt React', cur: thisWeek.reacts, prev: lastWeek.reacts, icon: <LikeOutlined />, color: '#52c41a', unit: 'reacts' },
            { label: 'Bình Luận', cur: thisWeek.comments, prev: lastWeek.comments, icon: <CommentOutlined />, color: '#faad14', unit: 'comments' },
            { label: 'Reposts', cur: thisWeek.reposts, prev: lastWeek.reposts, icon: <SyncOutlined />, color: '#eb2f96', unit: 'reposts' },
          ].map(item => (
            <Col xs={12} sm={8} md={8} lg={4} key={item.label}>
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
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Tuần trước: {item.prev.toLocaleString()}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Bar Chart + Radar */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={15}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#555' }}>Biểu đồ so sánh</Text>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={compChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={20} barCategoryGap="25%">
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} padding={{ left: 20, right: 20 }} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomBarTooltip />} />
                <Legend />
                <Bar dataKey="tuanNay" name="Tuần này" fill="#1890ff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="tuanTruoc" name="Tuần trước" fill="#b37feb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Col>
          <Col xs={24} md={9}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#555' }}>Radar tổng thể</Text>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Tuần này" dataKey="A" stroke="#1890ff" fill="#1890ff" fillOpacity={0.35} />
                <Radar name="Tuần trước" dataKey="B" stroke="#b37feb" fill="#b37feb" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>

      {/* ── SECTION 2: Weekly Health Score ── */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 4, height: 22, background: 'linear-gradient(180deg,#52c41a,#faad14)', borderRadius: 2 }} />
          <Title level={4} style={{ margin: 0 }}>🏆 Weekly Health Score</Title>
        </div>

        <Row gutter={[32, 24]} align="middle">
          {/* Score Circle */}
          <Col xs={24} md={8} style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Progress
                type="circle"
                percent={score}
                size={170}
                strokeColor={{
                  '0%': '#ff4d4f',
                  '50%': '#faad14',
                  '100%': '#52c41a',
                }}
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
              <Tag
                color={score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error'}
                style={{ fontSize: 14, padding: '4px 16px', borderRadius: 20, fontWeight: 600 }}
              >
                {scoreLabel(score)}
              </Tag>
            </div>
            {goalSet && (
              <div style={{ marginTop: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 12px' }}>
                <Text style={{ fontSize: 12 }}>
                  <AimOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                  Mục tiêu: {goalViews.toLocaleString()} views/tuần
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Progress
                    percent={Math.min(100, Math.round(thisWeek.views / goalViews * 100))}
                    size="small"
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                  <Text style={{ fontSize: 11, color: '#666' }}>{Math.min(100, Math.round(thisWeek.views / goalViews * 100))}% mục tiêu</Text>
                </div>
              </div>
            )}
          </Col>

          {/* Breakdown */}
          <Col xs={24} md={16}>
            <Text strong style={{ color: '#555', display: 'block', marginBottom: 14 }}>Chi tiết chấm điểm:</Text>
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

            {/* Scoring Rules Collapse */}
            <div style={{ marginTop: 16, background: '#f8f9ff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e8ecff' }}>
              <Text strong style={{ fontSize: 12, color: '#666' }}>📋 Quy tắc chấm điểm:</Text>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {[
                  ['Tần suất (30pts)', '≥3 bài→30 | 1-2→15 | 0→0'],
                  ['Engagement (30pts)', '>5%→30 | 2-5%→18 | <2%→5'],
                  ['Avg Views (20pts)', '>1000→20 | 500-1000→12 | <500→5'],
                  ['Tăng trưởng (20pts)', '>10%→20 | 0-10%→10 | giảm→0'],
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

      {/* ── SECTION 3: Privos AI Chatbot ── */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Chat Header */}
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
                Đang hoạt động · Phân tích dựa trên dữ liệu thực
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
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

          {/* Typing Indicator */}
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

        {/* Suggestion Chips */}
        <div style={{ padding: '8px 24px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            '📊 Tại sao views giảm?',
            '💡 Gợi ý nội dung tuần tới',
            '📈 Cách tăng engagement rate',
            '🆚 So sánh PrivOS và Merve',
          ].map(q => (
            <button
              key={q}
              onClick={() => {
                setInputValue(q);
              }}
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

        {/* Input */}
        <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10 }}>
          <Input
            size="large"
            placeholder="Hỏi AI về dữ liệu, xu hướng, hay lời khuyên cải thiện bài đăng..."
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
            Gửi
          </Button>
        </div>
      </Card>

      {/* ── GOAL MODAL ── */}
      <Modal
        title={<><AimOutlined style={{ color: '#1890ff', marginRight: 8 }} />Đặt Mục Tiêu KPI Tuần Tới</>}
        open={goalModalOpen}
        onCancel={() => setGoalModalOpen(false)}
        onOk={() => {
          setGoalSet(true);
          setGoalModalOpen(false);
          notification.success({ message: `Mục tiêu đã đặt: ${goalViews.toLocaleString()} views/tuần`, duration: 3 });
        }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
            Đặt mục tiêu views/tuần để AI theo dõi và đưa ra lời khuyên phù hợp.
          </Text>
          <div style={{ marginBottom: 20 }}>
            <Text strong>Mục tiêu Views / tuần:</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
              <Slider min={500} max={20000} step={100} value={goalViews} onChange={setGoalViews} style={{ flex: 1 }} />
              <InputNumber min={500} max={20000} step={100} value={goalViews} onChange={v => v && setGoalViews(v)} style={{ width: 100 }} />
            </div>
          </div>
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '12px 16px' }}>
            <Text style={{ fontSize: 13 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
              Tuần này bạn đạt <strong>{thisWeek.views.toLocaleString()}</strong> views.
              Mục tiêu <strong>{goalViews.toLocaleString()}</strong> = cần tăng{' '}
              <strong style={{ color: goalViews > thisWeek.views ? '#ff4d4f' : '#52c41a' }}>
                {goalViews > thisWeek.views ? `+${(goalViews - thisWeek.views).toLocaleString()}` : 'Đã đạt! 🎉'}
              </strong>
            </Text>
          </div>
        </div>
      </Modal>


      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
