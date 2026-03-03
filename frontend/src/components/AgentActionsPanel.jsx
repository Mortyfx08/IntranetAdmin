import React, { useState, useEffect } from 'react';
import {
    Button, Switch, Modal, Input, message, Divider, Space, Tooltip, Alert, Popconfirm, Collapse, List, Spin
} from 'antd';
import {
    ReloadOutlined, PoweroffOutlined, UsbOutlined, StopOutlined,
    DesktopOutlined, LockOutlined, DeleteOutlined, ScanOutlined,
    WarningOutlined, CheckCircleOutlined, UndoOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { Monitor, Wifi, Shield, Smartphone, Key, Trash2 } from 'lucide-react';
import axios from 'axios';
import { triggerNativeRDP } from '../utils/rdpUri';
import { useTranslation } from 'react-i18next';

/** InstalledAppsSection — fetches and displays installed apps from device, replaces Inventaire */
const InstalledAppsSection = ({ mac, sendGetInventory, loading, compact, refreshTrigger }) => {
    const { t } = useTranslation();
    const [apps, setApps] = useState([]);
    const [fetching, setFetching] = useState(false);

    const fetchApps = async () => {
        if (!mac) return;
        setFetching(true);
        try {
            const res = await axios.get(`/api/devices/${encodeURIComponent(mac)}/inventory`, { timeout: 8000 });
            setApps(res.data || []);
        } catch (e) {
            setApps([]);
        } finally {
            setFetching(false);
        }
    };

    const handleRefresh = () => {
        sendGetInventory();
        message.info({ content: t('common.loading') || 'Loading...', duration: 4 });
        setTimeout(fetchApps, 8000);
    };

    useEffect(() => {
        if (mac) fetchApps();
    }, [mac, refreshTrigger]);

    const sectionTitle = { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 };

    return (
        <div style={{ marginBottom: 8 }}>
            <div style={sectionTitle}>📦 {t('nav.services')}</div>
            <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                padding: compact ? 8 : 12, maxHeight: 180, overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{apps.length} logiciel{apps.length !== 1 ? 's' : ''}</span>
                    <Button
                        size="small"
                        icon={<ReloadOutlined spin={loading} />}
                        onClick={handleRefresh}
                        disabled={loading}
                        style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 11 }}
                    >
                        {t('common.refresh')}
                    </Button>
                </div>
                {fetching ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.4)' }}><Spin size="small" /> {t('common.loading')}</div>
                ) : apps.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
                        {t('dashboard.noDevices')}
                    </div>
                ) : (
                    <List
                        size="small"
                        dataSource={apps}
                        renderItem={(item, i) => (
                            <List.Item style={{ border: 'none', padding: '4px 0', color: '#fff', fontSize: 12 }}>
                                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{item.display_name || '—'}</span>
                                {item.display_version && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6, fontSize: 11 }}>v{item.display_version}</span>}
                            </List.Item>
                        )}
                        style={{ maxHeight: 140, overflowY: 'auto' }}
                    />
                )}
            </div>
        </div>
    );
};

/**
 * AgentActionsPanel
 * A unified panel for all remote agent actions on a single device.
 * Used in Dashboard, TopologyFlow slide-in panel, and DeviceDrawer.
 *
 * Props:
 *   device      — the device object (must have: id=MAC, label, ip_address, status,
 *                  usb_blocked, usb_ports_blocked, is_isolated, user_name)
 *   onDelete    — callback after device is deleted (optional)
 *   onRefresh   — callback to refresh parent data (optional)
 *   compact     — if true, shows a more compact layout (default: false)
 */
