
# 🛡️IntranetAdmin - High-End Intranet Administration Console
                                                  ![AAAA](https://github.com/user-attachments/assets/6b7e222a-57c4-42f7-a386-f5d7dc03e12f)
 IntranetAdmin is a professional, secure-by-design administration portal for local intranets. It provides real-time network visibility, device control, and an automated agent deployment pipeline through a high-end "Tier 1" SaaS user experience.

---

## ✨ Key Features

- **🌐 Live Network Topology**: Dynamic force-directed graph visualizing relationships between Servers, Switches, and End-user PC Nodes.
- **💻 Proactive Device Control**: Remote execution of administrative actions including USB storage blocking, Internet access policy enforcement, and remote Power actions (Reboot/Shutdown).
- **🚀 Automated Agent Pipeline**: Integrated "Download Center" providing pre-compiled, static binaries for Windows 7,8, 10, and 11.
- **🛡️ Enterprise Security**: Hardcoded SHARED_SECRET authentication optimized for closed intranet environments.
- **🎨 Elite UI/UX**: Deep Glassmorphism aesthetic, Dark Mode by default, and smooth Framer Motion micro-interactions.

---

## 🏗️ Technical Architecture

IntranetAdmin is built with a distributed, high-performance architecture:

### 🎨 Frontend (The Console)
- **Framework**: React 19 + Vite
- **UI System**: Ant Design Pro (Premium configuration)
- **Animation Engine**: Framer Motion
- **Design Language**: Deep Glassmorphism with centralized CSS Variable management.

### ⚙️ Backend (The Orchestrator)
- **Core**: Python FastAPI
- **Database**: SQLite (`intranetadmin_v4.db`) - The single source of truth.
- **Network Engine**: Scapy (ARP scanning & Discovery)
- **Dependencies**: Requires WinPcap/Npcap for packet injection and scanning.

### 🤖 The Agent (The Sentinel)
- **Language**: Go (Golang)
- **Profile**: Static binary (<5MB RAM), compatible with legacy Windows 7 through modern Windows 11.
- **Mechanism**: Periodic WMI data collection reporting to the central orchestrator via hardened endpoints.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Go 1.19+ (optional for agent development)
- **Windows** (Target OS for agents)

### 1-Step Concurrent Development
From the root directory, run:
```bash
npm run install:all    # Installs root and frontend deps
npm run dev            # Starts both Backend (8000) and Frontend (5173)
```

### Default Credentials
- **Username**: `Admin`
- **Password**: `Password`

---

## 📂 Structural Overview

- `/frontend`: React application source and design assets.
- `/backend`: FastAPI service logic and database models.
- `/scripts`: Database seeding and maintenance utilities.
- `/agent_source`: Source code for the Go-based sentinel agents.
- `/static`: Pre-compiled assets and download binaries.

---
---

> [!IMPORTANT]
> **Production Safety**: All modifications to services and grouping must be performed via the Web UI. Do not modify the SQLite database manually to avoid breaking relational integrity.
