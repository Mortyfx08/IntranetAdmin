# NetSentry Connectivity Test Script

$BackendUrl = "http://localhost:8000/api/health"

Write-Host "--- NetSentry Connectivity Test ---" -ForegroundColor Cyan

try {
    Write-Host "Testing connection to $BackendUrl..."
    $response = Invoke-RestMethod -Uri $BackendUrl -Method Get -TimeoutSec 5
    
    if ($response.status -eq "ok") {
        Write-Host "[SUCCESS] Backend is reachable and responding correctly!" -ForegroundColor Green
        Write-Host "Backend Timestamp: $($response.timestamp)"
    } else {
        Write-Host "[WARNING] Backend reached but returned unexpected status: $($response.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] Could not reach backend server." -ForegroundColor Red
    Write-Host "Error Details: $($_.Exception.Message)"
    
    Write-Host "`nTroubleshooting Tips:" -ForegroundColor Cyan
    Write-Host "1. Ensure the backend is running (python -m uvicorn backend.main:app)"
    Write-Host "2. Check if port 8000 is blocked by a firewall."
    Write-Host "3. Verify if another application is using port 8000."
}

Write-Host "`n--- Test Finished ---"
