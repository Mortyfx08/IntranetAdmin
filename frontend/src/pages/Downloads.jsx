import React from 'react';
import { Row, Col, Button, Typography, Space, Divider, message } from 'antd';
import { WindowsOutlined, CloudDownloadOutlined, SafetyCertificateOutlined, InfoCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import GlassCard from '../components/GlassCard';

const { Title, Paragraph, Text } = Typography;

const Downloads = () => {
    const { t, i18n } = useTranslation();

    const versions = [
        { name: 'Windows 7', files: [{ arch: '64-bit', file: 'agents/IntraAdmin_agent_win7_x64.exe' }, { arch: '32-bit', file: 'agents/IntraAdmin_agent_win7_x86.exe' }], color: '#1890ff', desc: 'Windows 7 SP1+ (x64 & x86)' },
        { name: 'Windows 8', files: [{ arch: '64-bit', file: 'agents/IntraAdmin_agent_win8_x64.exe' }, { arch: '32-bit', file: 'agents/IntraAdmin_agent_win8_x86.exe' }], color: '#00add8', desc: 'Windows 8 / 8.1 (x64 & x86)' },
        { name: 'Windows 10', files: [{ arch: '64-bit', file: 'agents/IntraAdmin_agent_win10_x64.exe' }, { arch: '32-bit', file: 'agents/IntraAdmin_agent_win10_x86.exe' }], color: '#0078d4', desc: 'Windows 10 (x64 & x86)', recommended: true },
        { name: 'Windows 11', files: [{ arch: '64-bit', file: 'agents/IntraAdmin_agent_win11_x64.exe' }, { arch: '32-bit', file: 'agents/IntraAdmin_agent_win11_x86.exe' }], color: '#005fb8', desc: 'Windows 11 (x64 & x86)' },
    ];

    const HoverCard = ({ v }) => {
        const [hover, setHover] = React.useState(false);

        return (
            <div
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{
                    height: '100%',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transform: hover ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
                }}
            >
                <GlassCard
                    style={{
                        height: '100%',
                        boxShadow: hover ? `0 20px 40px ${v.color}33` : '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                        borderColor: hover ? v.color : 'rgba(255, 255, 255, 0.1)',
                        overflow: 'hidden'
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        fontSize: '120px',
                        color: v.color,
                        opacity: 0.05,
                        transform: 'rotate(15deg)'
                    }}>
                        <WindowsOutlined />
                    </div>

                    {v.recommended && (
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                            color: '#fff',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            boxShadow: '0 4px 12px rgba(82, 196, 26, 0.4)',
                            zIndex: 2
                        }}>
                            {t('downloads.recommended')}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '20px',
                            background: `linear-gradient(135deg, ${v.color}22, ${v.color}44)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${v.color}44`
                        }}>
                            <WindowsOutlined style={{
                                fontSize: '40px',
                                color: v.color,
                                filter: hover ? 'drop-shadow(0 0 10px currentColor)' : 'none',
                                transition: 'all 0.3s ease'
                            }} />
                        </div>

                        <div>
                            <Title level={3} style={{ color: '#fff', margin: '0 0 8px 0' }}>{v.name}</Title>
                            <Text style={{ color: 'rgba(255,255,255,0.5)' }}>{v.desc}</Text>
                        </div>

                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                            {v.files.map((f) => (
                                <Button
                                    key={f.arch}
                                    type="primary"
                                    icon={<CloudDownloadOutlined />}
                                    size="large"
                                    href={`/download/${f.file}`}
                                    target="_blank"
                                    style={{
                                        background: v.color,
                                        borderColor: v.color,
                                        width: '100%',
                                        height: '44px',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        boxShadow: hover ? `0 8px 20px ${v.color}66` : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {f.arch} — {t('downloads.download')}
                                </Button>
                            ))}
                        </Space>
                    </div>
                </GlassCard>
            </div>
        );
    };

    return (
        <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <Title level={1} style={{ color: '#fff', marginBottom: '16px', fontWeight: 800 }}>
                    {t('downloads.title')}
                </Title>
                <Paragraph style={{ color: 'rgba(255,255,255,0.6)', fontSize: '18px', maxWidth: '700px', margin: '0 auto' }}>
                    {t('downloads.subtitle')}
                </Paragraph>
            </div>

            <Row gutter={[32, 32]} justify="center">
                {versions.map((v, index) => (
                    <Col xs={24} sm={12} md={12} lg={6} key={v.name}>
                        <HoverCard v={v} />
                    </Col>
                ))}
            </Row>

            <div style={{ marginTop: '80px' }}>
                <GlassCard>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <InfoCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                        <Title level={3} style={{ color: '#fff', margin: 0 }}>{t('downloads.instructions')}</Title>
                    </div>

                    <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>
                        {t('downloads.instructionsText')}
                    </Paragraph>

                    <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
                        <Col xs={24} md={8}>
                            <Title level={5} style={{ color: '#52c41a', marginBottom: '12px' }}>{t('downloads.installStep')}</Title>
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(82, 196, 26, 0.2)',
                                position: 'relative'
                            }}>
                                <code style={{ color: '#52c41a', fontSize: '14px', fontFamily: 'monospace' }}>
                                    agent.exe -install
                                </code>
                            </div>
                        </Col>
                        <Col xs={24} md={8}>
                            <Title level={5} style={{ color: '#1890ff', marginBottom: '12px' }}>{t('downloads.manualStart')}</Title>
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(24, 144, 255, 0.2)',
                                position: 'relative'
                            }}>
                                <code style={{ color: '#1890ff', fontSize: '14px', fontFamily: 'monospace' }}>
                                    .\agent.exe
                                </code>
                            </div>
                        </Col>
                        <Col xs={24} md={8}>
                            <Title level={5} style={{ color: '#faad14', marginBottom: '12px' }}>{t('downloads.serverIpStep')}</Title>
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(250, 173, 20, 0.2)',
                                position: 'relative'
                            }}>
                                <code style={{ color: '#faad14', fontSize: '12px', fontFamily: 'monospace' }}>
                                    -server http://[IP]:8000/api/report
                                </code>
                            </div>
                        </Col>
                    </Row>

                    <Space split={<Divider type="vertical" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <SafetyCertificateOutlined style={{ marginRight: '8px' }} />
                            {t('downloads.adminPrivileges')}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {t('downloads.uninstall')} <code style={{ color: '#ff4d4f' }}>-uninstall</code>
                        </Text>
                    </Space>
                </GlassCard>
            </div>
        </div>
    );
};

export default Downloads;
