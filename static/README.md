# IntranetAdmin Agent - Windows 7/8/10/11 Compatible ✅

## Quick Status

✅ **All agents built successfully**  
✅ **Windows 7, 10, 11 compatible**  
✅ **Last build**: 2026-01-22 15:37  
✅ **Size**: ~6 MB per executable  

## Available Files

| File | Purpose |
|------|---------|
| `agent.exe` | **RECOMMENDED** - Universal (Win7+) |
| `agent_win7.exe` | Windows 7 optimized |
| `agent_win10.exe` | Windows 10 optimized |
| `agent_win11.exe` | Windows 11 optimized |
| `DEPLOYMENT_GUIDE.md` | Full deployment instructions |

## Quick Install

```cmd
# Run as Administrator
agent.exe -install
```

## Quick Test (No Admin Required)

```cmd
agent.exe -test -hostname "TEST-PC" -mac "00:11:22:33:44:55"
```

## Rebuild All Versions

```cmd
cd ..\agent
build.bat
```

This will regenerate all 4 executables with latest changes.

## Compatibility Guaranteed ✅

All executables use:
- **CGO_ENABLED=0** - No external dependencies
- **Static linking** - Fully self-contained
- **WMIC** - Works on Win7/10/11
- **Standard Windows APIs** - Registry, netsh, shutdown

## Features

- ✅ System monitoring (CPU, RAM, OS version)
- ✅ USB blocking (Registry: USBSTOR)
- ✅ Internet blocking (Firewall rules)
- ✅ Remote commands (reboot, shutdown)
- ✅ Auto-startup installation
- ✅ 60-second check-in interval

## Documentation

- **Full Deployment Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Compatibility Details**: [../agent/WINDOWS_COMPATIBILITY.md](../agent/WINDOWS_COMPATIBILITY.md)
- **Source Code**: [../agent/main.go](../agent/main.go)

## Support

- Windows 7 SP1+ (64-bit) ✅
- Windows 10 (all versions) ✅
- Windows 11 (all versions) ✅
- Windows Server 2012+ ✅

---

**Status**: Ready for deployment 🚀
