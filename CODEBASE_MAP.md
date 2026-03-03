# 🗺️ Codebase Map: IntranetAdmin

This document provides a high-level overview of the NetSentry/IntranetAdmin project structure to help you navigate and find items quickly.

## 🏗️ Architecture Overview

The project is a full-stack application for network monitoring and agent management.
- **Backend**: Python (FastAPI) with SQLAlchemy & Scapy.
- **Frontend**: React (JSX) with Zustand for state management.
- **Agents**: Go-based binaries (pre-compiled in `static/`).

---

## 📁 Directory Breakdown

### 📂 `backend/` (Core Logic)
The heart of the server-side operations.
- [main.py](file:///d:/Apps/IntranetAdmin/backend/main.py): FastAPI entry point, defines all API routes (Auth, Scanning, Devices, Actions).
- [scanner.py](file:///d:/Apps/IntranetAdmin/backend/scanner.py): Network scanning engine using Scapy. Handles IP/MAC discovery.
- [models.py](file:///d:/Apps/IntranetAdmin/backend/models.py): Database schemas (SQLAlchemy). Defines `Device`, `User`, `ScanResult`, etc.
- [schemas.py](file:///d:/Apps/IntranetAdmin/backend/schemas.py): Pydantic models for API request/response validation.
- [database.py](file:///d:/Apps/IntranetAdmin/backend/database.py): SQLite/PostgreSQL connection setup.

### 📂 `frontend/src/` (Web UI)
Built with React and a modern "Cyber-Hacker" aesthetic.
- **`pages/`**:
    - [Dashboard.jsx](file:///d:/Apps/IntranetAdmin/frontend/src/pages/Dashboard.jsx): Main topology map and real-time network overview.
    - [Services.jsx](file:///d:/Apps/IntranetAdmin/frontend/src/pages/Services.jsx): Management of network services and detailed device views.
    - [Scanner.jsx](file:///d:/Apps/IntranetAdmin/frontend/src/pages/Scanner.jsx): Control panel for starting discovery scans.
- **`components/`**:
    - [DeviceDrawer.jsx](file:///d:/Apps/IntranetAdmin/frontend/src/components/DeviceDrawer.jsx): Slide-out panel for device details and agent actions.
    - [TopologyHUD.jsx](file:///d:/Apps/IntranetAdmin/frontend/src/components/TopologyHUD.jsx): Overlay controls for the network map.
- **`store/`**:
    - [topologyStore.js](file:///d:/Apps/IntranetAdmin/frontend/src/store/topologyStore.js): Global state for network nodes and edges.

### 📂 `static/` (Assets & Agents)
- `agent_win*.exe`: Pre-compiled Windows agents for persistence and control.
- [DEPLOYMENT_GUIDE.md](file:///d:/Apps/IntranetAdmin/static/DEPLOYMENT_GUIDE.md): Instructions for installing agents on targets.

### 📂 `scripts/`
- [seed_db.py](file:///d:/Apps/IntranetAdmin/scripts/seed_db.py): Utility to populate the database with initial or test data.

---

## 🔑 Key Configuration & Entry Points
- [package.json](file:///d:/Apps/IntranetAdmin/package.json): Root script manager. Use `npm run dev` to start everything.
- [requirements.txt](file:///d:/Apps/IntranetAdmin/requirements.txt): Python dependencies.
- [start_backend.ps1](file:///d:/Apps/IntranetAdmin/start_backend.ps1): PowerShell script to launch the backend server.
- [netsentry_v4.db](file:///d:/Apps/IntranetAdmin/netsentry_v4.db): The local SQLite database.

---

## 🚀 Common Navigation Paths
- **Developing a new API**: Start in `backend/main.py` -> `backend/schemas.py` -> `backend/models.py`.
- **Modifying the UI**: Look in `frontend/src/pages/` for high-level views or `frontend/src/components/` for reusable widgets.
- **Fixing Scans**: Go directly to `backend/scanner.py`.
