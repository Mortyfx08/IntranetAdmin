import React from 'react';
import { Handle, Position } from 'reactflow';
import { Monitor, Server, Network, Laptop, Shield, WifiOff, Cpu, Users } from 'lucide-react';

// ─── Shared pulse-dot CSS (injected once) ────────────────────────────────────
const injectNodeCSS = (() => {
    let done = false;
    return () => {
        if (done) return; done = true;
        const s = document.createElement('style');
        s.textContent = `
            @keyframes nodePulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50%       { transform: scale(1.5); opacity: 0.6; }
            }
            @keyframes nodeGlowPulse {
                0%, 100% { box-shadow: 0 0 4px currentColor, 0 0 8px currentColor; }
                50%       { box-shadow: 0 0 8px currentColor, 0 0 16px currentColor; }
            }
            .sentinel-node:hover {
                transform: translateY(-2px) scale(1.02) !important;
                z-index: 10;
            }
        `;
        document.head.appendChild(s);
    };
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PulseDot = ({ color, active, size = 7 }) => (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        {/* Ripple ring */}
        {active && (
            <span style={{
                position: 'absolute', inset: -4,
                border: `1.5px solid ${color}`,
                borderRadius: '50%',
                animation: 'nodePulse 2s ease-in-out infinite',
                pointerEvents: 'none',
            }} />
        )}
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: color,
            boxShadow: active ? `0 0 6px ${color}` : 'none',
        }} />
    </div>
);

/** Small glassmorphic badge showing group initials */
const GroupBadge = ({ label, color }) => (
    <div style={{
        position: 'absolute', top: -7, right: -7,
        background: `${color}25`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${color}60`,
        borderRadius: '6px',
        padding: '1px 5px',
        fontSize: '8px',
        fontWeight: 800,
        color,
        letterSpacing: '0.5px',
        lineHeight: 1.4,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        zIndex: 5,
    }}>
        {label}
    </div>
);

// ─── SERVER NODE ─────────────────────────────────────────────────────────────
export const ServerNode = ({ data, selected }) => {
    injectNodeCSS();
    return (
        <div className="sentinel-node" style={{
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'rgba(10, 17, 32, 0.92)',
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${selected ? '#fbbf24' : 'rgba(251,191,36,0.45)'}`,
            boxShadow: selected
                ? '0 0 20px rgba(251,191,36,0.4), inset 0 0 10px rgba(251,191,36,0.04)'
                : '0 0 10px rgba(251,191,36,0.15)',
            minWidth: '100px',
            textAlign: 'center',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            cursor: 'pointer',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <PulseDot color={data.status === 'online' ? '#52c41a' : '#8c8c8c'} active={data.status === 'online'} size={6} />
                <Server size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '11px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                    {data.label}
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: '#fbbf24', border: '1px solid #0f172a', width: 6, height: 6 }} />
        </div>
    );
};

// ─── DEVISION NODE ───────────────────────────────────────────────────────────
export const DevisionNode = ({ data, selected }) => {
    injectNodeCSS();
    const c = data.color || '#818cf8';
    return (
        <div className="sentinel-node" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(10, 17, 32, 0.9)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${selected ? c : c + '65'}`,
            boxShadow: `0 0 10px ${c}22`,
            minWidth: '94px',
            textAlign: 'center',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            cursor: 'pointer',
        }}>
            <Handle type="target" position={Position.Top} style={{ background: c, border: '1px solid #0f172a', width: 5, height: 5 }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Users size={14} color={c} style={{ flexShrink: 0 }} />
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '10px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70px' }}>{data.label}</div>
            </div>

            <Handle type="source" position={Position.Bottom} style={{ background: c, border: '1px solid #0f172a', width: 5, height: 5 }} />
        </div>
    );
};

// ─── SERVICE NODE ─────────────────────────────────────────────────────────────
export const ServiceNode = ({ data, selected }) => {
    injectNodeCSS();
    const c = data.color || '#38bdf8';
    return (
        <div className="sentinel-node" style={{
            padding: '5px 10px',
            borderRadius: '8px',
            background: 'rgba(10, 17, 32, 0.9)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${selected ? c : c + '55'}`,
            boxShadow: `0 0 8px ${c}20`,
            minWidth: '90px',
            textAlign: 'center',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            cursor: 'pointer',
        }}>
            <Handle type="target" position={Position.Top} style={{ background: c, border: '1px solid #0f172a', width: 4, height: 4 }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Network size={12} color={c} style={{ flexShrink: 0 }} />
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '10px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65px' }}>{data.label}</div>
            </div>

            <Handle type="source" position={Position.Bottom} style={{ background: c, border: '1px solid #0f172a', width: 4, height: 4 }} />
        </div>
    );
};

// ─── PC / DEVICE NODE (SentinelNode) ─────────────────────────────────────────
export const PCNode = ({ data, selected }) => {
    injectNodeCSS();

    const isOnline = data.status === 'online';
    const isIsolated = data.is_isolated;

    // Status color — green/grey/red based on actual connectivity
    const statusColor = isIsolated ? '#ff4d4f' : isOnline ? '#4ade80' : '#6b7280';

    // Accent color — inherited from service or devision
    const accentColor = data.service_color || (data.color && data.color !== '#52c41a' && data.color !== '#8c8c8c' ? data.color : statusColor);

    const Icon = isIsolated ? WifiOff : Monitor;

    return (
        <div className="sentinel-node" style={{
            padding: '4px',
            borderRadius: '10px',
            background: 'rgba(10, 17, 32, 0.92)',
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${selected ? accentColor : accentColor + '70'}`,
            boxShadow: selected
                ? `0 0 20px ${accentColor}60, inset 0 0 10px ${accentColor}10`
                : `0 0 8px ${accentColor}30`,
            minWidth: '42px',
            textAlign: 'center',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            cursor: 'pointer',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <PulseDot color={statusColor} active={isOnline && !isIsolated} size={6} />
                <Icon size={16} color={accentColor} style={{ flexShrink: 0 }} />
            </div>

            <Handle type="target" position={Position.Top} style={{ background: accentColor, border: '1px solid #0f172a', width: 6, height: 6 }} />
            <Handle type="source" position={Position.Bottom} style={{ background: accentColor, border: '1px solid #0f172a', width: 6, height: 6 }} />
        </div>
    );
};
