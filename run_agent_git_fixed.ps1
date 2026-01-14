$scriptPath = $PSScriptRoot
Write-Host "Root path: $scriptPath"

# Start Backend in a new window
Write-Host "Starting Backend..."
$backendCmd = "cd '$scriptPath'; ..\agent\lang\Scripts\Activate.ps1; python api_server.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Start Frontend in the current window
Write-Host "Starting Frontend..."
Set-Location "$scriptPath\ui"
npm run dev
