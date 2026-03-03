import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, theme, Button, Avatar, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  CloudDownloadOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  DeploymentUnitOutlined,
  UserOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import Downloads from './pages/Downloads';
import Services from './pages/Services';
import Login from './pages/Login';
import Scanner from './pages/Scanner';
import i18n from './i18n';
import LanguageSwitcher from './components/LanguageSwitcher';
import './index.css'; // Assuming custom styles go here or in a style tag




const { Header, Content, Sider } = Layout;
const { Text } = Typography;

const App = () => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user')));
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login', { replace: true });
  };

  // Auth Guard Logic
  const isAuthenticated = user && user.status === 'ok';

  // If on login page, just show it
  if (location.pathname === '/login') {
    if (isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return <Login onLogin={setUser} />;
  }

  // If not authenticated, force redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined style={{ fontSize: '18px' }} />,
      label: t('nav.dashboard'),
    },
    {
      key: '/services',
      icon: <DeploymentUnitOutlined style={{ fontSize: '18px' }} />,
      label: t('nav.services'),
    },
    {
      key: '/scanner',
      icon: <SearchOutlined style={{ fontSize: '18px' }} />,
      label: t('nav.scanner'),
    },
    {
      key: '/downloads',
      icon: <CloudDownloadOutlined style={{ fontSize: '18px' }} />,
      label: t('nav.downloads'),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 12,
          fontFamily: "'Outfit', sans-serif",
        },
        components: {
          Layout: {
            siderBg: 'rgba(15, 23, 42, 0.9)',
            headerBg: 'rgba(15, 23, 42, 0.8)',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: 'rgba(24, 144, 255, 0.15)',
            itemSelectedColor: '#1890ff',
          }
        }
      }}
    >
      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          width={260}
          className="glass-effect"
          style={{
            position: 'fixed',
            height: '100vh',
            left: i18n.dir() === 'rtl' ? 'auto' : 0,
            right: i18n.dir() === 'rtl' ? 0 : 'auto',
            top: 0,
            bottom: 0,
            zIndex: 100,
            borderRight: i18n.dir() === 'rtl' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: i18n.dir() === 'rtl' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
          }}
        >
          {/* High-End Branding Section */}
          <div style={{
            padding: collapsed ? '24px 0' : '32px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'padding 0.3s ease',
            width: '100%'
          }}>
            <motion.div
              layout
              whileHover={{ scale: 1.05, translateY: -2, boxShadow: '0 12px 48px rgba(24, 144, 255, 0.3)' }}
              animate={{
                boxShadow: [
                  '0 8px 32px rgba(0,0,0,0.5)',
                  '0 8px 64px rgba(24, 144, 255, 0.4)',
                  '0 8px 32px rgba(0,0,0,0.5)'
                ],
                borderColor: [
                  'rgba(24, 144, 255, 0.2)',
                  'rgba(24, 144, 255, 0.8)',
                  'rgba(24, 144, 255, 0.2)'
                ],
                scale: [1, 1.02, 1]
              }}
              transition={{
                boxShadow: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                borderColor: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }}
              style={{
                width: collapsed ? '72px' : '180px',
                height: collapsed ? '72px' : '180px',
                borderRadius: collapsed ? '20px' : '40px',
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden'
              }}
            >
              {/* Brand Glow */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle, rgba(24,144,255,0.15) 0%, rgba(24,144,255,0) 70%)',
                filter: 'blur(10px)',
                zIndex: -1
              }} />

              <img
                src="/AAAA.jpeg"
                alt="Logo"
                style={{
                  width: '180%',
                  height: '180%',
                  objectFit: 'contain',
                  mixBlendMode: 'screen',
                  filter: 'brightness(1.2) contrast(1.1) drop-shadow(0 0 20px rgba(24, 144, 255, 0.6))',
                  transition: 'all 0.5s ease'
                }}
              />
            </motion.div>

            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    textAlign: 'center',
                    marginTop: '20px',
                    width: '100%'
                  }}
                >
                  <Text style={{
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '24px',
                    display: 'block',
                    lineHeight: 1,
                    letterSpacing: '-1px',
                    textTransform: 'none'
                  }}>
                    IntranetAdmin
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Menu
            theme="dark"
            selectedKeys={[location.pathname]}
            mode="inline"
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ marginTop: 16, border: 'none' }}
          />
        </Sider>

        <Layout style={{
          marginLeft: i18n.dir() === 'rtl' ? 0 : (collapsed ? 80 : 260),
          marginRight: i18n.dir() === 'rtl' ? (collapsed ? 80 : 260) : 0,
          transition: 'all 0.2s',
          background: 'transparent'
        }}>
          <Header style={{
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            backdropFilter: 'blur(10px)',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            height: 72
          }}>
            <Space size="large">
              <LanguageSwitcher />
              <Space>
                <Avatar
                  icon={<UserOutlined />}
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase' }}>{t('nav.welcome')}</Text>
                  <Text style={{ color: '#fff', fontWeight: 600 }}>{user?.username}</Text>
                </div>
              </Space>
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                style={{
                  color: '#ff4d4f',
                  background: 'rgba(255, 77, 79, 0.1)',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
              >
                {t('nav.logout')}
              </Button>
            </Space>
          </Header>

          <Content style={{ margin: '0', padding: '0', overflowY: 'auto', height: 'calc(100vh - 72px)' }}>
            <div className="animate-fade-in">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/services" element={<Services />} />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
