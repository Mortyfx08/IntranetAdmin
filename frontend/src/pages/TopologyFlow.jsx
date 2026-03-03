import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    useReactFlow,
    ReactFlowProvider,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import axios from 'axios';
import { message, Spin, Button, Tooltip, Space } from 'antd';
import { ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';

import { ServerNode, DevisionNode, ServiceNode, PCNode } from '../components/topology/NodeTypes';
import FlowingEdge from '../components/topology/FlowingEdge';
import ContextMenu from '../components/topology/ContextMenu';
import AgentActionsPanel from '../components/AgentActionsPanel';
import DeviceDrawer from '../components/DeviceDrawer';

// ─── Node Type Map ────────────────────────────────────────────────────────────
const nodeTypes = {
    server: ServerNode,
    devision: DevisionNode,
    service: ServiceNode,
    pc: PCNode,
};

const edgeTypes = {
    flowing: FlowingEdge,
};

// ─── Dagre Hierarchical Layout ────────────────────────────────────────────────
// Compact sizes tuned for 40+ devices
const NODE_WIDTH = 60;
const NODE_HEIGHT = 40;

function getLayoutedElements(nodes, edges, direction = 'TB') {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: direction,
        ranksep: 45,
        nodesep: 20,
        edgesep: 10,
        marginx: 24,
        marginy: 24,
    });

    nodes.forEach((n) => {
        g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    const layoutedNodes = nodes.map((n) => {
        // If node already has a valid position (from DB or drag), keep it!
        if (n.position && (n.position.x !== 0 || n.position.y !== 0)) {
            return n;
        }

        const pos = g.node(n.id);
        return {
            ...n,
            position: {
                x: pos.x - (NODE_WIDTH / 2),
                y: pos.y - (NODE_HEIGHT / 2),
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}

// ─── Edge level lookup by source node type ────────────────────────────────────
function getEdgeLevel(sourceId, nodes) {
    const src = nodes.find(n => n.id === sourceId);
    if (!src) return 'default';
    if (src.type === 'server') return 'server';
    if (src.type === 'devision') return 'devision';
    if (src.type === 'service') return 'service';
    return 'device';
}

// ─── Map API Data → ReactFlow Nodes & Edges ───────────────────────────────────
function buildFlowElements(mapData, isolatedNodes) {
    const nodes = mapData.nodes.map((n) => {
        let type = 'pc';
        if (n.group === 1) type = 'server';
        else if (n.group === 5) type = 'devision';
        else if (n.group === 4) type = 'service';

        return {
            id: n.id,
            type,
            data: {
                ...n,
                label: n.label || n.id,
                is_isolated: isolatedNodes.has(n.id),
            },
            position: n.pos_x !== null && n.pos_y !== null
                ? { x: n.pos_x, y: n.pos_y }
                : { x: 0, y: 0 },
        };
    });

    const edges = mapData.links.map((l, i) => {
        const level = getEdgeLevel(l.source, nodes);
        return {
            id: `e-${i}-${l.source}-${l.target}`,
            source: l.source,
            target: l.target,
            type: 'flowing',
            animated: false,
            data: { level, traffic: 'normal' },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10, height: 10,
                color: '#3b82f6',
            },
        };
    });

    // Only apply dagre layout to nodes that DON'T have saved positions
    const nodesToLayout = nodes.filter(n => n.position.x === 0 && n.position.y === 0);
    if (nodesToLayout.length > 0) {
        return getLayoutedElements(nodes, edges);
    }

    return { nodes, edges };
}

// ─── Inner Component (needs ReactFlowProvider context) ────────────────────────
const TopologyFlowInner = ({ onNodeClick }) => {
    const { fitView, setCenter } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [isolatedNodes, setIsolatedNodes] = useState(new Set());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [stats, setStats] = useState({ total: 0, online: 0, isolated: 0 });
    const [selectedDevice, setSelectedDevice] = useState(null); // slide-in panel
    const [deepScanData, setDeepScanData] = useState(null);
    const [deepScanLoading, setDeepScanLoading] = useState(false);
    const [inventoryRefreshTrigger, setInventoryRefreshTrigger] = useState(0);
    const containerRef = useRef(null);
    const wsRef = useRef(null);
    const selectedDeviceRef = useRef(null);
    selectedDeviceRef.current = selectedDevice;

    const handleNodeClick = useCallback((_, node) => {
        if (node.data?.group === 3 || node.data?.group === 1) { // PC or Server nodes
            setSelectedDevice(node.data);
            setDeepScanData(null);
            if (onNodeClick) onNodeClick(node.data);
        }
    }, [onNodeClick]);

    // ── Handle node drag stop (save position) ────────────────────
    const onNodeDragStop = useCallback(async (_, node) => {
        try {
            await axios.post('/api/topology/positions', {
                node_id: node.id,
                x: Math.round(node.position.x),
                y: Math.round(node.position.y),
            });
        } catch (e) {
            console.error('Failed to save node position:', e);
        }
    }, []);

    const resetLayout = async () => {
        try {
            await axios.delete('/api/topology/positions');
            message.success('Disposition réinitialisée');
            fetchData();
        } catch (e) {
            message.error('Erreur réinitialisation');
        }
    };

    const runDeepScan = async (ip) => {
        if (!ip) return;
        setDeepScanLoading(true);
        setDeepScanData(null);
        try {
            const res = await axios.get(`/api/scan/ports?ip=${ip}`, { timeout: 30000 });
            setDeepScanData(res.data);
        } catch (e) {
            message.error('Deep scan failed: ' + (e.response?.data?.detail || e.message));
        } finally {
            setDeepScanLoading(false);
        }
    };

    const sendCommand = async (mac, cmd) => {
        try {
            await axios.post(`/api/control/${mac}`, { command: cmd, params: {} });
            message.success(`Commande '${cmd}' envoyée`);
        } catch (e) {
            message.error('Erreur envoi commande');
        }
    };

    // ── Fetch Single Device (Targeted Update) ─────────────────────────
    const fetchSingleDevice = useCallback(async (mac) => {
        if (!mac) return;
        try {
            const res = await axios.get('/api/network-map', { timeout: 10000 });
            const devData = res.data.nodes.find(n => n.mac_address === mac || n.id === mac);
            if (devData) {
                // Update nodes state
                setNodes(nds => nds.map(n => {
                    const isMatch = n.id === mac || (n.id === 'server' && n.data?.mac_address === mac);
                    if (isMatch) {
                        return { ...n, data: { ...n.data, ...devData, id: n.data.id } };
                    }
                    return n;
                }));
                // Update drawer if open
                setSelectedDevice(curr => {
                    if (!curr) return null;
                    const isMatch = curr.mac_address === mac || (curr.id === 'server' && curr.mac_address === mac);
                    if (isMatch) {
                        return { ...curr, ...devData, id: curr.id };
                    }
                    return curr;
                });
            }
        } catch (err) {
            console.error("Single device refresh failed:", err);
        }
    }, [setNodes]);

    // ── Fetch Map Data ─────────────────────────────────────────────────────
    const fetchData = useCallback(async (shouldFit = false) => {
        setLoading(true);
        setError(null);
        try {
            console.log("Fetching API /network-map...");
            const res = await axios.get('/api/network-map', { timeout: 10000 });
            console.log("API replied with:", res.data);

            const { nodes: n, edges: e } = buildFlowElements(res.data, isolatedNodes);
            console.log("Flow Elements Built:", { nodes: n.length, edges: e.length });

            setNodes(n);
            setEdges(e);

            // Compute stats
            const devNodes = res.data.nodes.filter(nd => nd.group === 3);
            setStats({
                total: devNodes.length,
                online: devNodes.filter(nd => nd.status === 'online').length,
                isolated: devNodes.filter(nd => nd.is_isolated).length,
            });

            if (shouldFit) {
                setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 100);
            }
        } catch (err) {
            console.error("UI Map Rendering Crash:", err);
            setError('Impossible de charger la carte réseau');
        } finally {
            setLoading(false);
        }
    }, [isolatedNodes, fitView]);

    useEffect(() => { fetchData(true); }, []);

    // ── WebSocket Real-time Updates ────────────────────────────────────────
    useEffect(() => {
        let ws;
        let retryTimer;
        let alive = true;

        const connect = () => {
            if (!alive) return;
            const wsUrl = `ws://${window.location.hostname}:8000/ws`;
            ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);

                    // Scan finished → reload full map so new devices appear
                    if (msg.type === 'topology_refresh') {
                        fetchData();
                        if (msg.count) {
                            message.success({
                                content: `📡 ${msg.count} appareil(s) détecté(s) — carte mise à jour`,
                                style: { marginTop: '8vh' },
                            });
                        }
                    }

                    if (msg.type === 'device_update') {
                        const dev = msg.device;
                        const isIsolated = dev.is_isolated;
                        const color = isIsolated ? '#ff4d4f' : dev.status === 'online' ? '#52c41a' : '#8c8c8c';

                        // 1. Update nodes on the map
                        setNodes(prev => prev.map(n => {
                            const isMatch = n.id === dev.mac_address || (n.id === 'server' && n.data?.mac_address === dev.mac_address);
                            if (!isMatch) return n;
                            return {
                                ...n,
                                data: { ...n.data, ...dev, id: n.data.id, is_isolated: isIsolated, color },
                            };
                        }));

                        // 2. Update drawer if open
                        setSelectedDevice(curr => {
                            if (!curr) return null;
                            const isMatch = curr.mac_address === dev.mac_address || (curr.id === 'server' && curr.mac_address === dev.mac_address);
                            if (!isMatch) return curr;
                            // Ensure we don't overwrite the React flow label/id with DB id
                            return { ...curr, ...dev, id: curr.id, label: curr.label, is_isolated: isIsolated, color };
                        });
                    }

                    if (msg.type === 'command_queued') {
                        message.info({
                            content: `📡 Commande ${msg.command} envoyée à ${msg.mac}`,
                            style: { marginTop: '8vh' },
                        });
                    }
                    if (msg.type === 'command_result') {
                        const isSuccess = msg.status === 'executed';
                        const icon = isSuccess ? '✅' : '❌';
                        const statusText = isSuccess ? 'exécutée avec succès' : 'échouée';
                        const content = `${icon} Action ${statusText} sur l'agent [${msg.mac}]`;

                        if (isSuccess) {
                            message.success({ content, style: { marginTop: '8vh' } });
                        } else {
                            message.error({
                                content: `${content}: ${msg.output || 'Erreur inconnue'}`,
                                style: { marginTop: '8vh' },
                                duration: 5
                            });
                        }
                    }
                    if (msg.type === 'inventory_updated' && msg.mac) {
                        const dev = selectedDeviceRef.current;
                        if (dev && (dev.id === msg.mac || dev.mac_address === msg.mac)) {
                            setInventoryRefreshTrigger(t => t + 1);
                        }
                    }
                } catch { }
            };

            ws.onerror = () => { };

            // Auto-reconnect so map stays live after backend restart
            ws.onclose = () => {
                if (alive) retryTimer = setTimeout(connect, 5000);
            };
        };

        connect();
        return () => {
            alive = false;
            clearTimeout(retryTimer);
            ws?.close();
        };
    }, [fetchData]);

    // ── Context Menu ───────────────────────────────────────────────────────
    const onNodeContextMenu = useCallback((event, node) => {
        if (node.type !== 'pc') return; // Only for PC nodes
        event.preventDefault();
        setContextMenu({ node, x: event.clientX, y: event.clientY });
    }, []);

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const handleIsolate = useCallback((nodeId) => {
        setIsolatedNodes(prev => new Set([...prev, nodeId]));
        setNodes(prev => prev.map(n => {
            if (n.id !== nodeId) return n;
            return { ...n, data: { ...n.data, is_isolated: true, status: 'isolated' } };
        }));
    }, []);

    // ── Fullscreen ─────────────────────────────────────────────────────────
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // ── Close menu on scroll ────────────────────────────────────────────────
    const onPaneClick = useCallback(() => setContextMenu(null), []);

    if (loading) return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', flexDirection: 'column', gap: 16,
        }}>
            <Spin size="large" />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                Chargement de la carte réseau...
            </span>
        </div>
    );

    if (error) return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', flexDirection: 'column', gap: 16,
        }}>
            <span style={{ color: '#ff4d4f', fontSize: '14px' }}>{error}</span>
            <Button onClick={fetchData} type="primary">Réessayer</Button>
        </div>
    );

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={(p) => setEdges(eds => addEdge(p, eds))}
                onNodeClick={handleNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                onNodeDragStop={onNodeDragStop}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                attributionPosition="bottom-right"
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
                defaultEdgeOptions={{ type: 'flowing' }}
            >
                {/* Premium Dot Grid Background */}
                <Background
                    variant="dots"
                    gap={24}
                    size={1}
                    color="rgba(255,255,255,0.06)"
                />

                {/* Controls – compact */}
                <Controls
                    style={{
                        background: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        position: 'absolute',
                        left: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        bottom: 'auto'
                    }}
                />

                {/* Top-Left Panel: compact stats bar */}
                <Panel position="top-left">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            background: 'rgba(10, 17, 32, 0.82)',
                            backdropFilter: 'blur(14px)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '10px',
                            padding: '6px 12px',
                            display: 'flex',
                            gap: '14px',
                            alignItems: 'center',
                        }}
                    >
                        <StatBadge label="PC" value={stats.total} color="#1890ff" />
                        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.07)' }} />
                        <StatBadge label="Online" value={stats.online} color="#52c41a" />
                    </motion.div>
                </Panel>

                {/* Top-Right Panel: icon buttons only */}
                <Panel position="top-right">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            background: 'rgba(10, 17, 32, 0.82)',
                            backdropFilter: 'blur(14px)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            display: 'flex',
                            gap: '6px',
                        }}
                    >
                        <Tooltip title="Actualiser">
                            <Button size="small" shape="circle" icon={<ReloadOutlined />} onClick={() => fetchData(true)} loading={loading}
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                        </Tooltip>
                        <Tooltip title="Réinitialiser la disposition">
                            <Button size="small" shape="circle" icon={<motion.div rotate={180}>🔄</motion.div>} onClick={resetLayout}
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px' }} />
                        </Tooltip>
                        <Tooltip title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}>
                            <Button size="small" shape="circle" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                                onClick={toggleFullscreen}
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                        </Tooltip>
                    </motion.div>
                </Panel>

                {/* Legend: moved outside ReactFlow to avoid collision with Controls */}
            </ReactFlow>



            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <ContextMenu
                        node={contextMenu.node}
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={closeContextMenu}
                        onIsolate={handleIsolate}
                    />
                )}
            </AnimatePresence>

            {/* ── Device Info Drawer ── */}
            <DeviceDrawer
                device={selectedDevice}
                onClose={() => setSelectedDevice(null)}
                // Targeted refresh only for this node, no map jump!
                onUpdate={() => fetchSingleDevice(selectedDevice?.mac_address || selectedDevice?.id)}
                getContainer={() => containerRef.current}
            />
        </div>
    );
};