const AgentActionsPanel = ({ device, onDelete, onRefresh, compact = false, inventoryRefreshTrigger, getContainer }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState({});
    const [pwdModal, setPwdModal] = useState(false);
    const [pwdUser, setPwdUser] = useState(device?.user_name || '');
    const [pwdNew, setPwdNew] = useState('');
    const [pwdNew2, setPwdNew2] = useState('');
    const [rdpPwdModal, setRdpPwdModal] = useState(false);
    const [rdpPwd, setRdpPwd] = useState('');

    if (!device) return null;

    // device.mac_address = raw DB device; device.id = topology node (where id IS the MAC)
    const mac = device.mac_address || device.id;
    const isOnline = device.status === 'online';
    const isServer = device.hostname === 'IntranetAdmin' || device.group === 1;

    // ── Core send command helper ──────────────────────────────────────────
    const send = async (command, params = {}, label = command) => {
        setLoading(prev => ({ ...prev, [command]: true }));
        try {
            await axios.post(`/api/control/${encodeURIComponent(mac)}`, {
                target_mac: mac,
                command,
                params
            });
            message.success({
                content: t('device.commandQueued') || 'Command queued',
                duration: 4,
                style: { marginTop: '8vh' }
            });
            // We rely on WebSocket for the actual result; onRefresh just updates the local drawer state immediately
            if (onRefresh) onRefresh();
        } catch (e) {
            message.error({
                content: `❌ Échec: ${e.response?.data?.detail || e.message}`,
                style: { marginTop: '8vh' }
            });
        } finally {
            setLoading(prev => ({ ...prev, [command]: false }));
        }
    };

    // ── Password Reset ────────────────────────────────────────────────────
    const handlePasswordReset = () => {
        if (!pwdUser.trim()) { message.error('Entrez le nom d\'utilisateur Windows'); return; }
        if (!pwdNew.trim()) { message.error('Entrez le nouveau mot de passe'); return; }
        if (pwdNew !== pwdNew2) { message.error('Les mots de passe ne correspondent pas'); return; }
        if (pwdNew.length < 6) { message.error('Le mot de passe doit avoir au moins 6 caractères'); return; }
        send('CHANGE_PASSWORD', { user: pwdUser.trim(), pass: pwdNew }, 'Réinitialisation mot de passe');
        setPwdModal(false);
        setPwdNew('');
        setPwdNew2('');
    };

    // ── RDP (Zero-Download: rdp:// protocol) ───────────────────────────────
    const handleRDPClick = async () => {
        if (!device.ip_address) return;
        if (device.saved_password) {
            await doPrepareAndConnectRdp();
        } else {
            setRdpPwdModal(true);
        }
    };

    const doPrepareAndConnectRdp = async () => {
        try {
            setLoading(prev => ({ ...prev, ENABLE_RDP: true }));

            // Tell backend to inject using saved DB password
            const res = await axios.post(`/api/devices/${encodeURIComponent(mac)}/prepare-rdp`);

            // Enable RDP on the target
            await send('ENABLE_RDP', { enabled: true }, 'Activation RDP');

            // Trigger native RDP with the username returned by backend API
            triggerNativeRDP({ ip: device.ip_address, username: res.data.username });

            message.success('✅ Connexion RDP préparée. Si le navigateur le demande, autorisez le fichier .rdp', 4);
        } catch (e) {
            message.error(`❌ Échec RDP: ${e.response?.data?.detail || e.message}`);
        } finally {
            setLoading(prev => ({ ...prev, ENABLE_RDP: false }));
        }
    };

    const handleSaveRdpPassword = async () => {
        if (!rdpPwd.trim()) {
            message.error('Veuillez entrer le mot de passe');
            return;
        }

        try {
            setLoading(prev => ({ ...prev, SAVE_RDP: true }));
            await axios.post(`/api/devices/${encodeURIComponent(mac)}/rdp-password`, { password: rdpPwd });
            message.success('Mot de passe enregistré pour RDP');
            setRdpPwdModal(false);
            setRdpPwd("");

            if (onRefresh) onRefresh();
            device.saved_password = rdpPwd; // temporary local mutation so it works
            await doPrepareAndConnectRdp();

        } catch (e) {
            message.error(`❌ Échec de l'enregistrement: ${e.response?.data?.detail || e.message}`);
        } finally {
            setLoading(prev => ({ ...prev, SAVE_RDP: false }));
        }
    };


    // ── Reboot & Shutdown ────────────────────────────────────────────────
    // ── Delete ───────────────────────────────────────────────────────────
    const handleDelete = () => {
        Modal.confirm({
            title: <span style={{ color: '#ff4d4f' }}>⚠️ {t('services.deleteConfirm')}</span>,
            content: `${t('common.deleted')} "${device.label || device.ip_address}" ?`,
            okText: t('common.ok'), okType: 'danger', cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await axios.delete(`/api/devices/${encodeURIComponent(mac)}`);
                    message.success('🗑️ Appareil supprimé avec succès');
                    if (onDelete) onDelete();
                } catch (e) {
                    message.error('❌ Échec: ' + (e.response?.data?.detail || e.message));
                }
            }
        });
    };

    // ── Styles ────────────────────────────────────────────────────────────
    const rowStyle = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: compact ? '7px 10px' : '10px 12px',
        borderRadius: 8, marginBottom: 6,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
    };
    const labelStyle = { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.8)', fontSize: compact ? 12 : 13 };
    const sectionTitle = { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 };

    const offlineWarning = !isOnline && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <WarningOutlined style={{ color: '#fbbf24' }} />
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Appareil hors ligne. Les commandes seront exécutées au prochain redémarrage.</span>
        </div>
    );

    return (
        <div>
            {offlineWarning}

            {/* ── USB Section ── */}
            <div style={sectionTitle}>🔌 {t('device.blockUSB')}</div>

            <div style={rowStyle}>
                <div style={labelStyle}>
                    <Smartphone size={14} color="#f97316" />
                    <span>{t('device.blockAmovible')}</span>
                </div>
                <Switch
                    checked={device.usb_blocked || false}
                    loading={loading['BLOCK_STORAGE']}
                    onChange={v => send('BLOCK_STORAGE', { enabled: v }, v ? t('device.blockAmovible') : t('common.ok'))}
                    checkedChildren="🚫" unCheckedChildren="✅"
                    style={{ background: device.usb_blocked ? '#f97316' : undefined }}
                />
            </div>

            <div style={rowStyle}>
                <div style={labelStyle}>
                    <UsbOutlined style={{ color: '#fb923c', fontSize: 14 }} />
                    <span>{t('device.blockUSB')}</span>
                </div>
                <Switch
                    checked={device.usb_ports_blocked || false}
                    loading={loading['BLOCK_USB_PORTS']}
                    onChange={v => send('BLOCK_USB_PORTS', { enabled: v }, v ? t('device.blockUSB') : t('common.ok'))}
                    checkedChildren="🚫" unCheckedChildren="✅"
                    style={{ background: device.usb_ports_blocked ? '#fb923c' : undefined }}
                />
            </div>

            {/* ── Remote Access ── */}
            <div style={sectionTitle}>🖥️ {t('device.remoteControl')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <Button
                    icon={<DesktopOutlined />}
                    loading={loading['ENABLE_RDP']}
                    onClick={handleRDPClick}
                    style={{ background: 'rgba(24,144,255,0.1)', borderColor: 'rgba(24,144,255,0.3)', color: '#1890ff', height: '40px', fontWeight: 600 }}
                    block
                >
                    {t('device.remoteControl')}
                </Button>
            </div>

            {/* ── Applications installées (remplace Inventaire) ── */}
            <InstalledAppsSection mac={mac} sendGetInventory={() => send('GET_INVENTORY', {}, 'Liste des logiciels')} loading={loading['GET_INVENTORY']} compact={compact} refreshTrigger={inventoryRefreshTrigger} />

            <div style={rowStyle}>
                <div style={labelStyle}>
                    <Key size={14} color="#faad14" />
                    <span>Réinitialiser mot de passe</span>
                </div>
                <Button
                    size="small"
                    icon={<LockOutlined />}
                    onClick={() => { setPwdUser(device.user_name || ''); setPwdModal(true); }}
                    style={{ background: 'rgba(250,173,20,0.08)', borderColor: 'rgba(250,173,20,0.3)', color: '#faad14' }}
                >
                    {t('common.save')}
                </Button>
            </div>


            {/* ── Danger Zone ── */}
            {!isServer && (
                <>
                    <Divider style={{ borderColor: 'rgba(255,77,79,0.2)', margin: '14px 0 10px' }} />
                    <Button
                        block danger icon={<DeleteOutlined />}
                        onClick={handleDelete}
                        style={{ fontWeight: 700, height: 40 }}
                    >
                        🗑️ {t('common.deleted')}
                    </Button>
                </>
            )}

            {/* ── Password Modal ── */}
            <Modal
                title={<span style={{ color: '#faad14' }}>🔑 {t('device.changePassword')} — {device.label}</span>}
                open={pwdModal}
                onOk={handlePasswordReset}
                onCancel={() => { setPwdModal(false); setPwdNew(''); setPwdNew2(''); }}
                okText={t('common.save')}
                okButtonProps={{ style: { background: '#faad14', border: 'none' } }}
                cancelText="Annuler"
                getContainer={getContainer}
            >
                {/* ... existing password modal code ... */}
                <div style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 10px', background: 'rgba(250,173,20,0.08)', borderRadius: 8, border: '1px solid rgba(250,173,20,0.2)' }}>
                        <WarningOutlined style={{ color: '#faad14' }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                            {t('device.commandQueued')} <strong>{device.ip_address}</strong>.
                        </span>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>{t('login.username')}</div>
                        <Input
                            prefix={<DesktopOutlined />}
                            placeholder="Administrateur, admin, user"
                            value={pwdUser}
                            onChange={e => setPwdUser(e.target.value)}
                            size="large"
                        />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>Nouveau mot de passe</div>
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Min. 6 caractères"
                            value={pwdNew}
                            onChange={e => setPwdNew(e.target.value)}
                            size="large"
                        />
                    </div>
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>Confirmer le mot de passe</div>
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Répéter le mot de passe"
                            value={pwdNew2}
                            onChange={e => setPwdNew2(e.target.value)}
                            onPressEnter={handlePasswordReset}
                            size="large"
                            status={pwdNew2 && pwdNew !== pwdNew2 ? 'error' : ''}
                        />
                        {pwdNew2 && pwdNew !== pwdNew2 && (
                            <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 4 }}>⚠️ {t('login.error')}</div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* ── RDP Password Modal ── */}
            <Modal
                title={<span style={{ color: '#1890ff' }}>🖥️ {t('device.remoteControl')} — {device.label}</span>}
                open={rdpPwdModal}
                onOk={handleSaveRdpPassword}
                onCancel={() => { setRdpPwdModal(false); setRdpPwd(''); }}
                okText={t('common.save')}
                okButtonProps={{ style: { background: '#1890ff', border: 'none' }, loading: loading['SAVE_RDP'] }}
                cancelText={t('common.cancel')}
            >
                <div style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 10px', background: 'rgba(24,144,255,0.08)', borderRadius: 8, border: '1px solid rgba(24,144,255,0.2)' }}>
                        <WarningOutlined style={{ color: '#1890ff' }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                            Ce mot de passe sera sauvegardé et utilisé automatiquement pour les futures connexions RDP à cet appareil.
                        </span>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>{t('login.password')}</div>
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Mot de passe"
                            value={rdpPwd}
                            onChange={e => setRdpPwd(e.target.value)}
                            onPressEnter={handleSaveRdpPassword}
                            size="large"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AgentActionsPanel;
