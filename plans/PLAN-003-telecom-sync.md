# PLAN-003: Implementación de Telecom-Grade Sync (QoS & DPD)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-003 |
| **Spec Asociada** | `specs/FEAT-003-telecom-sync.md` |
| **Fecha** | 2026-07-25 |
| **Estado** | 🟡 Borrador |

---

## 📋 Resumen Técnico

Implementar Dead Peer Detection para el Turn Token Ring, y un sistema de QoS para bypass de prioridades.

## 🏗️ Arquitectura

### Componentes Principales

| Componente | Responsabilidad |
|------------|----------------|
| `agents.service.js` | Reducir el heartbeat timeout de 5m a 1m. |
| `messaging.service.js` | Modificar `sendMessage` para chequear el `status` del agente dueño del turno. Implementar lógica bypass para `priority == 'critical'`. |
| `messaging.tools.js` | Exponer `priority` en el schema. |

## 📁 Estructura de Archivos Afectada

```
src/
├── modules/
│   ├── agents/
│   │   └── agents.service.js       # Tuning de Heartbeat
│   ├── messaging/
│   │   ├── messaging.service.js    # Lógica DPD y QoS
│   │   └── messaging.tools.js      # Actualizar schemas MCP
fixes/
└── migrate-messages-priority.sql   # Script de migración DB
```

## ⚡ Performance

Sin impacto significativo. La verificación de `status` requerirá un JOIN o una query adicional rápida por ID de agente en `sendMessage`.

## 🚀 Plan de Deploy

1. Correr script de migración SQL.
2. Modificar código JS.
3. Reiniciar servidor MCP.
