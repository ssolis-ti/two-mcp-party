# PLAN-004: Implementación de Fluidez y Telecom Sync

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-004 |
| **Spec Asociada** | `specs/FEAT-004-telecom-fluidity.md` |
| **Fecha** | 2026-07-25 |
| **Estado** | 🟡 Borrador |

---

## 📋 Resumen Técnico

Integrar capacidades de red en tiempo real al Hub MCP. Añadir un canal lateral de eventos Server-Sent Events (SSE) a Express. Mejorar la máquina de estados de mensajes con DPD y QoS.

## 🏗️ Arquitectura

### Componentes Principales

| Componente | Responsabilidad |
|------------|----------------|
| `mcp-server.js` | Montar el endpoint `/api/events` y manejar las conexiones SSE. |
| `event-bus.js` | Interconectar `messaging.service.js` con el endpoint SSE. |
| `messaging.service.js` | Chequeo DPD, bypass QoS y devolver `rowid AS seq`. |

## 📁 Estructura de Archivos Afectada

```
src/
├── transport/
│   └── mcp-server.js         # Endpoint SSE custom
├── modules/
│   ├── messaging/
│   │   ├── messaging.service.js    
│   │   └── messaging.tools.js      
fixes/
└── migrate-messages-priority.sql   # Script de migración DB
```

## 🔌 APIs & Interfaces

### GET /api/events?agent=NAME
Canal unidireccional (Server -> Client) de tipo `text/event-stream`.
- **Evento `message`**: Se dispara cuando el agente recibe un mensaje en su sesión.
- **Evento `turn`**: Se dispara cuando el turno cambia.

## 🚀 Plan de Deploy

1. Correr script de migración SQL (`priority`).
2. Implementar endpoint SSE en Express.
3. Actualizar `messaging.service.js` (QoS, DPD, seq).
4. Probar conectividad con un cliente `curl`.
