# Parallel Monitor Update (commit acb1786)

## Summary
- Improved worker tracking, logs visibility, and UI layout for parallel jobs.
- HTTP polling replaces WebSocket in ParallelJobMonitor for stability.
- Single Activity Logs panel moved above worker progress; per-worker progress bars retained.
- Backend status endpoint now returns `progress_percentage`, `workers`, and merged logs.

## Files Touched
- api_server.py
- redis_manager.py
- redis_worker.py
- ui/components/ParallelJobMonitor.tsx
- ui/components/ProcessingStatus.tsx

## How to Run
1. Start all services: `./start_all.ps1`
2. Open UI: http://localhost:3000
3. Submit batch in parallel mode to see overall progress, logs, and per-worker status.

## Notes
- Commit: acb1786 on branch `redis`.
- Performance analytics still pending (per commit message).
