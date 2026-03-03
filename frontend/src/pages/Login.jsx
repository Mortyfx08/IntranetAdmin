import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Checkbox, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const { Title, Text } = Typography;

// --- Tier 1 Modern Styles ---
const styles = {
    container: {
        height: '100vh',
        width: '100vw',
        background: '#020617',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        position: 'relative',
        overflow: 'hidden',
    },
    blob: {
        position: 'absolute',
        borderRadius: '50%',
        filter: 'blur(100px)',
        zIndex: 0,
        opacity: 0.5,
    },
    glassCard: {
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '420px',
    },
    input: {
        height: '54px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#fff',
        borderRadius: '16px',
        fontSize: '15px',
    },
    primaryButton: {
        height: '56px',
        fontSize: '17px',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 10px 20px -5px rgba(24, 144, 255, 0.3)',
        position: 'relative',
        overflow: 'hidden',
    },
    illustration: {
        width: '100%',
        maxWidth: '540px',
        height: 'auto',
        objectFit: 'contain',
        filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))',
    }
};

const Login = ({ onLogin }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/login', values);
            if (res.data.status === 'ok') {
                message.success(t('login.success'));
                // Always save to sessionStorage for the current tab session
                sessionStorage.setItem('user', JSON.stringify(res.data));

                // Only save to localStorage if "Remember me" is checked
                if (values.remember) {
                    localStorage.setItem('user', JSON.stringify(res.data));
                } else {
                    localStorage.removeItem('user');
                }

                onLogin(res.data);
                navigate('/');
            }
        } catch (error) {
            message.error(t('login.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Background Animated Blobs */}
            <motion.div
                animate={{
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    ...styles.blob,
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(24,144,255,0.08) 0%, rgba(24,144,255,0) 70%)',
                    top: '-100px',
                    left: '-100px',
                }}
            />
            <motion.div
                animate={{
                    x: [0, -40, 0],
                    y: [0, 60, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                style={{
                    ...styles.blob,
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, rgba(168,85,247,0) 70%)',
                    bottom: '-100px',
                    right: '-100px',
                }}
            />

            <div style={{ zIndex: 1, width: '100%', maxWidth: '1200px', padding: '0 24px' }}>
                <Row gutter={[64, 32]} align="middle" justify="center">
                    {/* Visual Section - Hidden on small screens */}
                    <Col xs={0} sm={0} md={12} lg={13}>
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        >
                            <motion.img
                                src="/bg_login.png"
                                alt="Secure Portal"
                                style={styles.illustration}
                                animate={{
                                    y: [0, -15, 0],
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                }}
                            />
                        </motion.div>
                    </Col>

                    {/* Login Card Section */}
                    <Col xs={24} sm={20} md={12} lg={9}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            style={styles.glassCard}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    animate={{
                                        boxShadow: [
                                            '0 0 30px rgba(24,144,255,0.2)',
                                            '0 0 60px rgba(24,144,255,0.5)',
                                            '0 0 30px rgba(24,144,255,0.2)'
                                        ],
                                        borderColor: [
                                            'rgba(24, 144, 255, 0.2)',
                                            'rgba(24, 144, 255, 0.8)',
                                            'rgba(24, 144, 255, 0.2)'
                                        ],
                                        scale: [1, 1.05, 1]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{
                                        width: '200px',
                                        height: '200px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '48px',
                                        margin: '0 auto 40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}
                                >
                                    <img src="/AAAA.jpeg" alt="Logo" style={{ width: '200%', height: '200%', objectFit: 'contain', mixBlendMode: 'screen', filter: 'brightness(1.4) contrast(1.1)' }} />
                                </motion.div>
                                <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 700, fontSize: '28px', letterSpacing: '-0.5px' }}>
                                    {t('login.signin')}
                                </Title>
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                                    Security Gateway
                                </Text>
                            </div>

                            <Form
                                name="login"
                                layout="vertical"
                                onFinish={onFinish}
                                size="large"
                                requiredMark={false}
                                initialValues={{ remember: true }}
                            >
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: t('login.username') }]}
                                    style={{ marginBottom: '16px' }}
                                >
                                    <Input
                                        prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.2)' }} />}
                                        placeholder={t('login.username')}
                                        autoComplete="username"
                                        style={styles.input}
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: t('login.password') }]}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.2)' }} />}
                                        placeholder={t('login.password')}
                                        autoComplete="current-password"
                                        style={styles.input}
                                    />
                                </Form.Item>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <Form.Item name="remember" valuePropName="checked" noStyle>
                                        <Checkbox style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                                            Remember me
                                        </Checkbox>
                                    </Form.Item>
                                    <a href="#forgot" style={{ color: '#1890ff', fontSize: '13px', fontWeight: 500 }}>
                                        Forgot Password?
                                    </a>
                                </div>

                                <Form.Item style={{ marginBottom: 0 }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={loading}
                                        block
                                        style={styles.primaryButton}
                                        className="btn-shimmer"
                                    >
                                        {t('login.signin')}
                                    </Button>
                                </Form.Item>
                            </Form>

                            <div style={{ textAlign: 'center', marginTop: '32px' }}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 16px',
                                    borderRadius: '100px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                }}>
                                    <SafetyCertificateOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
                                        SECURE ENCRYPTED SESSION
                                    </Text>
                                </div>
                            </div>
                        </motion.div>
                    </Col>
                </Row>
            </div>

            <style>
                {`
                .btn-shimmer::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(
                        to right,
                        rgba(255,255,255,0) 0%,
                        rgba(255,255,255,0.1) 50%,
                        rgba(255,255,255,0) 100%
                    );
                    transform: rotate(30deg);
                    animation: shimmer 3s infinite;
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%) rotate(30deg); }
                    100% { transform: translateX(100%) rotate(30deg); }
                }
                `}
            </style>
        </div>
    );
};

export default Login;
