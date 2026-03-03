# IntraAdmin Agent Build Script
# Builds 32-bit and 64-bit agents for Windows 7, 8, 10, 11
# Output: static/ folder (served by FastAPI for zero-download deployment)

$ErrorActionPreference = "Stop"
$sourceDir = Join-Path $PSScriptRoot "..\agent_source"
$outDir = Join-Path $PSScriptRoot "..\static\agents"
$mainGo = Join-Path $sourceDir "main.go"

if (-not (Test-Path $mainGo)) {
    Write-Error "Agent source not found: $mainGo"
}

# Ensure output directory exists
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

# Auto-detect Server IP for the agent's default connection URL
$serverIp = "127.0.0.1"
try {
    $addr = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' -and $_.IPAddress -notmatch '^169\.' } |
        Select-Object -First 1
    if ($addr) { $serverIp = $addr.IPAddress }
} catch { }
$targetUrl = "http://${serverIp}:8000/api/report"
Write-Host "Baking default Server URL into Agents: $targetUrl" -ForegroundColor Cyan

Push-Location $sourceDir

$builds = @(
    @{ Name = "win7_x64";  GOOS = "windows"; GOARCH = "amd64"; Sim = "Windows7";  Out = "IntraAdmin_agent_win7_x64.exe" },
    @{ Name = "win7_x86";  GOOS = "windows"; GOARCH = "386";   Sim = "Windows7";  Out = "IntraAdmin_agent_win7_x86.exe" },
    @{ Name = "win8_x64";  GOOS = "windows"; GOARCH = "amd64"; Sim = "Windows8";  Out = "IntraAdmin_agent_win8_x64.exe" },
    @{ Name = "win8_x86";  GOOS = "windows"; GOARCH = "386";   Sim = "Windows8";  Out = "IntraAdmin_agent_win8_x86.exe" },
    @{ Name = "win10_x64"; GOOS = "windows"; GOARCH = "amd64"; Sim = "Windows10"; Out = "IntraAdmin_agent_win10_x64.exe" },
    @{ Name = "win10_x86"; GOOS = "windows"; GOARCH = "386";   Sim = "Windows10"; Out = "IntraAdmin_agent_win10_x86.exe" },
    @{ Name = "win11_x64"; GOOS = "windows"; GOARCH = "amd64"; Sim = "Windows11"; Out = "IntraAdmin_agent_win11_x64.exe" },
    @{ Name = "win11_x86"; GOOS = "windows"; GOARCH = "386";   Sim = "Windows11"; Out = "IntraAdmin_agent_win11_x86.exe" }
)

foreach ($b in $builds) {
    Write-Host "Building $($b.Name)..." -ForegroundColor Yellow
    $env:GOOS = $b.GOOS
    $env:GOARCH = $b.GOARCH
    $env:CGO_ENABLED = "0"
    $outPath = Join-Path $outDir $b.Out
    $ldflags = "-s -w -H=windowsgui -X main.simulateOS=$($b.Sim) -X main.DefaultServer=$targetUrl"
    & go build -ldflags $ldflags -o $outPath .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed for $($b.Name)"
    }
    Write-Host "  -> $outPath" -ForegroundColor Green
}

Pop-Location

Write-Host ""
Write-Host "Build Complete! Agents in: $outDir" -ForegroundColor Cyan
Write-Host "  - x64: Windows 7/8/10/11 (64-bit)"
Write-Host "  - x86: Windows 7/8/10/11 (32-bit)"
Write-Host ""
Write-Host "Note: Windows 7 requires Go 1.20 or earlier for full compatibility." -ForegroundColor Gray
