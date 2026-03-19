import React, { useState, useEffect } from 'react';
import { Row, Col, Table, Button, Modal, Form, Input, ColorPicker, Space, Tag, message, Typography, Select, Tabs, Collapse, Badge, Divider, Popconfirm, Progress } from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    UserOutlined,
    TeamOutlined,
    SettingOutlined,
    GlobalOutlined
} from '@ant-design/icons';
import axios from 'axios';
import GlassCard from '../components/GlassCard';
import DeviceDrawer from '../components/DeviceDrawer';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

const Services = () => {
    const { t, i18n } = useTranslation();
    const [services, setServices] = useState([]);
    const [devisions, setDevisions] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [editingGroup, setEditingGroup] = useState(null);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [form] = Form.useForm();
    const [groupForm] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [servicesRes, groupsRes, devicesRes] = await Promise.all([
                axios.get('/api/services', { timeout: 10000 }),
                axios.get('/api/devisions', { timeout: 10000 }),
                axios.get('/api/devices', { timeout: 10000 })  // flat device list with service_id
            ]);
            setServices(servicesRes.data);
            setDevisions(groupsRes.data);
            setDevices(devicesRes.data);
        } catch (error) {
            console.error("Fetch error:", error);
            message.error("Failed to fetch data. Check backend connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateOrUpdateService = async (values) => {
        try {
            const selectedGroup = devisions.find(g => g.id === values.groupement_id);
            const payload = {
                ...values,
                groupement: selectedGroup ? selectedGroup.name : 'GMI', // Keep name for legacy, but it's now localized in UI
                groupement_id: values.groupement_id,
                color: selectedGroup ? selectedGroup.color : '#1890ff'
            };

            if (editingService) {
                await axios.put(`/api/services/${editingService.id}`, payload, { timeout: 5000 });
                message.success("Service mis à jour");
            } else {
                await axios.post('/api/services', payload, { timeout: 5000 });
                message.success("Service créé");
            }

            setIsModalOpen(false);
            setEditingService(null);
            form.resetFields();
            fetchData();
        } catch (error) {
            message.error("Erreur lors de l'opération");
        }
    };

    const handleAssignDevice = async (mac, serviceId) => {
        try {
            await axios.patch(`/api/devices/${encodeURIComponent(mac)}/assign`, { service_id: serviceId });
            message.success(serviceId ? `✅ Appareil assigné au service` : `❌ Appareil désassigné`);
            fetchData();
        } catch (e) {
            message.error('Erreur: ' + (e.response?.data?.detail || e.message));
        }
    };

    const handleDeleteService = async (id) => {
        try {
            await axios.delete(`/api/services/${id}`);
            message.success("Service supprimé");
            fetchData();
        } catch (error) {
            message.error("Erreur lors de la suppression");
        }
    };

    const handleCreateOrUpdateGroup = async (values) => {
        try {
            const payload = {
                ...values,
                color: typeof values.color === 'string' ? values.color : values.color.toHexString()
            };
            if (editingGroup) {
                await axios.put(`/api/devisions/${editingGroup.id}`, payload, { timeout: 5000 });
                message.success(t('services.editDevision') + " " + t('common.success'));
            } else {
                await axios.post('/api/devisions', payload, { timeout: 5000 });
                message.success(t('services.addDevision') + " " + t('common.success'));
            }
            setIsGroupModalOpen(false);
            setEditingGroup(null);
            groupForm.resetFields();
            await fetchData();
        } catch (error) {
            console.error("Group op error:", error);
            message.error("Erreur lors de l'opération. Le backend est peut-être occupé.");
        }
    };

    const handleDeleteGroup = async (id) => {
        try {
            await axios.delete(`/api/devisions/${id}`);
            message.success(t('services.devisions') + " " + t('common.deleted'));
            fetchData();
        } catch (error) {
            message.error("Erreur lors de la suppression");
        }
    };

    const serviceColumns = [
        {
            title: t('services.serviceName'),
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => {
                const group = devisions.find(g => g.id === record.groupement_id);
                const color = group ? group.color : record.color;
                return (
                    <Space>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                        <Text style={{ color: '#fff', fontWeight: 600 }}>{text}</Text>
                    </Space>
                );
            }
        },
        {
            title: 'PC Count',
            key: 'pc_count',
            render: (_, record) => (
                <Tag color="blue">{devices.filter(d => d.service_id === record.id).length} PCs</Tag>
            )
        },
        {
            title: t('services.actions'),
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        style={{ color: '#1890ff' }}
                        onClick={() => {
                            setEditingService(record);
                            form.setFieldsValue(record);
                            setIsModalOpen(true);
                        }}
                    />
                    <Popconfirm title="Supprimer ce service ?" onConfirm={() => handleDeleteService(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const deviceColumns = [
        {
            title: t('dashboard.hostname'),
            dataIndex: 'hostname',
            key: 'hostname',
            render: text => <Text style={{ color: '#fff', fontWeight: 600 }}>{text || 'Unknown'}</Text>
        },
        {
            title: 'Utilisateur',
            dataIndex: 'user_name',
            key: 'user_name',
            render: text => text
                ? <Space><UserOutlined style={{ color: 'rgba(255,255,255,0.4)' }} /><Text style={{ color: 'rgba(255,255,255,0.8)' }}>{text}</Text></Space>
                : <Text style={{ color: 'rgba(255,255,255,0.2)' }}>N/A</Text>
        },
        {
            title: 'IP',
            dataIndex: 'ip_address',
            key: 'ip_address',
            render: text => <Text code style={{ background: 'rgba(255,255,255,0.05)', color: '#1890ff' }}>{text}</Text>
        },
        {
            title: t('device.status'),
            key: 'status',
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Tooltip title={record.status === 'online' ? "NETWORK UP: Device responded to ARP ping." : "NETWORK DOWN: Device is unreachable via ARP."}>
                        <Tag color={record.status === 'online' ? 'green' : 'default'} style={{ borderRadius: 4, fontWeight: 'bold', fontSize: '10px', width: '95px', textAlign: 'center' }}>
                            {record.status === 'online' ? '🟢 NET UP' : '⚫ NET DOWN'}
                        </Tag>
                    </Tooltip>
                    <Tooltip title={record.agent_status === 'online' ? "AGENT UP: The agent process is running on that device and checking in." : "AGENT DOWN: The agent is not responding or offline."}>
                        <Tag color={record.agent_status === 'online' ? 'cyan' : 'orange'} style={{ borderRadius: 4, fontWeight: 'bold', fontSize: '10px', width: '95px', textAlign: 'center' }}>
                            {record.agent_status === 'online' ? '🟢 AGENT UP' : '⚫ AGENT DOWN'}
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
                <Space>
                    <Button type="primary" ghost size="small" icon={<SettingOutlined />}
                        onClick={e => { 
                            e.stopPropagation(); 
                            if (record && record.mac_address) {
                                setSelectedDeviceId(record.mac_address); 
                            }
                        }}
                    >Gérer</Button>
                    <Popconfirm title="Retirer du service ?" onConfirm={() => handleAssignDevice(record.mac_address, null)}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Columns for unassigned devices table — with a service selector
    const unassignedColumns = [
        {
            title: 'Appareil',
            key: 'device',
            render: (_, r) => (
                <Space>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'online' ? '#4ade80' : '#6b7280' }} />
                    <Text style={{ color: '#fff', fontWeight: 600 }}>{r.hostname || r.ip_address}</Text>
                    {r.user_name && <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>({r.user_name})</Text>}
                </Space>
            )
        },
        {
            title: 'IP',
            dataIndex: 'ip_address',
            key: 'ip',
            render: v => <Text code style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.08)' }}>{v}</Text>
        },
        {
            title: 'MAC',
            dataIndex: 'mac_address',
            key: 'mac',
            render: v => <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}>{v}</Text>
        },
        {
            title: '⟶ Assigner au service',
            key: 'assign',
            render: (_, record) => (
                <Select
                    placeholder="Choisir un service..."
                    style={{ width: 220 }}
                    showSearch
                    allowClear
                    size="small"
                    onSelect={svcId => handleAssignDevice(record.mac_address, svcId)}
                    popupMatchSelectWidth={false}
                >
                    {services.map(s => (
                        <Option key={s.id} value={s.id}>
                            {s.name} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>({s.groupement})</span>
                        </Option>
                    ))}
                </Select>
            )
        }
    ];

    // Group devices: those with a service_id are assigned; those without are unassigned
    // Combine static and dynamic devisions
    const allGroupements = devisions.map(g => g.name);

    const groupedServices = services.reduce((acc, service) => {
        const groupObj = devisions.find(g => g.id === service.groupement_id);
        const groupKey = groupObj ? groupObj.name : 'GMI'; // Localized name
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(service);
        return acc;
    }, {});

    // All unassigned devices (no service_id)
    const unassignedDevices = devices.filter(d => !d.service_id);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                        {t('services.title')}
                    </Title>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>
                        {t('services.subtitle')}
                    </Text>
                </div>
                <Space>
                    <Button
                        icon={<SettingOutlined />}
                        onClick={() => setIsGroupModalOpen(true)}
                        size="large"
                        className="glass-button"
                        style={{ color: '#fff' }}
                    >
                        {t('services.devisions')}
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setEditingService(null);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}
                        size="large"
                        style={{ borderRadius: '12px', height: '48px', padding: '0 24px', fontWeight: '600' }}
                    >
                        {t('services.create')}
                    </Button>
                </Space>
            </div>

            <GlassCard className="animate-fade-in">
                <Tabs
                    key={allGroupements.join(',')}
                    defaultActiveKey={allGroupements.length > 0 ? allGroupements[0] : undefined}
                    type="card"
                    className="custom-tabs"
                    items={allGroupements.map(group => ({
                        key: group,
                        label: (
                            <Space size="middle">
                                <TeamOutlined style={{ color: devisions.find(g => g.name === group)?.color || '#94a3b8' }} />
                                <span style={{ fontSize: '16px', fontWeight: '600' }}>{group}</span>
                                <Badge count={(groupedServices[group] || []).length} style={{ backgroundColor: '#334155', color: '#94a3b8', boxShadow: 'none' }} />
                            </Space>
                        ),
                        children: (
                            <div style={{ paddingTop: '24px' }}>
                                <Table
                                    dataSource={groupedServices[group] || []}
                                    columns={serviceColumns}
                                    rowKey="id"
                                    loading={loading}
                                    pagination={false}
                                    style={{ marginBottom: 32 }}
                                />

                                <Divider orientation="left" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {t('services.deviceAssignment')}
                                    </Text>
                                </Divider>

                                <Collapse
                                    ghost
                                    expandIconPosition="end"
                                    style={{ marginTop: '24px' }}
                                    items={(groupedServices[group] || []).map(service => ({
                                        key: service.id,
                                        label: (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '24px' }}>
                                                <Space>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: devisions.find(g => g.name === group)?.color || service.color }} />
                                                    <Text style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{service.name}</Text>
                                                </Space>
                                                <Tag style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.5)', borderRadius: '6px' }}>
                                                    {t('services.pcCount', { count: devices.filter(d => d.service_id === service.id).length })}
                                                </Tag>
                                            </div>
                                        ),
                                        children: (
                                            <div style={{ padding: '0 16px 16px 16px' }}>
                                                <Table
                                                    dataSource={devices.filter(d => d.service_id === service.id)}
                                                    columns={deviceColumns}
                                                    rowKey="mac_address"
                                                    pagination={false}
                                                    size="small"
                                                    className="inner-table"
                                                    onRow={record => ({
                                                        onClick: () => {
                                                            if (record && record.mac_address) {
                                                                setSelectedDeviceId(record.mac_address);
                                                            }
                                                        },
                                                        style: { cursor: 'pointer' }
                                                    })}
                                                />
                                            </div>
                                        )
                                    }))}
                                />

                                {/* ── Unassigned Devices ── */}
                                {unassignedDevices.length > 0 && (
                                    <>
                                        <Divider orientation="left" style={{ borderColor: 'rgba(251,191,36,0.2)', margin: '24px 0 14px' }}>
                                            <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                ⚡ {t('services.unassignedDevices', { count: unassignedDevices.length })}
                                            </Text>
                                        </Divider>
                                        <div style={{ padding: '0 0 16px 0' }}>
                                            <Table
                                                dataSource={unassignedDevices}
                                                columns={unassignedColumns}
                                                rowKey="mac_address"
                                                pagination={false}
                                                size="small"
                                                className="inner-table"
                                                locale={{ emptyText: t('services.allAssigned') }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    }))}
                />
            </GlassCard>

            {/* Service Modal */}
            <Modal
                title={<Title level={4} style={{ color: '#fff', margin: 0 }}>{editingService ? "Modifier Service" : t('services.createNew')}</Title>}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                okText={editingService ? "Mettre à jour" : t('services.create')}
                centered
                width={500}
                styles={{
                    content: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px' },
                    header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' },
                    body: { padding: '24px' },
                    footer: { borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px' }
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateOrUpdateService}
                    initialValues={{ groupement_id: devisions.length > 0 ? devisions[0].id : undefined }}
                >
                    <Form.Item
                        name="name"
                        label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>{t('services.serviceName')}</Text>}
                        rules={[{ required: true }]}
                    >
                        <Input style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: '44px' }} />
                    </Form.Item>
                    <Form.Item
                        name="groupement_id"
                        label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>{t('services.groupement')}</Text>}
                        rules={[{ required: true }]}
                    >
                        <Select style={{ height: '44px' }}>
                            {devisions.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Devision Management Modal */}
            <Modal
                title={<Title level={4} style={{ color: '#fff', margin: 0 }}>{t('services.devisions')}</Title>}
                open={isGroupModalOpen}
                onCancel={() => setIsGroupModalOpen(false)}
                footer={null}
                centered
                width={600}
                styles={{
                    content: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px' },
                    header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' },
                    body: { padding: '24px' }
                }}
            >
                <Form
                    form={groupForm}
                    layout="vertical"
                    onFinish={handleCreateOrUpdateGroup}
                    style={{ marginBottom: 24 }}
                    initialValues={{ color: '#1890ff' }}
                >
                    <Row gutter={12}>
                        <Col span={24} style={{ marginBottom: 12 }}>
                            <Form.Item name="name" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>{t('services.devisionName')}</Text>} rules={[{ required: true }]}>
                                <Input style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: '40px' }} />
                            </Form.Item>
                        </Col>
                        <Col span={24} style={{ marginBottom: 12 }}>
                            <Form.Item name="info" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>{t('services.devisionInfo')}</Text>}>
                                <Input.TextArea rows={2} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                            </Form.Item>
                        </Col>
                        <Col>
                            <Form.Item name="color" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>{t('services.devisionColor')}</Text>}>
                                <ColorPicker showText style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', height: '40px' }} />
                            </Form.Item>
                        </Col>
                        <Col flex="auto" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 24 }}>
                            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ height: '44px', borderRadius: '8px' }}>
                                {editingGroup ? t('services.save') : t('services.addDevision')}
                            </Button>
                        </Col>
                    </Row>
                    {editingGroup && <Button onClick={() => { setEditingGroup(null); groupForm.resetFields(); }} style={{ marginTop: 8 }}>{t('services.cancel')}</Button>}
                </Form>

                <Table
                    dataSource={devisions}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                        {
                            title: t('services.devisionName'),
                            dataIndex: 'name',
                            key: 'name',
                            render: (t, record) => (
                                <Space>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: record.color }} />
                                    <Text style={{ color: '#fff' }}>{t}</Text>
                                </Space>
                            )
                        },
                        {
                            title: 'Actions',
                            key: 'actions',
                            align: 'right',
                            render: (_, record) => (
                                <Space>
                                    <Button type="text" icon={<EditOutlined />} style={{ color: '#1890ff' }} onClick={() => { setEditingGroup(record); groupForm.setFieldsValue(record); }} />
                                    <Popconfirm title={t('services.editDevision') + "?"} onConfirm={() => handleDeleteGroup(record.id)}>
                                        <Button type="text" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                </Space>
                            )
                        }
                    ]}
                />
            </Modal>

            <DeviceDrawer
                key={selectedDeviceId || 'none'}
                device={(() => {
                    if (!selectedDeviceId) return null;
                    const d = devices.find(dev => dev.mac_address === selectedDeviceId);
                    if (!d) return null;
                    return { 
                        ...d, 
                        label: d.hostname || d.ip_address || "Unknown",
                        id: d.mac_address // Ensure DeviceDrawer/AgentActionsPanel can use 'id' as MAC
                    };
                })()}
                onClose={() => setSelectedDeviceId(null)}
                onUpdate={fetchData}
            />

            <style>{`
                .custom-tabs .ant-tabs-nav-list { gap: 8px; }
                .custom-tabs .ant-tabs-tab {
                    background: rgba(255,255,255,0.03) !important;
                    border: 1px solid rgba(255,255,255,0.05) !important;
                    border-radius: 12px 12px 0 0 !important;
                    padding: 12px 24px !important;
                    transition: all 0.3s ease !important;
                }
                .custom-tabs .ant-tabs-tab-active {
                    background: rgba(255,255,255,0.08) !important;
                    border-color: rgba(255,255,255,0.1) !important;
                }
                .custom-tabs .ant-tabs-tab:hover {
                    color: #fff !important;
                    background: rgba(255,255,255,0.06) !important;
                }
                .inner-table .ant-table-thead > tr > th {
                    background: transparent !important;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .glass-button {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                }
            `}</style>
        </div>
    );
};

export default Services;
