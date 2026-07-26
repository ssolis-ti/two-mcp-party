@echo off
echo ==============================================
echo Instalando PM2 globalmente...
echo ==============================================
call npm install -g pm2 pm2-windows-startup

echo.
echo ==============================================
echo Configurando el registro de inicio en Windows...
echo ==============================================
call pm2-startup install

echo.
echo ==============================================
echo Iniciando AgentBridge (Hub MCP)...
echo ==============================================
call pm2 start ecosystem.config.cjs

echo.
echo ==============================================
echo Guardando la configuracion para arranque automatico...
echo ==============================================
call pm2 save

echo.
echo ==============================================
echo ¡Listo! AgentBridge ahora se ejecutara en segundo plano
echo cada vez que inicies tu PC.
echo Para ver el log en vivo usa el comando: pm2 logs
echo ==============================================
pause
