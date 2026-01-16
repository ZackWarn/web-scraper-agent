#!/usr/bin/env powershell
<#
Submit test job and monitor progress
#>

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Submitting 5 Domains for Parallel Processing" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

. .venv/Scripts/Activate.ps1

# Test domains (same as baseline)
$domains = @(
    "firesand.co.uk",
    "s8080.com", 
    "emagine.org",
    "bespokesupportsolutions.co.uk",
    "bcs365.co.uk"
)

Write-Host "Submitting job with $($ domains.Count) domains..." -ForegroundColor Yellow
$body = @{ domains = $domains } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/process_redis" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop

$jobId = $response.job_id
Write-Host ""
Write-Host "Job created successfully!" -ForegroundColor Green
Write-Host "  Job ID: $jobId" -ForegroundColor Cyan
Write-Host "  Mode: $($response.mode)" -ForegroundColor Cyan
Write-Host "  Domains: $($response.count)" -ForegroundColor Cyan
Write-Host ""

# Monitor progress
Write-Host "Monitoring progress (Ctrl+C to stop)..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$lastStatus = ""

while ($true) {
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/status/$jobId"
    
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $progress = "$($status.completed)/$($status.total) completed, $($status.failed) failed"
    
    if ($progress -ne $lastStatus) {
        Write-Host "[$([int]$elapsed)s] $progress" -ForegroundColor Cyan
        $lastStatus = $progress
    }
    
    if ($status.status -eq "completed") {
        break
    }
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Test Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Total time: $([int]((Get-Date) - $startTime).TotalSeconds) seconds" -ForegroundColor Green
Write-Host "  Completed: $($status.completed)/$($status.total)" -ForegroundColor Green
Write-Host "  Failed: $($status.failed)" -ForegroundColor Yellow
Write-Host "  Success rate: $(([math]::Round($status.completed / $status.total * 100, 1)))%" -ForegroundColor Green
Write-Host ""
Write-Host "Job details available at: http://localhost:8000/api/status/$jobId" -ForegroundColor Gray
Write-Host ""
