# Startup script for Company Intelligence Agent UI
# Runs both FastAPI backend and Next.js frontend

Write-Host "🤖 Starting Company Intelligence Agent..." -ForegroundColor Cyan

# Start FastAPI server in background
Write-Host "`n[1/2] Starting FastAPI backend on http://localhost:8000..." -ForegroundColor Yellow
$apiProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Infynd Hackathon\agent'; & .\lang\Scripts\Activate.ps1; python api_server.py" -PassThru -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Next.js dev server
Write-Host "`n[2/2] Starting Next.js frontend on http://localhost:3000..." -ForegroundColor Yellow
Push-Location "D:\Infynd Hackathon\agent\ui"
npm run dev
Pop-Location
