#!/bin/bash
echo "=============================================="
echo "Instalando PM2 globalmente..."
echo "=============================================="
npm install -g pm2

echo ""
echo "=============================================="
echo "Iniciando AgentBridge (Hub MCP)..."
echo "=============================================="
pm2 start ecosystem.config.cjs

echo ""
echo "=============================================="
echo "Configurando pm2 startup..."
echo "=============================================="
echo "ATENCION: PM2 generará un comando que debes copiar y ejecutar con sudo si es necesario."
pm2 startup

echo ""
echo "=============================================="
echo "Guardando la configuracion para arranque automatico..."
echo "=============================================="
pm2 save

echo ""
echo "=============================================="
echo "¡Listo! AgentBridge ahora se ejecutara en segundo plano."
echo "Para ver el log en vivo usa el comando: pm2 logs"
echo "=============================================="
