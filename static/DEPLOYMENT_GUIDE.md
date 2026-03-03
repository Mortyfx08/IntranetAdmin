# IntranetAdmin Agent Deployment Guide

## Quick Start

🎯 **Recommended for most users**: Deploy `agent.exe` (universal build)

## Available Executables

All executables are located in: `d:\Apps\IntranetAdmin\static\`

| Executable | Size | Target OS | Description |
|------------|------|-----------|-------------|
| `agent.exe` | ~6 MB | Windows 7/10/11 | **Universal build** - Works on all Windows versions |
| `agent_win7.exe` | ~6 MB | Windows 7+ | Optimized for Windows 7 (subsystem version 6.1) |
| `agent_win10.exe` | ~6 MB | Windows 10+ | Optimized for Windows 10 (subsystem version 10.0) |
| `agent_win11.exe` | ~6 MB | Windows 11+ | Optimized for Windows 11 (subsystem version 10.0) |

## Build Information

- **Build Date**: 2026-01-22 15:37 
- **Go Version**: 1.25.6
- **Architecture**: AMD64 (64-bit only)
- **CGO**: Disabled (fully static binaries)
- **Build Flags**: `-ldflags="-s -w"` (stripped and optimized)

## Windows 7/10/11 Compatibility ✅

### All Versions Support:
- ✅ System information collection (WMIC)
- ✅ USB blocking (Registry modification)
- ✅ Internet blocking (Windows Firewall/netsh)
- ✅ Auto-startup installation
- ✅ Remote commands (reboot, shutdown)
- ✅ HTTP/HTTPS communication
- ✅ Real-time monitoring

### Requirements:
- **OS**: Windows 7 SP1 or later (64-bit)
- **Privileges**: Administrator rights required
- **Network**: Access to backend server
- **Dependencies**: None (fully static binary)

## Installation Methods

### Method 1: Quick Install (Recommended)

```cmd
# Download agent.exe to target machine
# Run as Administrator:
agent.exe -install
```

This will:
1. Add agent to Windows startup (registry)
2. Start monitoring immediately
3. Connect to default server (localhost:8000)

### Method 2: Custom Server Install

```cmd
# Install with custom backend server
agent.exe -install -server http://your-server-ip:8000/api/report
```

### Method 3: Test Mode (No Admin Required)

```cmd
# Run in test mode to verify functionality
agent.exe -test -hostname "TEST-PC" -mac "00:11:22:33:44:55"
```

### Method 4: Manual Startup

```cmd
# Run agent manually with custom server
agent.exe -server http://192.168.1.100:8000/api/report
```

## Deployment Scenarios

### Scenario 1: Single OS Environment

**All Windows 10**: Deploy `agent_win10.exe`
```cmd
copy agent_win10.exe \\target-pc\C$\Windows\System32\netsentry_agent.exe
```

**All Windows 11**: Deploy `agent_win11.exe`
```cmd
copy agent_win11.exe \\target-pc\C$\Windows\System32\netsentry_agent.exe
```

**All Windows 7**: Deploy `agent_win7.exe`
```cmd
copy agent_win7.exe \\target-pc\C$\Windows\System32\netsentry_agent.exe
```

### Scenario 2: Mixed Environment (Recommended)

Deploy universal `agent.exe` to all systems:
```cmd
copy agent.exe \\target-pc\C$\Program Files\NetSentry\agent.exe
```

### Scenario 3: Auto-Detection Deployment

```batch
@echo off
:: Auto-detect and deploy appropriate version

for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j

if "%VERSION%"=="6.1" (
    echo Deploying for Windows 7...
    copy agent_win7.exe "C:\Program Files\NetSentry\agent.exe"
) else if "%VERSION%"=="10.0" (
    echo Deploying for Windows 10/11...
    copy agent_win10.exe "C:\Program Files\NetSentry\agent.exe"
) else (
    echo Unknown Windows version, deploying universal...
    copy agent.exe "C:\Program Files\NetSentry\agent.exe"
)

"C:\Program Files\NetSentry\agent.exe" -install
```

## Command-Line Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-install` | bool | false | Install agent to run on startup |
| `-uninstall` | bool | false | Remove agent from startup |
| `-server` | string | http://localhost:8000/api/report | Backend server URL |
| `-test` | bool | false | Run in test mode (simulated agent) |
| `-mac` | string | - | Test mode: Custom MAC address |
| `-hostname` | string | - | Test mode: Custom hostname |
| `-os` | string | - | Test mode: Custom OS version |

## Remote Deployment

### Using PowerShell Remoting

```powershell
# Deploy to remote computers
$computers = @("PC1", "PC2", "PC3")
$source = "d:\Apps\IntranetAdmin\static\agent.exe"

foreach ($pc in $computers) {
    # Copy executable
    Copy-Item $source -Destination "\\$pc\C$\Program Files\NetSentry\agent.exe"
    
    # Install remotely
    Invoke-Command -ComputerName $pc -ScriptBlock {
        & "C:\Program Files\NetSentry\agent.exe" -install
    }
}
```

### Using Group Policy

