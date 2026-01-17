# Start all services: Redis, Backend, and 3 Workers

Write-Host "Starting all services..." -ForegroundColor Green

# Start Redis
Start-Process -NoNewWindow -FilePath ".\hoco\ChocolateyScratch\redis\8.4.0\tools\redis-server.exe" -ArgumentList "--port 6379"
Start-Sleep -Seconds 2

# Start backend
$backendCmd = ". .venv\Scripts\Activate.ps1; python -m uvicorn api_server:app --host 0.0.0.0 --port 8000 --reload"
Start-Process -NoNewWindow -FilePath "powershell" -ArgumentList "-Command", $backendCmd
Start-Sleep -Seconds 3

# Start 3 workers
for ($i = 1; $i -le 3; $i++) {
    $workerCmd = ". .venv\Scripts\Activate.ps1; python redis_worker.py worker-$i"
    Start-Process -NoNewWindow -FilePath "powershell" -ArgumentList "-Command", $workerCmd
    Start-Sleep -Seconds 1
}

Write-Host "All services started - visit http://localhost:3000" -ForegroundColor Green