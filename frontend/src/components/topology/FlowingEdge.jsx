import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    getStraightPath,
    getSmoothStepPath,
} from 'reactflow';

// ─── Network Flow CSS (injected once) ────────────────────────────────────────
const injectFlowCSS = (() => {
    let done = false;
    return () => {
        if (done) return;
        done = true;
        const style = document.createElement('style');
        style.textContent = `
            @keyframes networkFlow {
                from { stroke-dashoffset: 20; }
                to   { stroke-dashoffset: 0;  }
            }
            @keyframes networkFlowFast {
                from { stroke-dashoffset: 20; }
                to   { stroke-dashoffset: 0;  }
            }
            .flow-edge-normal {
                stroke-dasharray: 6 3;
                animation: networkFlow 1.4s linear infinite;
            }
            .flow-edge-high {
                stroke-dasharray: 5 2;
                animation: networkFlowFast 0.6s linear infinite;
            }
            .flow-edge-low {
                stroke-dasharray: 8 5;
                animation: networkFlow 2.5s linear infinite;
            }
            .flow-edge-devision {
                stroke-dasharray: 8 4;
                animation: networkFlow 1.8s linear infinite;
            }
        `;
        document.head.appendChild(style);
    };
})();

// ─── Colour map by edge "level" ───────────────────────────────────────────────
const edgeColors = {
    server: { stroke: '#3b82f6', glow: 'rgba(59,130,246,0.4)', width: 2.0 },
    devision: { stroke: '#60a5fa', glow: 'rgba(96,165,250,0.35)', width: 1.6 },
    service: { stroke: '#93c5fd', glow: 'rgba(147,197,253,0.35)', width: 1.4 },
    device: { stroke: '#bfdbfe', glow: 'rgba(191,219,254,0.25)', width: 1.2 },
    default: { stroke: '#3b82f6', glow: 'rgba(59,130,246,0.2)', width: 1.2 },
};

/**
 * FlowingEdge — custom ReactFlow edge with:
 *  - Marching ants / network-flow animation
 *  - Traffic intensity → animation speed
 *  - Source-to-target directional flow
 *  - Glowing SVG filter per node level
 */
const FlowingEdge = ({
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    data = {},
    markerEnd,
    style = {},
}) => {
    injectFlowCSS();

    const traffic = data?.traffic || 'normal';  // 'low' | 'normal' | 'high'
    const level = data?.level || 'default';  // 'server' | 'devision' | 'service' | 'device'
    const color = data?.color || edgeColors[level]?.stroke || edgeColors.default.stroke;
    const glow = edgeColors[level]?.glow || edgeColors.default.glow;
    const width = edgeColors[level]?.width || edgeColors.default.width;

    const flowClass = traffic === 'high'
        ? 'flow-edge-high'
        : traffic === 'low'
            ? 'flow-edge-low'
            : level === 'devision'
                ? 'flow-edge-devision'
                : 'flow-edge-normal';

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
    });

    const filterId = `glow-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;

    return (
        <>
            {/* SVG filter for glow effect */}
            <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <defs>
                    <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                        <feColorMatrix
                            in="blur" type="matrix"
                            values={`0 0 0 0 ${parseInt(color.slice(1, 3), 16) / 255}
                                     0 0 0 0 ${parseInt(color.slice(3, 5), 16) / 255}
                                     0 0 0 0 ${parseInt(color.slice(5, 7), 16) / 255}
                                     0 0 0 0.8 0`}
                            result="colorBlur"
                        />
                        <feMerge>
                            <feMergeNode in="colorBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Glow under-layer (static wide stroke) */}
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: color,
                    strokeWidth: width * 2.5,
                    opacity: 0.18,
                    filter: `url(#${filterId})`,
                    ...style,
                }}
            />

            {/* Animated primary edge */}
            <path
                className={`react-flow__edge-path ${flowClass}`}
                d={edgePath}
                fill="none"
                stroke={color}
                strokeWidth={width}
                opacity={0.85}
                markerEnd={markerEnd}
                style={{ filter: `drop-shadow(0 0 3px ${glow})` }}
            />
        </>
    );
};

export default FlowingEdge;
