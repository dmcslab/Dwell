@echo off
echo Stopping Dwell...
docker compose down 2>nul || docker-compose down
echo Done.
pause
