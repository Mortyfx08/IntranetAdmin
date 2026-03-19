import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Row, Col, Statistic, Button, Tag, Table, Space, Typography, Tooltip, Progress, Input, Drawer, Divider, Popconfirm } from 'antd';
import {
    DesktopOutlined,
    WifiOutlined,
    ReloadOutlined,
    SearchOutlined,
    CloudDownloadOutlined,
    DeleteOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import TopologyFlow from './TopologyFlow';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import GlassCard from '../components/GlassCard';

import DeviceDrawer from '../components/DeviceDrawer';
import * as d3 from 'd3';
import useTopologyStore from '../store/topologyStore';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        selectedNodeId, setSelectedNodeId,
        hoverNode, setHoverNode,
        layoutMode,
        isClustered, setIsClustered,
        searchQuery, setSearchQuery,
        isExpanded, setIsExpanded
    } = useTopologyStore();

    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, avgCpu: 0, avgRam: 0 });
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const graphRef = useRef();

    const fetchData = useCallback(async () => {
        try {
            const [mapRes, servicesRes] = await Promise.all([
                axios.get('/api/network-map'),
                axios.get('/api/services')
            ]);

            let { nodes, links } = mapRes.data;

            if (nodes.length > 0) {
                setGraphData(prevData => {
                    const existingNodes = new Map(prevData.nodes.map(n => [n.id, n]));
                    const mergedNodes = nodes.map(n => {
                        const existing = existingNodes.get(n.id);
                        if (existing) {
                            return { ...n, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy, fx: existing.fx, fy: existing.fy };
                        }
                        return n;
                    });
                    return { nodes: mergedNodes, links };
                });
            }
            setServices(servicesRes.data);

            const devices = mapRes.data.nodes.filter(n => (n.group === 3 || n.group === 1));
            const totalCpu = devices.reduce((acc, d) => acc + (d.cpu_usage || 0), 0);
            const totalRam = devices.reduce((acc, d) => acc + (d.ram_usage || 0), 0);
            setStats({
                total: devices.length,
                online: devices.filter(d => d.status === 'online').length,
                offline: devices.filter(d => d.status !== 'online').length,
                avgCpu: devices.length ? Math.round(totalCpu / devices.length) : 0,
                avgRam: devices.length ? Math.round(totalRam / devices.length) : 0
            });
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch data", error);
        }
    }, []);

    // WebSocket for global live updates
    useEffect(() => {
        fetchData();
        let ws;
        let retryTimer;

        const connect = () => {
            const wsUrl = `ws://${window.location.hostname}:8000/ws`;
            ws = new WebSocket(wsUrl);

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                if (msg.type === 'device_update' || msg.type === 'topology_refresh') {
                    fetchData(); // Simple global refresh on any change for consistency
                }
            };
            ws.onclose = () => {
                retryTimer = setTimeout(connect, 3000);
            };
        };
        connect();
        return () => {
            clearTimeout(retryTimer);
            ws?.close();
        };
    }, [fetchData]);

    useEffect(() => {
        const handleFullscreenChange = () => setIsExpanded(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.body.style.overflow = 'auto';
        };
    }, [setIsExpanded]);

    const handleNodeClick = useCallback((node) => {
        if (!node) return;
        const normalizedNode = node.data ? node.data : node;
        if (normalizedNode.group === 3 || normalizedNode.group === 1) {
            setSelectedNodeId(normalizedNode.id);
            setSelectedDevice(normalizedNode);
        }
    }, [setSelectedNodeId]);

    // Live update the right drawer if the selected device changes in graphData
    useEffect(() => {
        if (selectedDevice) {
            const updatedNode = graphData.nodes.find(n => n.id === selectedDevice.id);
            if (updatedNode && JSON.stringify(updatedNode) !== JSON.stringify(selectedDevice)) {
                setSelectedDevice({ ...updatedNode });
            }
        }
    }, [graphData.nodes, selectedDevice]);

    const handleSearch = (value) => {
        setSearchQuery(value);
        if (!value) return;
        const node = graphData.nodes.find(n =>
            n.group === 3 && (
                (n.label || '').toLowerCase().includes(value.toLowerCase()) ||
                (n.ip_address && n.ip_address.includes(value)) ||
                (n.user_name && n.user_name.toLowerCase().includes(value.toLowerCase()))
            )
        );
        if (node && graphRef.current) {
            graphRef.current.centerAt?.(node.x, node.y, 1000);
            graphRef.current.zoom?.(3, 1000);
            setHoverNode(node);
        }
    };

    const filteredDevices = graphData.nodes.filter(n =>
        (n.group === 3 || n.group === 1) && (
            (n.label || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
            (n.ip_address && n.ip_address.includes(searchQuery || '')) ||
            (n.user_name && (n.user_name || '').toLowerCase().includes((searchQuery || '').toLowerCase()))
        )
    );

    const deviceColumns = [
        {
            title: t('dashboard.hostname'),
            dataIndex: 'label',
            key: 'hostname',
            render: (text, record) => (
                <Space>
                    <DesktopOutlined style={{ color: record.status === 'online' ? '#52c41a' : '#8c8c8c' }} />
                    <Text style={{ color: '#fff', fontWeight: 600 }}>{text}</Text>
                    {record.group === 1 && <Tag color="gold" style={{ marginLeft: 8 }}>{t('common.server') || 'Server'}</Tag>}
                </Space>
            )
        },
        {
            title: 'Owner',
            dataIndex: 'user_name',
            key: 'user_name',
            render: text => text ? <Tag color="blue">{text}</Tag> : <Text style={{ color: 'rgba(255,255,255,0.3)' }}>N/A</Text>
        },
        {
            title: t('dashboard.ipAddress'),
            dataIndex: 'ip_address',
            key: 'ip',
            render: text => <Text code style={{ background: 'rgba(255,255,255,0.05)', color: '#1890ff' }}>{text}</Text>
        },
        {
            title: 'CPU',
            dataIndex: 'cpu_usage',
            key: 'cpu',
            render: val => <Progress percent={val || 0} size="small" strokeColor={(val || 0) > 80 ? '#ff4d4f' : '#1890ff'} />
        },
        {
            title: 'RAM',
            dataIndex: 'ram_usage',
            key: 'ram',
            render: val => <Progress percent={val || 0} size="small" strokeColor={(val || 0) > 80 ? '#ff4d4f' : '#eb2f96'} />
        },
        {
            title: t('device.status'),
            key: 'status',
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Tooltip title={record.status === 'online' ? "NETWORK UP: Device responded to ARP ping." : "NETWORK DOWN: Device is unreachable via ARP."}>
                        <Tag color={record.status === 'online' ? 'green' : 'default'} style={{ fontWeight: 'bold', fontSize: '10px', width: '90px', textAlign: 'center' }}>
                            {record.status === 'online' ? 'NETWORK UP' : 'NETWORK DOWN'}
                        </Tag>
                    </Tooltip>
                    <Tooltip title={record.agent_status === 'online' ? "AGENT UP: The agent process is running on that device and checking in." : "AGENT DOWN: The agent is not responding or offline."}>
                        <Tag color={record.agent_status === 'online' ? 'cyan' : 'orange'} style={{ fontWeight: 'bold', fontSize: '10px', width: '90px', textAlign: 'center' }}>
                            {record.agent_status === 'online' ? 'AGENT UP' : 'AGENT DOWN'}
                        </Tag>
                    </Tooltip>
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space onClick={e => e.stopPropagation()}>
                    <Tooltip title="Détails & actions agent">
                        <Button
                            type="primary" ghost size="small"
                            icon={<InfoCircleOutlined />}
                            onClick={e => { e.stopPropagation(); setSelectedDevice(record); }}
                        />
                    </Tooltip>
                    <Tooltip title="Supprimer">
                        <Popconfirm
                            title="Supprimer cet appareil ?"
                            description={`Supprimer ${record.label || record.ip_address} de la base ?`}
                            okText="Supprimer" okType="danger" cancelText="Annuler"
                            onConfirm={async e => {
                                e?.stopPropagation();
                                try {
                                    await axios.delete(`/api/devices/${encodeURIComponent(record.id)}`);
                                    message.success(t('common.deleted') || 'Deleted');
                                    fetchData();
                                } catch (err) {
                                    message.error('❌ Échec: ' + (err.response?.data?.detail || err.message));
                                }
                            }}
                        >
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>{t('dashboard.title')}</Title>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>{t('dashboard.subtitle')}</Text>
                </div>
                <Space size="middle">
                    <Button
                        type="primary"
                        icon={<ReloadOutlined spin={loading} />}
                        onClick={fetchData}
                        style={{ borderRadius: '8px', background: 'linear-gradient(135deg, #1890ff, #096dd9)', border: 'none', height: '40px', padding: '0 20px', fontWeight: '600' }}
                    >
                        {t('common.refresh') || 'Refresh'}
                    </Button>
                </Space>
            </div>

            <Row gutter={[24, 24]}>
                {/* Stats Cards */}
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard className="animate-fade-in">
                        <Statistic
                            title={<Text style={{ color: 'rgba(255,255,255,0.6)' }}>{t('dashboard.totalDevices')}</Text>}
                            value={stats.total}
                            prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
                            valueStyle={{ color: '#fff', fontWeight: 700 }}
                        />
                    </GlassCard>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <Statistic
                            title={<Text style={{ color: 'rgba(255,255,255,0.6)' }}>{t('dashboard.online')}</Text>}
                            value={stats.online}
                            prefix={<WifiOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a', fontWeight: 700 }}
                        />
                    </GlassCard>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '8px' }}>{t('dashboard.avgCpu')}</Text>
                                <Title level={3} style={{ color: '#fff', margin: 0 }}>{stats.avgCpu}%</Title>
                            </div>
                            <Progress type="circle" percent={stats.avgCpu} size={50} strokeColor="#1890ff" />
                        </div>
                    </GlassCard>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <GlassCard className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '8px' }}>{t('dashboard.avgRam')}</Text>
                                <Title level={3} style={{ color: '#fff', margin: 0 }}>{stats.avgRam}%</Title>
                            </div>
                            <Progress type="circle" percent={stats.avgRam} size={50} strokeColor="#eb2f96" />
                        </div>
                    </GlassCard>
                </Col>

                {/* Topology Map */}
                <Col span={24} style={isExpanded ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000, padding: 0, margin: 0 } : {}}>
                    <GlassCard
                        title={!isExpanded && t('dashboard.networkTopology')}
                        className="animate-fade-in"
                        style={isExpanded ? { height: '100vh', width: '100vw', borderRadius: 0, border: 'none', background: '#0f172a', position: 'fixed', top: 0, left: 0, zIndex: 2000 } : { animationDelay: '0.4s' }}
                        bodyStyle={isExpanded ? { padding: 0, height: '100%', width: '100%' } : {}}
                    >
                        <div id="topology-map-container" style={{ height: isExpanded ? '100vh' : '600px', width: '100%', background: '#0f172a', borderRadius: isExpanded ? 0 : '12px', overflow: 'hidden', position: 'relative' }}>
                            <TopologyFlow onNodeClick={handleNodeClick} />

                            <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 16 }}>
                                {[['#52c41a', t('dashboard.online') || 'Online'], ['rgba(255,255,255,0.2)', t('dashboard.offline') || 'Offline']].map(([c, l]) => (
                                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{l}</Text>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </GlassCard>
                </Col>

                {/* Device List */}
                <Col span={24}>
                    <GlassCard
                        title={
                            <Space>
                                <DesktopOutlined style={{ color: '#1890ff' }} />
                                <span>{t('dashboard.deviceList')} ({filteredDevices.length})</span>
                            </Space>
                        }
                        className="animate-fade-in"
                        style={{ animationDelay: '0.5s' }}
                        extra={
                            <Input
                                placeholder={t('dashboard.deviceSearchPlaceholder')}
                                prefix={<SearchOutlined />}
                                style={{ width: 260, borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                onChange={e => handleSearch(e.target.value)}
                                value={searchQuery}
                                allowClear
                            />
                        }
                    >
                        <Table
                            dataSource={filteredDevices}
                            columns={deviceColumns}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            onRow={record => ({
                                onClick: () => setSelectedDevice(record),
                                style: { cursor: 'pointer' }
                            })}
                            locale={{ emptyText: <div style={{ color: 'rgba(255,255,255,0.3)', padding: '40px 0' }}>{t('dashboard.noDevices')}</div> }}
                        />
                    </GlassCard>
                </Col>
            </Row>

            {/* Device Action Drawer */}
            <DeviceDrawer
                device={selectedDevice}
                onClose={() => setSelectedDevice(null)}
                onUpdate={fetchData}
            />
        </div>
    );
};

export default Dashboard;
