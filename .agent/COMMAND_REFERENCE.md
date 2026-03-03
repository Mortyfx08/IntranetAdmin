# IntranetAdmin Command Reference

> **IMPORTANT:** All commands should be provided to the user for manual execution.
> DO NOT auto-run commands - user will run them as administrator when needed.

---

## Server Commands

### Start Frontend (Agent Dashboard)
```powershell
cd d:\Apps\IntranetAdmin\agent
npm run dev
```

### Start Backend (Flask API)
```powershell
cd d:\Apps\IntranetAdmin
python app.py
```
Or using the PowerShell script:
```powershell
.\start_backend.ps1
```

### Start Both Servers
```powershell
# Terminal 1 - Backend
cd d:\Apps\IntranetAdmin
python app.py

# Terminal 2 - Frontend
cd d:\Apps\IntranetAdmin\agent
npm run dev
```

---

## Installation & Setup Commands

### Initial Setup
```powershell
# Install backend dependencies
cd d:\Apps\IntranetAdmin
pip install -r requirements.txt

# Install frontend dependencies
cd d:\Apps\IntranetAdmin\agent
npm install
```

### Reinstall Dependencies
```powershell
# Backend
cd d:\Apps\IntranetAdmin
pip install -r requirements.txt --force-reinstall

# Frontend
cd d:\Apps\IntranetAdmin\agent
Remove-Item -Recurse -Force node_modules
npm install
```

---

## Build Commands

### Build Frontend for Production
```powershell
cd d:\Apps\IntranetAdmin\agent
npm run build
```

### Build Agent Executable
```powershell
cd d:\Apps\IntranetAdmin\agent
# Add build command here if needed
```

---

## Cleanup Commands

### Remove Test/Simulation Files
```powershell
cd d:\Apps\IntranetAdmin
Remove-Item -Path "simulate_fleet.py" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "send_command.py" -Force -ErrorAction SilentlyContinue
```

### Remove Python Cache
```powershell
cd d:\Apps\IntranetAdmin
Remove-Item -Path "__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.pyc" -Force -ErrorAction SilentlyContinue
```

### Remove Log Files
```powershell
cd d:\Apps\IntranetAdmin
Remove-Item -Path "*.log" -Force -ErrorAction SilentlyContinue
```

### Remove Build Artifacts
```powershell
cd d:\Apps\IntranetAdmin\agent
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue
```

### Complete Cleanup
```powershell
cd d:\Apps\IntranetAdmin
Remove-Item -Path "simulate_fleet.py" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "send_command.py" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.pyc" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.log" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "agent\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "agent\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "agent\out" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## Database Commands

### Initialize/Reset Database
```powershell
cd d:\Apps\IntranetAdmin
python
```
Then in Python:
```python
from app import db
db.create_all()
exit()
```

### Database Migrations (if using Flask-Migrate)
```powershell
cd d:\Apps\IntranetAdmin
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

---

## Testing Commands

### Run Backend Tests
```powershell
cd d:\Apps\IntranetAdmin
pytest
```

### Run Frontend Tests
```powershell
cd d:\Apps\IntranetAdmin\agent
npm test
```

---

## Git Commands

### Commit Changes
```powershell
git add .
git commit -m "Your commit message"
git push
```

### Pull Latest Changes
```powershell
git pull origin main
```

### Create New Branch
```powershell
git checkout -b feature/branch-name
```

---

## Process Management

### Kill Process on Port (if needed)
```powershell
# Find process on port 5000 (backend)
netstat -ano | findstr :5000

# Kill process by PID
taskkill /PID <PID> /F

# Find process on port 3000 (frontend)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### View Running Processes
```powershell
Get-Process -Name python
Get-Process -Name node
```

---

## System Information

### Check Python Version
```powershell
python --version
```

### Check Node Version
```powershell
node --version
npm --version
```

### Check Installed Packages
```powershell
# Python packages
pip list

# Node packages
cd d:\Apps\IntranetAdmin\agent
npm list
```

---

## Agent Commands

### Deploy Agent to Test Machine
```powershell
# Copy agent.exe to target machine
Copy-Item -Path "d:\Apps\IntranetAdmin\static\agent.exe" -Destination "\\TARGET-PC\C$\Path\To\Destination"
```

### Check Agent Compatibility
```powershell
# Run agent with version check
cd d:\Apps\IntranetAdmin\static
.\agent.exe --version
```

---

## Quick Reference

### Daily Startup
```powershell
# Terminal 1
cd d:\Apps\IntranetAdmin
python app.py

# Terminal 2
cd d:\Apps\IntranetAdmin\agent
npm run dev
```

### Daily Cleanup
```powershell
cd d:\Apps\IntranetAdmin
Remove-Item *.log -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse __pycache__ -Force -ErrorAction SilentlyContinue
```
