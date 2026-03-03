# PROJECT_SPEC.md (The Blueprint)

## 1. Tech Stack
- **Agent:** Go (Golang) v1.20. (Static binary, Win7 compatible, <5MB RAM).
- **Backend:** Python FastAPI.
- **Frontend:** React + Ant Design **Pro**.
    - *Style:* "Glassmorphism" design, Dark Mode by default, smooth animations (Framer Motion).
- **Database:** SQLite.

## 2. Key Features
- **The "Download Center":** The Dashboard must have a prominent "Add Device" button that directly downloads the pre-compiled `agent.exe` from the server.
- **Intranet Security:**
    - Authentication: Hardcoded "Shared Secret" header (internal use only).
    - Transport: HTTP (Intranet).
- **Visual Network Map:** A force-directed graph (using `react-force-graph` or Ant Charts) showing the relationship between the Server, Switch, and PC Nodes.

## 3. Architecture & Data Flow
1.  **Agent:** Collects WMI data -> POST to `/api/report`.
2.  **Scanner:** Server runs `scapy` ARP scan -> Updates "Discovered" list.
3.  **Dashboard:** Polls `/api/stats` -> Renders Real-time Cards & Graphs.
## 4. Data Integrity Rules
- **Database Sovereignty:** The SQLite database (`IntranetA_v4.db`) is the single source of truth for storing data.
- **No Manual SQL Edits:** Devisions and Services MUST NOT be modified via SQL scripts or manual database queries after initialization.
- **App-Only Management:** All modifications to Devisions
 and Services (renaming, color changes, creation, deletion) MUST be performed exclusively through the Web Application UI by the Administrator.
- **WinPcap Requirement:** The Backend Server MUST NOT start if WinPcap/Npcap (in API-compatible mode) is not detected. This is a hard dependency for network scanning.
