# Start multiple Redis workers for parallel domain processing
# Usage: .\start_workers.ps1 [number_of_workers]

param(
    [int]$WorkerCount = 5
)

Write-Host "Starting $WorkerCount Redis workers..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all workers" -ForegroundColor Yellow
Write-Host ""

# Array to store job objects
$jobs = @()

# Start workers
for ($i = 1; $i -le $WorkerCount; $i++) {
    $workerId = "worker-$i"
    Write-Host "[$i/$WorkerCount] Starting $workerId..." -ForegroundColor Cyan
    
    # Start each worker as a background job
    $job = Start-Job -ScriptBlock {
        param($id, $scriptPath)
        Set-Location (Split-Path $scriptPath)
        & python redis_worker.py $id
    } -ArgumentList $workerId, $PSScriptRoot
    
    $jobs += $job
    Start-Sleep -Milliseconds 200  # Small delay between worker starts
}

Write-Host ""
Write-Host "✓ All $WorkerCount workers started!" -ForegroundColor Green
Write-Host "  Job IDs: $($jobs.Id -join ', ')" -ForegroundColor Gray
Write-Host ""
Write-Host "Monitoring worker output (Ctrl+C to stop)..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Gray
Write-Host ""

try {
    # Monitor jobs and show output
    while ($true) {
        foreach ($job in $jobs) {
            $output = Receive-Job -Job $job
            if ($output) {
                Write-Host $output
            }
        }
        
        # Check if all jobs are completed
        $runningJobs = $jobs | Where-Object { $_.State -eq 'Running' }
        if ($runningJobs.Count -eq 0) {
            Write-Host ""
            Write-Host "All workers have stopped." -ForegroundColor Yellow
            break
        }
        
        Start-Sleep -Milliseconds 500
    }
}
finally {
    # Cleanup: Stop all jobs
    Write-Host ""
    Write-Host "Stopping all workers..." -ForegroundColor Yellow
    $jobs | Stop-Job
    $jobs | Remove-Job -Force
    Write-Host "✓ All workers stopped." -ForegroundColor Green
}
