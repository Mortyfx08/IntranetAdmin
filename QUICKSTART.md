# IntranetAdmin- Quick Start Guide

## Installation

### Prerequisites
- Python 3.8+ with pip
- Node.js 16+ with npm
- Go 1.19+ (for agent development)
- Windows OS (for agent deployment)

### 1. Backend Setup
```bash
# Install Python dependencies
pip install fastapi uvicorn sqlalchemy scapy bcrypt

# Seed database with admin user and default services
python -m scripts.seed_db

# Start backend server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Access Application
- **URL**: http://localhost:5173
- **Username**: Admin
- **Password**: Password

## Agent Deployment

### Download Agent
1. Log in to NetSentry dashboard
2. Navigate to "Download Agent" (Télécharger Agent)
3. Download the appropriate version:
   - `agent_win7.exe` for Windows 7
   - `agent_win8.exe` for Windows 8
   - `agent_win10.exe` for Windows 10
   - `agent_win11.exe` for Windows 11

### Install Agent
```bash
# Run as Administrator
# 1. Install as startup service
agent_win10.exe -install

# 2. Manual start (after installation)
& "C:\Program Files\NetSentryAgent\agent.exe"

# 3. Specify custom server IP
agent_win10.exe -server http://<IP>:8000/api/report
```

### Uninstall Agent
```bash
# Run as Administrator
agent_win10.exe -uninstall
```

## Using the Dashboard

### 1. Network Topology
- View real-time network map
- Color-coded by service group
- Click devices to open control panel

### 2. Services Management
Navigate to "Services" to:
- View GMI, GCS, GEI groupements
- Create new services/bureaus
- Assign devices to services
- View devices per service

### 3. Device Control
Click any device to:
- Edit user name (person using PC)
- Assign to service/bureau
- Block USB storage
- Block internet access
- Reboot or shutdown remotely


## Troubleshooting


### Backend won't start
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process if needed
taskkill /PID <PID> /F
```

### Frontend won't start
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Agent not reporting
1. Check if backend is running
2. Verify `ServerURL` in agent code matches backend address
3. Check Windows Firewall settings
4. Verify shared secret matches

### Database issues
```bash
# Reset database
del netsentry_v4.db
python -m scripts.seed_db
```

## API Testing

### Login
```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin","password":"Password"}'
```

### Get Network Map
```bash
curl http://localhost:8000/api/network-map
```

### Create Service
```bash
curl -X POST http://localhost:8000/api/services \
  -H "Content-Type: application/json" \
```

## Production Deployment

### Backend
```bash
# Use production ASGI server
pip install gunicorn
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend
```bash
# Build for production
npm run build

# Serve with nginx or similar
```

### Security Recommendations
1. Change default admin password
2. Update `SHARED_SECRET` in backend/main.py
3. Use HTTPS in production
4. Configure firewall rules
5. Regular database backups

## Support
For issues or questions, refer to:
- PROJECT_DOCUMENTATION.md - Full technical documentation
- TODO_V2.md - Feature roadmap and known issues
