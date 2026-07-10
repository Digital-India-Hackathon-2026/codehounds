@echo off
echo ==========================================================
echo Starting SentinelX Full-Stack Application...
echo ==========================================================

start cmd /k "echo Starting backend... && cd /d %~dp0backend && venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
start cmd /k "echo Starting frontend... && cd /d %~dp0frontend && npm run dev"

echo Both servers are starting in separate windows.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
