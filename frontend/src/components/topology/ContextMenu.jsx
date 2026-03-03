import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal, Input, message, Drawer, List, Typography, Spin, Tag } from 'antd';
import { Shield, Monitor, Key, Package, X, AlertTriangle, Trash2 } from 'lucide-react';
import axios from 'axios';
import { triggerNativeRDP } from '../../utils/rdpUri';

const { Text } = Typography;

const menuStyle = {
    position: 'fixed',
    background: 'rgba(10, 17, 32, 0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    padding: '6px',
    zIndex: 10000,
    minWidth: '200px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
};

const menuItemStyle = (color = '#fff', danger = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 14px',
    borderRadius: '9px',
    cursor: 'pointer',
    color: danger ? '#ff4d4f' : color,
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.15s ease',
    userSelect: 'none',
});

const ContextMenu = ({ node, x, y, onClose, onIsolate }) => {
    const menuRef = useRef(null);
    const [hoveredItem, setHoveredItem] = useState(null);
    const [passwordModal, setPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [inventoryDrawer, setInventoryDrawer] = useState(false);
    const [inventory, setInventory] = useState([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);

    // Smart positioning to avoid going off-screen
    const [pos, setPos] = useState({ x, y });
    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            setPos({
                x: x + rect.width > vw ? x - rect.width : x,
                y: y + rect.height > vh ? y - rect.height : y,
            });
        }
    }, [x, y]);

    // Close on outside click
    useEffect(() => {
        const handle = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);



    const handleRDP = async () => {
        onClose();
        const ip = node.data.ip_address;
        const user = node.data.user_name || 'Administrator';

        if (!ip) return message.error('No IP address for this device');

        try {
            message.loading({ content: `Enabling RDP on ${ip}... Downloading RDP Launcher file`, key: 'rdp', duration: 2 });

            triggerNativeRDP({ ip, username: user });

            // 1. Tell Backend to wake up the Agent (queues ENABLE_RDP, logs rdp_sessions)
            await axios.post(`/api/control/${encodeURIComponent(node.id)}`, {
                command: 'ENABLE_RDP',
                params: { enabled: true },
                target_mac: node.id,
            });
        } catch (error) {
            message.error({ content: 'Failed to enable RDP on target', key: 'rdp' });
        }
    };

    const handleChangePassword = async () => {
        if (!newPassword.trim()) return;
        const user = node.data.user_name || 'Administrator';
        try {
            await axios.post(`/api/control/${encodeURIComponent(node.id)}`, {
                command: 'CHANGE_PASSWORD',
                params: { user, pass: newPassword },
                target_mac: node.id,
            });
            message.success(`🔑 Password change command sent`);
            setPasswordModal(false);
            setNewPassword('');
        } catch {
            message.error('Failed to send password command');
        }
    };

    const handleViewInventory = async () => {
        onClose();
        setInventoryDrawer(true);
        setInventoryLoading(true);
        try {
            const res = await axios.get(`/api/devices/${encodeURIComponent(node.id)}/inventory`, { timeout: 8000 });
            setInventory(res.data || []);
        } catch {
            setInventory([]);
        } finally {
            setInventoryLoading(false);
        }
    };


    const handleDelete = () => {
        onClose();
        Modal.confirm({
            title: <span style={{ color: '#ff4d4f' }}>⚠️ Supprimer l'appareil</span>,
            content: `Voulez-vous supprimer "${node.data.label}" (${node.data.ip_address || node.id}) de la base de données ?`,
            okText: 'Supprimer',
            okType: 'danger',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    // MAC is node.id — URL encode colons
                    await axios.delete(`/api/devices/${encodeURIComponent(node.id)}`);
                    message.success({ content: `🗑️ Appareil "${node.data.label}" supprimé`, style: { marginTop: '8vh' } });
                    if (onIsolate) onIsolate(node.id); // reuse to trigger a map refresh
                } catch (e) {
                    message.error('Échec de la suppression: ' + (e.response?.data?.detail || e.message));
                }
            }
        });
    };

    const menuItems = [
        { key: 'rdp', icon: <Monitor size={15} />, label: 'Connect via RDP', action: handleRDP, color: '#1890ff' },
        { key: 'password', icon: <Key size={15} />, label: 'Changer le mot de passe', action: () => { onClose(); setPasswordModal(true); }, color: '#faad14' },
        { key: 'inventory', icon: <Package size={15} />, label: 'All App Listing', action: handleViewInventory, color: '#52c41a' },
        { key: 'delete', icon: <Trash2 size={15} />, label: 'Supprimer l\'appareil', danger: true, action: handleDelete, color: '#ff4d4f' },
    ];

    return (
        <>
            <AnimatePresence>
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -6 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    style={{ ...menuStyle, left: pos.x, top: pos.y }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '8px 12px 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                                {node.data.label || 'Device'}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'monospace' }}>
                                {node.data.ip_address || node.id}
                            </div>
                        </div>
                        <X size={14} color="rgba(255,255,255,0.3)" onClick={onClose} style={{ cursor: 'pointer' }} />
                    </div>

                    {/* Menu Items */}
                    {menuItems.map((item) => (
                        <div
                            key={item.key}
                            style={{
                                ...menuItemStyle(item.color, item.danger),
                                background: hoveredItem === item.key
                                    ? `${item.color}18`
                                    : 'transparent',
                            }}
                            onMouseEnter={() => setHoveredItem(item.key)}
                            onMouseLeave={() => setHoveredItem(null)}
                            onClick={item.action}
                        >
                            <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                </motion.div>
            </AnimatePresence>

            {/* Change Password Modal */}
            <Modal
                title={<span style={{ color: '#faad14' }}>🔑 Changer le mot de passe — {node.data.label}</span>}
                open={passwordModal}
                onOk={handleChangePassword}
                onCancel={() => setPasswordModal(false)}
                okText="Envoyer la commande"
                okButtonProps={{ style: { background: '#faad14', border: 'none' } }}
            >
                <div style={{ padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '10px', background: 'rgba(250,173,20,0.1)', borderRadius: '8px', border: '1px solid rgba(250,173,20,0.2)' }}>
                        <AlertTriangle size={16} color="#faad14" />
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                            Cette action enverra une commande à l'agent sur {node.data.ip_address}
                        </Text>
                    </div>
                    <Input.Password
                        placeholder="Nouveau mot de passe"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        onPressEnter={handleChangePassword}
                        size="large"
                    />
                </div>
            </Modal>

            {/* Inventory Drawer */}
            <Drawer
                title={<span>📦 Inventaire — <strong>{node.data.label}</strong></span>}
                placement="right"
                onClose={() => setInventoryDrawer(false)}
                open={inventoryDrawer}
                width={400}
            >
                {inventoryLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Spin size="large" />
                    </div>
                ) : inventory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
                        <Package size={32} style={{ marginBottom: '12px' }} />
                        <div>Aucun logiciel inventorié</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>L'agent doit se connecter pour rapporter l'inventaire</div>
                    </div>
                ) : (
                    <List
                        size="small"
                        dataSource={inventory}
                        renderItem={(item) => (
                            <List.Item style={{ padding: '8px 0', borderColor: 'rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.display_name}</div>
                                        {item.display_version && (
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>v{item.display_version}</div>
                                        )}
                                    </div>
                                    {item.install_date && (
                                        <Tag style={{ fontSize: '10px' }}>{item.install_date}</Tag>
                                    )}
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Drawer>
        </>
    );
};

export default ContextMenu;
