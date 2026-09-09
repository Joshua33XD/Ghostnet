@echo off
cd /d "%~dp0"

if exist locust.host.txt (
  set /p HOST=<locust.host.txt
) else (
  set HOST=http://localhost:8000
)

if not "%~1"=="" set HOST=%~1

echo Starting Locust against %HOST%
echo After the page opens: set Users, Spawn rate, click Start.
echo Close this window to stop Locust.
echo.

python -m pip install locust -q
start "" http://localhost:8089
python -m locust -f locustfile.py --host %HOST%
