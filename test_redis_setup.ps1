#!/usr/bin/env powershell
<#
Redis Parallel Processing Test
Coordinates all services for comparison test
#>

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Redis Parallel Processing Test" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Activate venv
Write-Host "[1/4] Activating virtual environment..." -ForegroundColor Yellow
. .venv/Scripts/Activate.ps1

# Check Redis
Write-Host "[2/4] Checking Redis connection..." -ForegroundColor Yellow
$redis_check = python -c "import redis; r = redis.Redis(); r.ping(); print('OK')" 2>$null
if ($redis_check -contains "OK") {
    Write-Host "  ✓ Redis is running and accessible" -ForegroundColor Green
}
else {
    Write-Host "  ✗ Redis not running. Start it with: redis-server" -ForegroundColor Red
    exit 1
}

# Start API Server
Write-Host "[3/4] Starting API server on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ". .venv\Scripts\Activate.ps1; python api_server.py" -PassThru | Out-Null
Start-Sleep -Seconds 3

# Check API
$api_check = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -ErrorAction SilentlyContinue
if ($api_check.status -eq "healthy") {
    Write-Host "  ✓ API server is running" -ForegroundColor Green
    Write-Host "  ✓ Redis mode: $($api_check.redis)" -ForegroundColor Green
}
else {
    Write-Host "  ✗ API server failed to start" -ForegroundColor Red
    exit 1
}

# Start Workers
Write-Host "[4/4] Starting 5 Redis workers..." -ForegroundColor Yellow
for ($i = 1; $i -le 5; $i++) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", ". .venv\Scripts\Activate.ps1; python redis_worker.py worker-$i" -PassThru | Out-Null
    Write-Host "  ✓ Started worker-$i" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "All services started successfully!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test domains ready:" -ForegroundColor Cyan
Write-Host "  1. firesand.co.uk" -ForegroundColor Gray
Write-Host "  2. s8080.com" -ForegroundColor Gray
Write-Host "  3. emagine.org" -ForegroundColor Gray
Write-Host "  4. bespokesupportsolutions.co.uk" -ForegroundColor Gray
Write-Host "  5. bcs365.co.uk" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: Run the test submission script" -ForegroundColor Yellow
Write-Host ""
