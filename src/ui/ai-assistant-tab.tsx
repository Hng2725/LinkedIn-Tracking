import React, { useState, useRef, useEffect } from 'react';
import { Card, Avatar, Typography, Input, Button, Row, Col } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined, MessageOutlined, PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MOCK_HISTORY = [
  { id: '1', title: 'Phân tích bài đăng Facebook', date: 'Hôm nay' },
  { id: '2', title: 'Cách tăng react trên X (Twitter)', date: 'Hôm qua' },
  { id: '3', title: 'Gợi ý viết bio LinkedIn', date: '3 ngày trước' },
  { id: '4', title: 'Lên ý tưởng content tuần tới', date: 'Tuần trước' },
];

export default function AIAssistantTab() {
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'ai', text: 'Xin chào! Tôi là trợ lý AI Privos của bạn. Bạn muốn phân tích hay nhận xét về bài đăng nào để tăng tương tác?' },
    { id: 2, sender: 'user', text: 'Bài đăng hôm qua của tôi trên Facebook lượt view khá tốt nhưng ít react, bạn xem giúp tôi với.' },
    { id: 3, sender: 'ai', text: 'Tôi đã xem dữ liệu bài đăng gần đây của bạn. Lượt view cao chứng tỏ tiêu đề thu hút, nhưng ít react có thể do thiếu lời kêu gọi hành động (Call to Action). Bạn thử thêm câu hỏi mở ở cuối bài để khuyến khích mọi người bình luận nhé! Ngoài ra, đính kèm một hình ảnh ấn tượng cũng sẽ tăng tỷ lệ tương tác.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [activeChatId, setActiveChatId] = useState('1');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  return (
    <Row gutter={[24, 24]}>
      {/* Khung Chat Chính (Bên Trái) */}
      <Col xs={24} md={16} lg={18}>
        <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '600px', display: 'flex', flexDirection: 'column' }} bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} bordered={false}>
          {/* Chat Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size="large" icon={<RobotOutlined />} style={{ background: '#1890ff' }} />
            <div>
              <Title level={4} style={{ margin: 0, fontSize: 18 }}>Privos AI Assistant</Title>
              <Text type="secondary" style={{ fontSize: 14 }}>Luôn sẵn sàng hỗ trợ bạn phân tích và tăng tương tác bài đăng</Text>
            </div>
          </div>
          
          {/* Chat Messages */}
          <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, background: '#fff' }}>
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', gap: 12, flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
                <Avatar size="default" icon={msg.sender === 'user' ? <UserOutlined /> : <RobotOutlined />} style={{ background: msg.sender === 'user' ? '#52c41a' : '#1890ff' }} />
                <div style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  background: msg.sender === 'user' ? '#e6f7ff' : '#f5f5f5',
                  border: `1px solid ${msg.sender === 'user' ? '#91d5ff' : '#e8e8e8'}`,
                  color: '#333'
                }}>
                  <Text style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{msg.text}</Text>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Chat Input */}
          <div style={{ padding: '20px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '0 0 12px 12px' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Input 
                size="large" 
                placeholder="Hỏi AI cách tăng tương tác cho bài đăng của bạn..." 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={() => {
                  if(inputValue.trim()) {
                    setChatMessages([...chatMessages, { id: Date.now(), sender: 'user', text: inputValue }]);
                    setInputValue('');
                  }
                }}
                style={{ borderRadius: 8 }}
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<SendOutlined />} 
                style={{ borderRadius: 8, padding: '0 24px' }}
                onClick={() => {
                  if(inputValue.trim()) {
                    setChatMessages([...chatMessages, { id: Date.now(), sender: 'user', text: inputValue }]);
                    setInputValue('');
                  }
                }}
              >
                Gửi
              </Button>
            </div>
          </div>
        </Card>
      </Col>

      {/* Lịch sử Hội thoại (Bên Phải) */}
      <Col xs={24} md={8} lg={6}>
        <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '600px', display: 'flex', flexDirection: 'column' }} bodyStyle={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} bordered={false}>
          <Button type="dashed" block icon={<PlusOutlined />} size="large" style={{ marginBottom: 20, borderRadius: 8, color: '#1890ff', borderColor: '#91d5ff', background: '#e6f7ff' }}>
            Đoạn chat mới
          </Button>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            <Text type="secondary" strong style={{ display: 'block', marginBottom: 12, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lịch sử hội thoại</Text>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MOCK_HISTORY.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => setActiveChatId(item.id)}
                  style={{ 
                    padding: '12px 16px', 
                    borderRadius: 8, 
                    cursor: 'pointer',
                    background: activeChatId === item.id ? '#e6f7ff' : '#fafafa',
                    border: `1px solid ${activeChatId === item.id ? '#91d5ff' : 'transparent'}`,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (activeChatId !== item.id) {
                      e.currentTarget.style.background = '#f0f0f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeChatId !== item.id) {
                      e.currentTarget.style.background = '#fafafa';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <MessageOutlined style={{ color: activeChatId === item.id ? '#1890ff' : '#8c8c8c' }} />
                    <Text strong={activeChatId === item.id} style={{ color: activeChatId === item.id ? '#1890ff' : '#333', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>{item.date}</Text>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
}