// ─── Stat Badge – compact version ────────────────────────────────────────────
const StatBadge = ({ label, value, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ color, fontSize: '15px', fontWeight: 800, lineHeight: 1 }}>{value}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
    </div>
);

// ─── Legend – slim horizontal bar at bottom-left ─────────────────────────────
const LegendPanel = () => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
            background: 'rgba(10, 17, 32, 0.8)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
        }}
    >
        {[
            { color: '#3b82f6', label: 'Serveur' },
            { color: '#60a5fa', label: 'Devision' },
            { color: '#93c5fd', label: 'Service' },
            { color: '#52c41a', label: 'Online' },
            { color: '#8c8c8c', label: 'Offline' },
        ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px' }}>{label}</span>
            </div>
        ))}
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', paddingLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
            💡 Clic-droit
        </div>
    </motion.div>
);

// ─── CSS Animation Injection ───────────────────────────────────────────────────
const injectCSS = () => {
    if (document.getElementById('topology-css')) return;
    const style = document.createElement('style');
    style.id = 'topology-css';
    style.textContent = `
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.3); }
        }
        @keyframes flow-dash {
            to { stroke-dashoffset: -24; }
        }
        .react-flow__edge-path {
            animation: flow-dash 1.2s linear infinite;
        }
        .react-flow__node {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease !important;
        }
        .react-flow__node:hover {
            filter: brightness(1.15) drop-shadow(0 0 12px rgba(24,144,255,0.4));
        }
        .react-flow .react-flow__controls button {
            background: rgba(15, 23, 42, 0.9) !important;
            border-color: rgba(255,255,255,0.1) !important;
            color: rgba(255,255,255,0.7) !important;
            fill: rgba(255,255,255,0.7) !important;
        }
        .react-flow .react-flow__controls button:hover {
            background: rgba(24, 144, 255, 0.15) !important;
            color: #1890ff !important;
            fill: #1890ff !important;
        }
        .react-flow__minimap-mask { fill: rgba(10, 17, 32, 0.7) !important; }
    `;
    document.head.appendChild(style);
};

// ─── Main Export (with ReactFlowProvider) ─────────────────────────────────────
const TopologyFlow = (props) => {
    useEffect(() => { injectCSS(); }, []);

    return (
        <ReactFlowProvider>
            <TopologyFlowInner {...props} />
        </ReactFlowProvider>
    );
};

export default TopologyFlow;
