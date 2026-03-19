import React from 'react';
import { Drawer, Space, Tag, Typography, Divider, Tooltip } from 'antd';
import { DesktopOutlined, InfoCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import { Monitor, Wifi, Activity, Shield, Cpu, User } from 'lucide-react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import AgentActionsPanel from './AgentActionsPanel';

const { Text, Title } = Typography;

/**
 * DeviceDrawer — Unified Drawer for ALL device details across the app.
 * Used in: Dashboard (Map/List), Services Page, Topology Map.
 */
const DeviceDrawer = ({ device, onClose, onUpdate, getContainer }) => {
    const { t, i18n } = useTranslation();
    if (!device) return null;

    const isOnline = device.status === 'online';
    const isServer = device.group === 1;

    return (
        <Drawer
            title={
                <Space size="middle">
                    <div style={{
                        width: 38, height: 38, borderRadius: '12px',
                        background: isOnline ? 'rgba(82,196,26,0.1)' : 'rgba(140,140,140,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${isOnline ? 'rgba(82,196,26,0.2)' : 'rgba(140,140,140,0.2)'}`,
                        boxShadow: isOnline ? '0 0 15px rgba(82,196,26,0.2)' : 'none'
                    }}>
                        <DesktopOutlined style={{ fontSize: 20, color: isOnline ? '#52c41a' : '#8c8c8c' }} />
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
                            {device.label || device.hostname || device.ip_address}
                        </div>
                        <Space size={4} style={{ marginTop: 2 }}>
                            <Tooltip title={device.status === 'online' ? "NETWORK UP: Device responded to ARP ping." : "NETWORK DOWN: Device is unreachable via ARP."}>
                                <Tag color={device.status === 'online' ? 'green' : 'default'} style={{ borderRadius: '6px', fontWeight: 'bold', fontSize: '11px' }}>
                                    {device.status === 'online' ? 'NETWORK UP' : 'NETWORK DOWN'}
                                </Tag>
                            </Tooltip>
                            <Tooltip title={device.agent_status === 'online' ? "AGENT UP: The agent process is running on that device and checking in." : "AGENT DOWN: The agent is not responding or offline."}>
                                <Tag color={device.agent_status === 'online' ? 'cyan' : 'orange'} style={{ borderRadius: '6px', fontWeight: 'bold', fontSize: '11px' }}>
                                    {device.agent_status === 'online' ? 'AGENT UP' : 'AGENT DOWN'}
                                </Tag>
                            </Tooltip>
                            {device.is_isolated && <Tag color="error" style={{ borderRadius: 4, fontSize: 10, fontWeight: 700, border: 'none' }}>ISOLÉ</Tag>}
                        </Space>
                    </div>
                </Space>
            }
            placement="right"
            onClose={onClose}
            open={!!device}
            width={440}
            zIndex={2500}
            getContainer={getContainer}
            styles={{
                header: { background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px' },
                body: { background: '#0f172a', padding: '20px 24px', overflowY: 'auto', scrollbarWidth: 'thin' },
            }}
            closeIcon={<div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 18 }}>×</div>}
        >
            {/* ── Quick Stats Grid ───────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12,
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <Activity size={18} color="#38bdf8" />
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>CPU</div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{device.cpu_usage != null ? `${device.cpu_usage}%` : '—'}</div>
                    </div>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12,
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <Monitor size={18} color="#818cf8" />
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>RAM</div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                            {device.ram_usage != null ? `${device.ram_usage}%` : '—'}
                            {device.ram_total && <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 4 }}>/ {device.ram_total}</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Technical Details ──────────────────────────────── */}
            <div style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: 16,
                marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)'
            }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <InfoCircleOutlined /> {t('device.details').toUpperCase()}
                </div>
                {[
                    [t('dashboard.ipAddress'), device.ip_address || "—", <Wifi size={14} />],
                    ['MAC', device.mac_address || device.id || "—", <Shield size={14} />],
                    [t('dashboard.hostname'), device.hostname || device.label || "—", <Monitor size={14} />],
                    [t('dashboard.osVersion'), device.os_version || "—", <Cpu size={14} />],
                    [t('dashboard.userName'), device.user_name || "—", <User size={14} />],
                ].map(([k, v, icon]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                        <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {k}</span>
                        <span style={{ color: '#fff', fontFamily: 'monospace', opacity: 0.9 }}>{v}</span>
                    </div>
                ))}
            </div>

            <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '0 0 24px 0' }} />

            {/* ── Control Panel ──────────────────────────────────── */}
            {isServer && !device.mac_address ? (
                <div style={{
                    textAlign: 'center', padding: '40px 24px', borderRadius: 16,
                    background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)'
                }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t('device.agentDown')}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                        {t('dashboard.noDevices')}
                    </div>
                </div>
            ) : (
                <AgentActionsPanel
                    device={device}
                    onDelete={() => { onClose(); if (onUpdate) onUpdate(); }}
                    onRefresh={onUpdate}
                    compact={false}
                    getContainer={getContainer}
                />
            )}
        </Drawer>
    );
};

export default DeviceDrawer;