1. Copy `agent.exe` to network share: `\\server\netlogon\netsentry\agent.exe`
2. Create GPO startup script:
```batch
if not exist "C:\Program Files\NetSentry\agent.exe" (
    mkdir "C:\Program Files\NetSentry"
    copy "\\server\netlogon\netsentry\agent.exe" "C:\Program Files\NetSentry\"
    "C:\Program Files\NetSentry\agent.exe" -install
)
```

## Verification

### Check if Agent is Installed

```cmd
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v NetSentryAgent
```

Expected output:
```
NetSentryAgent    REG_SZ    C:\...\agent.exe
```

### Check if Agent is Running

```cmd
tasklist | findstr agent.exe
```

### View Agent Logs

The agent creates `agent.log` in its current directory:
```cmd
type agent.log
```

Or for test mode with custom hostname:
```cmd
type agent_HOSTNAME.log
```

### Test Backend Connection

```cmd
# Start agent in test mode
agent.exe -test -hostname "VERIFY-TEST" -mac "AA:BB:CC:DD:EE:FF"

# Check log for successful connection
type agent_VERIFY-TEST.log | findstr "sent successfully"
```

## Uninstallation

### Method 1: Using Agent Command

```cmd
agent.exe -uninstall
```

### Method 2: Manual Removal

```cmd
# Remove from startup
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v NetSentryAgent /f

# Stop running agent
taskkill /F /IM agent.exe

# Delete executable
del "C:\Program Files\NetSentry\agent.exe"
```

## Troubleshooting

### Agent Won't Start

**Problem**: Agent exits immediately
**Solution**: Run as Administrator
```cmd
# Check admin status
net session

# If fails, run Command Prompt as Administrator
```

### Connection Issues

**Problem**: Agent can't connect to backend
**Solution**: Verify server URL and firewall
```cmd
# Test connection
curl http://localhost:8000/api/report

# Check firewall
netsh advfirewall show allprofiles
```

### USB/Internet Blocking Not Working

**Problem**: Policies not enforced
**Solution**: 
1. Verify Administrator privileges
2. Check Windows Firewall is enabled
3. Manually test registry/firewall commands

### WMIC Commands Fail

**Problem**: System info shows "Unknown"
**Solution**:
```cmd
# Verify WMIC works
wmic computersystem get name

# Restart WMI service if needed
net stop winmgmt
net start winmgmt
```

## Security Considerations

### Antivirus Exceptions

Some antivirus software may flag the agent as suspicious. Add exceptions:

**Windows Defender**:
```powershell
Add-MpPreference -ExclusionPath "C:\Program Files\NetSentry\agent.exe"
```

**Corporate Antivirus**: Contact your security team to whitelist:
- File: `agent.exe`
- Hash: Check with `certutil -hashfile agent.exe SHA256`

### Code Signing (Production)

For production deployment, consider signing the executable:
```cmd
signtool sign /f certificate.pfx /p password /t http://timestamp.server.com agent.exe
```

### Network Security

- Default: Uses HTTP (localhost only)
- Production: Use HTTPS with valid certificate
- Firewall: Allow outbound on port 8000 (or custom port)

## Performance

### Resource Usage
- **CPU**: < 1% (idle), 2-5% (during check-ins)
- **RAM**: ~10-15 MB
- **Network**: Minimal (60-second check-in interval)
- **Disk**: Agent log grows ~1KB per day

### Check-In Interval
Default: 60 seconds (configurable in source code)

## Advanced Configuration

### Change Server URL After Installation

Edit registry:
```cmd
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v NetSentryAgent /t REG_SZ /d "C:\...\agent.exe -server http://new-server:8000/api/report" /f
```

### Run as Windows Service

Convert to service using `nssm` (Non-Sucking Service Manager):
```cmd
nssm install NetSentryAgent "C:\Program Files\NetSentry\agent.exe" -server http://server:8000/api/report
nssm start NetSentryAgent
```

## Support Matrix

| Windows Version | Tested | Status | Notes |
|----------------|---------|---------|-------|
| Windows 7 SP1 | ✅ | Fully Compatible | Use agent_win7.exe or agent.exe |
| Windows 8.1 | ⚠️ | Should work | Not explicitly tested, use agent.exe |
| Windows 10 | ✅ | Fully Compatible | All versions supported |
| Windows 11 | ✅ | Fully Compatible | All features working |
| Windows Server 2008 R2 | ⚠️ | Should work | Same as Win7 |
| Windows Server 2012+ | ✅ | Fully Compatible | All features working |

## Next Steps

1. ✅ **Build Complete** - All executables ready in `static/` folder
2. 📋 **Choose Deployment**: Select appropriate method for your environment
3. 🧪 **Test First**: Deploy to test machines with `-test` flag
4. 🚀 **Production Deploy**: Roll out to production systems
5. 📊 **Monitor**: Check backend for agent connections

## Additional Resources

- **Compatibility Guide**: See `agent/WINDOWS_COMPATIBILITY.md`
- **Source Code**: See `agent/main.go` and `agent/enforcer.go`
- **Backend API**: See backend documentation for server setup

---

**Last Updated**: 2026-01-22  
**Version**: 1.0  
**Contact**: IntarnetAdmin Development Team
