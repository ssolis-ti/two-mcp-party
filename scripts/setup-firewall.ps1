# Requiere permisos de Administrador
$Port = 3579
$RuleName = "Two MCP Party Server (Port $Port)"

# Verificar si estamos corriendo como Administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Por favor, ejecuta este script como Administrador para configurar el Firewall."
    Break
}

# Verificar si la regla ya existe
$existingRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "La regla '$RuleName' ya existe en el Firewall." -ForegroundColor Green
} else {
    Write-Host "Creando regla en el Firewall para el puerto $Port..." -ForegroundColor Cyan
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile Any
    Write-Host "Regla creada exitosamente. Los agentes ahora pueden conectarse desde otras PCs de la red." -ForegroundColor Green
}
