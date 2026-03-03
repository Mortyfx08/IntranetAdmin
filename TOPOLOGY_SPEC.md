# IntranetAdmin- Network Topology Specification

## Overview
The IntranetAdmin Topology Map is a high-performance, interactive visualization built using `react-force-graph-2d`. It serves as the primary command center for network administrators, providing real-time status and control over the CIT Intranet.

---

## 1. Data Model & TypeScript Interfaces

```typescript
interface NetworkNode {
  id: string;          // MAC Address for devices, unique string for infra
  label: string;       // Hostname or Service Name
  group: number;       // 1: Server, 2: Switch, 3: PC, 4: Service, 5: Groupement
  level: number;       // 1-5 hierarchy level
  parentId?: string;   // For hierarchical linking
  status: 'online' | 'offline';
  color: string;       // Inherited HSL/Hex color
  
  // Dynamic Stats
  cpu_usage?: number;
  ram_usage?: number;
  user_name?: string;
  
  // Force Graph Internal State
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink {
  source: string;
  target: string;
  value?: number;      // Link strength
}
```

---

## 2. Advanced Visual Logic (Canvas API)

### 2.1 The "Neon Glow" Render (`nodeCanvasObject`)
To achieve a premium "Command Center" aesthetic, we will implement a custom drawing loop:

1.  **Glow Layer (Aura):**
    *   If `node.status === 'online'`, create a `ctx.createRadialGradient`.
    *   Gradient stops: `0% -> node.color (alpha 0.6)`, `100% -> transparent`.
    *   Radius: `nodeSize * 3`.
2.  **Node Body:**
    *   Draw a solid circle using `ctx.arc`.
    *   Fill with `node.color`.
    *   Add a subtle white inner stroke for Level 1 & 2 (Infrastructure).
3.  **Level of Detail (LoD) Labels:**
    *   Calculate `globalScale`.
    *   If `globalScale > 1.5` or `node.isHovered`:
        *   Render `node.label` below the node.
        *   Render `node.ip_address` in a smaller, secondary font.
    *   Use `ctx.shadowBlur` and `ctx.shadowColor` for text readability against the dark background.

### 2.2 Link Particles
*   Use `linkDirectionalParticles={2}`.
*   `linkDirectionalParticleSpeed={d => d.value * 0.01}`.
*   Particles will represent "heartbeats" traveling from the **Core Switch** to the **Devices**.

---

## 3. Physics & Layout Configuration

### 3.1 Force Engine Tweaks
*   **Collision:** Implement `d3.forceCollide().radius(d => d.size * 1.5)` to prevent node overlap.
*   **Charge:** Use a strong negative many-body force (`-200`) to keep branches separated.
*   **Centering:** Keep the **NetSentry Server** and **Core Switch** fixed at the center using `fx` and `fy`.

### 3.2 Layout Modes
*   **Organic Mode:** Standard D3 force-directed layout for a natural "cloud" look.
*   **Tree Mode:** Apply a hierarchical layout where nodes are positioned based on their `level` (Top-Down).
    *   Level 1: `y = 0`
    *   Level 2: `y = 100`
    *   Level 3: `y = 200` ...and so on.

---

## 4. Interaction & State Management

### 4.1 Drill-Down & Focus
*   **On Groupement Click:**
    1.  Calculate the bounding box of all children.
    2.  Use `graphRef.current.zoomToFit(400, 100, node => isChildOf(node, clickedNode))`.
    3.  Dim all other nodes using `ctx.globalAlpha`.
*   **On Device Click:**
    1.  Trigger `setSelectedDevice(node)` via Zustand/Context.
    2.  Open the `DeviceDrawer` component.

### 4.2 Drag & Pin Behavior
*   `onNodeDrag`: Set `node.fx = node.x` and `node.fy = node.y`.
*   `onNodeDragEnd`: Keep `fx/fy` values to "pin" the node in place.
*   **Reset:** Double-click a node to set `fx = null, fy = null` and release it back to the force engine.

---

## 5. Implementation Checklist

- [x] **Schema Update:** Add `level` and `status` to `NetworkNode` Pydantic model.
- [x] **Canvas Engine:** Implement the `nodeCanvasObject` with radial gradients.
- [x] **LoD Text:** Add scale-dependent label rendering.
- [x] **Zustand Store:** Create `useTopologyStore` for `selectedNode` and `layoutMode`.
- [x] **Search Engine:** Add a search bar that uses `graphRef.current.centerAt(x, y, 1000)` to fly to a node.
- [x] **Link Particles:** Implement directional particles for active links.
- [x] **Dagre Toggle:** Add a UI switch to toggle between Organic and Hierarchical layouts.
