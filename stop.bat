@echo off
echo Stopping Cyber-Rans...
docker compose down 2>nul || docker-compose down
echo Done.
pause
