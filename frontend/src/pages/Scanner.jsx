import React, { useState, useEffect } from 'react';
import {
    Typography, Input, Button, Table, Tag, Space,
    Drawer, Descriptions, List, Badge, Tooltip,
    Card, Segmented, notification, Divider, Progress
} from 'antd';
import {
    SearchOutlined, RadarChartOutlined, DesktopOutlined,
    SafetyCertificateOutlined, ThunderboltOutlined,
    GlobalOutlined, AimOutlined, WifiOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// ─── Quick preset examples ────────────────────────────────────────────────────
const PRESETS = [
    { label: '193.3.100.0/24', value: '193.3.100.0/24', icon: <GlobalOutlined /> },
    { label: '192.168.1.0/24', value: '192.168.1.0/24', icon: <GlobalOutlined /> },
    { label: '10.0.0.0/24', value: '10.0.0.0/24', icon: <GlobalOutlined /> },
    { label: '172.16.0.1-50', value: '172.16.0.1-50', icon: <AimOutlined /> },
];

// ─── OS badge colour ──────────────────────────────────────────────────────────
const osColor = (os) => {
    if (!os) return 'default';
    if (os.includes('Windows')) return 'blue';
    if (os.includes('Linux')) return 'green';
    if (os.includes('Mac')) return 'orange';
    if (os.includes('Cisco')) return 'purple';
    return 'default';
};

const Scanner = () => {
    const { t, i18n } = useTranslation();
    const [mode, setMode] = useState('cidr');
    const [target, setTarget] = useState('193.3.100.0/24');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [scanTime, setScanTime] = useState(null);

    // Deep scan state
    const [deepIp, setDeepIp] = useState(null);
    const [deepLoading, setDeepLoading] = useState(false);
    const [deepData, setDeepData] = useState(null);

    // ─── Mode examples shown below input ─────────────────────────────────────────
    const MODE_META = {
        cidr: { placeholder: 'e.g. 192.168.1.0/24', hint: t('scanner.modeCIDRHint') },
        range: { placeholder: 'e.g. 192.168.1.1-50', hint: t('scanner.modeRangeHint') },
        single: { placeholder: 'e.g. 192.168.1.105', hint: t('scanner.modeSingleHint') },
    };

    // Switch mode → reset target to a sensible placeholder
    const handleModeChange = (m) => {
        setMode(m);
        setTarget('');
        setResults([]);
        setScanTime(null);
    };

    const handleScan = async () => {
        if (!target.trim()) {
            notification.warning({
                message: t('scanner.targetRequired'),
                description: t('scanner.targetRequiredDesc')
            });
            return;
        }
        setLoading(true);
        setResults([]);
        setScanTime(null);
        const t0 = Date.now();
        try {
            const res = await axios.post('/api/scan/custom', { subnet: target.trim() }, { timeout: 120000 });
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            setScanTime(elapsed);
            setResults(res.data);
            notification.success({
                message: t('scanner.scanComplete', { seconds: elapsed }),
                description: t('scanner.devicesFound', { count: res.data.length, target: target }),
            });
        } catch (err) {
            notification.error({
                message: t('scanner.scanFailed'),
                description: err.response?.data?.detail || err.message,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeepScan = async (ip) => {
        setDeepIp(ip);
        setDeepLoading(true);
        setDeepData(null);
        try {
            const res = await axios.get(`/api/scan/ports?ip=${ip}`, { timeout: 30000 });
            setDeepData(res.data);
        } catch (err) {
            notification.error({ message: t('scanner.scanFailed'), description: err.message });
            setDeepIp(null);
        } finally {
            setDeepLoading(false);
        }
    };

    // ── Table columns ─────────────────────────────────────────────────────────
    const columns = [
        {
            title: '#',
            key: 'idx',
            width: 50,
            render: (_, __, i) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>,
        },
        {
            title: t('scanner.columns.ip'),
            dataIndex: 'ip',
            key: 'ip',
            render: ip => <Text code copyable style={{ fontSize: 13 }}>{ip}</Text>,
        },
        {
            title: t('scanner.columns.hostname'),
            dataIndex: 'hostname',
            key: 'hostname',
            render: h => h
                ? <Text style={{ fontSize: 12, color: '#38bdf8' }}>{h}</Text>
                : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
        },
        {
            title: t('scanner.columns.mac'),
            dataIndex: 'mac',
            key: 'mac',
            render: mac => <Text code style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{mac || '—'}</Text>,
        },
        {
            title: t('scanner.columns.status'),
            dataIndex: 'status',
            key: 'status',
            width: 90,
            render: s => <Tag color={s === 'online' ? 'success' : 'error'}>{t(`common.${s}`) || s?.toUpperCase()}</Tag>,
        },
        {
            title: t('scanner.columns.action'),
            key: 'action',
            width: 130,
            render: (_, rec) => (
                <Tooltip title={t('scanner.deepScanDesc')}>
                    <Button size="small" type="primary" ghost icon={<RadarChartOutlined />}
                        onClick={() => handleDeepScan(rec.ip)}>
                        {t('scanner.deepScan')}
                    </Button>
                </Tooltip>
            ),
        },
    ];

    return (
        <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <WifiOutlined style={{ fontSize: 24, color: '#38bdf8' }} />
                        <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                            {t('scanner.title')}
                        </span>
                    </div>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                        {t('scanner.subtitle')}
                    </Text>
                </div>
            </motion.div>

            {/* ── Scan Card ──────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div style={{
                    background: 'rgba(15, 23, 42, 0.88)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(56,189,248,0.18)',
                    borderRadius: 16,
                    padding: '24px 28px',
                    marginBottom: 20,
                    boxShadow: '0 0 40px rgba(56,189,248,0.06)',
                }}>
                    {/* Mode switch */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <Segmented
                            value={mode}
                            onChange={handleModeChange}
                            options={[
                                { label: <span><GlobalOutlined /> {t('scanner.modeCIDR')}</span>, value: 'cidr' },
                                { label: <span><AimOutlined /> {t('scanner.modeRange')}</span>, value: 'range' },
                                { label: <span><DesktopOutlined /> {t('scanner.modeSingle')}</span>, value: 'single' },
                            ]}
                            style={{ background: 'rgba(255,255,255,0.06)' }}
                        />
                        {/* Quick presets */}
                        <Space wrap>
                            {PRESETS.map(p => (
                                <Button
                                    key={p.value}
                                    size="small"
                                    icon={p.icon}
                                    onClick={() => { setTarget(p.value); }}
                                    style={{
                                        background: target === p.value ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${target === p.value ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                        color: target === p.value ? '#38bdf8' : 'rgba(255,255,255,0.6)',
                                        borderRadius: 6,
                                        fontSize: 11,
                                    }}
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </Space>
                    </div>

                    {/* Input row */}
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            size="large"
                            value={target}
                            onChange={e => setTarget(e.target.value)}
                            placeholder={MODE_META[mode].placeholder}
                            onPressEnter={handleScan}
                            prefix={<SearchOutlined style={{ color: '#38bdf8' }} />}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(56,189,248,0.25)',
                                borderRight: 0,
                                color: '#fff',
                                fontSize: 14,
                                borderRadius: '10px 0 0 10px',
                            }}
                        />
                        <Button
                            size="large"
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            loading={loading}
                            onClick={handleScan}
                            style={{
                                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                border: 'none',
                                borderRadius: '0 10px 10px 0',
                                fontWeight: 700,
                                minWidth: 140,
                            }}
                        >
                            {loading ? t('scanner.scanning') : t('scanner.launch')}
                        </Button>
                    </Space.Compact>

                    {/* Hint */}
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8, display: 'block' }}>
                        💡 {MODE_META[mode].hint}
                    </Text>
                </div>
            </motion.div>

            {/* ── Results ────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {(results.length > 0 || loading) && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.88)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16,
                            padding: '20px 24px',
                            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Space>
                                    <RadarChartOutlined style={{ color: results.length ? '#4ade80' : '#6b7280' }} />
                                    <Text style={{ color: '#fff', fontWeight: 700 }}>
                                        {loading ? t('scanner.analysisInProgress') : t('scanner.devicesDetected', { count: results.length })}
                                    </Text>
                                    {scanTime && <Tag color="cyan" style={{ fontSize: 11 }}>⚡ {scanTime}s</Tag>}
                                    {!loading && results.length > 0 && (
                                        <Tag color="success" style={{ fontSize: 11 }}>✓ {t('scanner.savedToDB')}</Tag>
                                    )}
                                </Space>
                                <Tag color="default" style={{ fontFamily: 'monospace', fontSize: 11 }}>{target}</Tag>
                            </div>

                            {loading && (
                                <Progress
                                    percent={99}
                                    status="active"
                                    showInfo={false}
                                    strokeColor={{ from: '#38bdf8', to: '#6366f1' }}
                                    style={{ marginBottom: 12 }}
                                />
                            )}

                            <Table
                                columns={columns}
                                dataSource={results}
                                rowKey="ip"
                                loading={false}
                                size="small"
                                pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['10', '15', '25', '50'] }}
                                style={{ background: 'transparent' }}
                                rowClassName={() => 'scan-row'}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Deep Scan Drawer ───────────────────────────────────────────── */}
            <Drawer
                title={
                    <Space>
                        <SafetyCertificateOutlined style={{ color: '#38bdf8' }} />
                        <span>Deep Scan — {deepIp}</span>
                    </Space>
                }
                placement="right"
                width={520}
                onClose={() => { setDeepIp(null); setDeepData(null); }}
                open={!!deepIp}
                styles={{
                    body: { background: 'rgba(10,17,32,0.98)', padding: 20 },
                    header: { background: 'rgba(10,17,32,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
                }}
            >
                {deepLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <RadarChartOutlined spin style={{ fontSize: 44, color: '#38bdf8', marginBottom: 16 }} />
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>{t('scanner.analysisInProgress')}</div>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                            {t('scanner.subtitle')}
                        </Text>
                        <Progress percent={99} status="active" showInfo={false}
                            strokeColor={{ from: '#38bdf8', to: '#6366f1' }} style={{ marginTop: 20 }} />
                    </div>
                ) : deepData ? (
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                        {/* System Info */}
                        <div style={{
                            background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)',
                            borderRadius: 10, padding: '14px 18px',
                        }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                                {t('scanner.systemFingerprint')}
                            </div>
                            <Descriptions column={1} size="small" labelStyle={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}
                                contentStyle={{ color: '#fff', fontSize: 12 }}>
                                <Descriptions.Item label={t('scanner.ipAddress')}>{deepData.ip}</Descriptions.Item>
                                {deepData.hostname && deepData.hostname !== deepData.ip && (
                                    <Descriptions.Item label={t('scanner.hostname')}>{deepData.hostname}</Descriptions.Item>
                                )}
                                <Descriptions.Item label={t('scanner.estimatedOS')}>
                                    <Tag color={osColor(deepData.os_guess)}>{deepData.os_guess || t('common.unknown')}</Tag>
                                </Descriptions.Item>
                            </Descriptions>
                        </div>

                        {/* Open Ports */}
                        <div style={{
                            background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)',
                            borderRadius: 10, padding: '14px 18px',
                        }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                                {t('scanner.openPorts', { count: deepData.open_ports?.length || 0 })}
                            </div>
                            {deepData.open_ports?.length ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {deepData.open_ports.map(p => (
                                        <Tooltip key={p.port} title={`Port ${p.port} / TCP`}>
                                            <div style={{
                                                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
                                                borderRadius: 8, padding: '4px 10px', cursor: 'default',
                                            }}>
                                                <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 12 }}>{p.port}</span>
                                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 5 }}>{p.service}</span>
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>
                            ) : (
                                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{t('scanner.noPortsFound')}</Text>
                            )}
                        </div>

                        {/* Banners */}
                        {deepData.banners?.length > 0 && (
                            <div style={{
                                background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
                                borderRadius: 10, padding: '14px 18px',
                            }}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                                    {t('scanner.serviceBanners')}
                                </div>
                                {deepData.banners.map((b, i) => (
                                    <div key={i} style={{
                                        fontFamily: 'monospace', fontSize: 11, color: '#a5b4fc',
                                        background: 'rgba(99,102,241,0.08)', borderRadius: 6,
                                        padding: '4px 8px', marginBottom: 4,
                                    }}>{b}</div>
                                ))}
                            </div>
                        )}
                    </Space>
                ) : null}
            </Drawer>
        </div>
    );
};

export default Scanner;
