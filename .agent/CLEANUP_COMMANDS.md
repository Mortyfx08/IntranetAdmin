# Cleanup Commands for IntranetAdmin

## Test Files & Simulation Cleanup

```powershell
# Remove simulation/test files
Remove-Item -Path "d:\Apps\IntranetAdmin\simulate_fleet.py" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\send_command.py" -Force -ErrorAction SilentlyContinue
```

## Python Cache Cleanup

```powershell
# Remove Python cache files
Remove-Item -Path "d:\Apps\IntranetAdmin\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\*.pyc" -Force -ErrorAction SilentlyContinue
```

## Log Files Cleanup

```powershell
# Remove log files
Remove-Item -Path "d:\Apps\IntranetAdmin\*.log" -Force -ErrorAction SilentlyContinue
```

## Build Artifacts Cleanup

```powershell
# Clean agent build artifacts
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\out" -Recurse -Force -ErrorAction SilentlyContinue
```

## Node Modules Cleanup (Heavy - Only if needed)

```powershell
# Clean node_modules (requires reinstall after)
Remove-Item -Path "d:\Apps\IntranetAdmin\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\node_modules" -Recurse -Force -ErrorAction SilentlyContinue

# After removal, reinstall:
# npm install
# cd agent
# npm install
```

## Complete Cleanup (All in one)

```powershell
# Run this block to clean everything at once
Remove-Item -Path "d:\Apps\IntranetAdmin\simulate_fleet.py" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\send_command.py" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\*.pyc" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\*.log" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "d:\Apps\IntranetAdmin\agent\out" -Recurse -Force -ErrorAction SilentlyContinue
```

## Quick Cleanup (Most Common)

```powershell
# Quick cleanup for daily use
Remove-Item simulate_fleet.py, send_command.py -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse __pycache__ -Force -ErrorAction SilentlyContinue
Remove-Item *.log -Force -ErrorAction SilentlyContinue
```

---

**Note:** Run these commands from `d:\Apps\IntranetAdmin\` directory as Administrator for best results.
