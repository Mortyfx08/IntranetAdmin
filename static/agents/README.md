# IntraAdmin Agents — Zero-Download Deployment

Pre-built agents for Windows 7, 8, 10, and 11 (32-bit and 64-bit).

## Files

| File | Architecture | Target OS |
|------|--------------|-----------|
| IntraAdmin_agent_win7_x64.exe | 64-bit | Windows 7 SP1+ |
| IntraAdmin_agent_win7_x86.exe | 32-bit | Windows 7 SP1+ |
| IntraAdmin_agent_win8_x64.exe | 64-bit | Windows 8 / 8.1 |
| IntraAdmin_agent_win8_x86.exe | 32-bit | Windows 8 / 8.1 |
| IntraAdmin_agent_win10_x64.exe | 64-bit | Windows 10 |
| IntraAdmin_agent_win10_x86.exe | 32-bit | Windows 10 |
| IntraAdmin_agent_win11_x64.exe | 64-bit | Windows 11 |
| IntraAdmin_agent_win11_x86.exe | 32-bit | Windows 11 |

## Download URL

Served by FastAPI at `/download/agents/<filename>`.

## Rebuild

From project root:

```powershell
.\scripts\build_agents.ps1
```

## Requirements

- **Administrator privileges** for USB blocking, RDP, and registry policies
- **Go 1.21+** for build (Windows 7 agents may need Go 1.20 for full compatibility)
