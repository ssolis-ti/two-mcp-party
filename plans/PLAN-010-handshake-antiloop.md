# PLAN-010: Handshake V2 y Anti-Looping Inteligente

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-010 |
| **Spec Asociada** | `specs/FEAT-010-handshake-antiloop.md` |
| **Autor** | Antigravity / Hermes |
| **Fecha** | 2026-07-26 |
| **Estado** | 🟢 Aprobado |

---

## 📋 Resumen Técnico

Implementar una arquitectura híbrida (RAM/SQLite) para el Anti-Looping, rastreando las últimas 20 tool calls por agente. También se implementa el Handshake V2, emitiendo un mensaje automático de bienvenida tipo "system" a la sesión cuando un segundo agente se une.

## 🏗️ Arquitectura

### Componentes Principales

| Componente | Responsabilidad | Tecnología |
|------------|----------------|------------|
| `loop.service.js` | Detección heurística de loops y manejo del Map. | Node.js (RAM) |
| `sessions.schema.sql` | Almacenamiento frío de eventos loop. | SQLite |
| `sessions.service.js` | Emisión automática del evento Handshake. | Node.js |

## 📁 Estructura de Archivos Propuesta

```
src/
├── modules/
│   ├── messaging/
│   │   ├── loop.service.js       # [NUEVO] Servicio anti-looping híbrido
│   │   └── messaging.service.js  # Refactorizado para usar loop.service.js
│   └── sessions/
│       ├── sessions.service.js   # Refactorizado para inyectar Handshake
│       └── sessions.schema.sql   # [MODIFICADO] Agregar loop_events table
```

## 🔄 Flujo de Datos

1. Agente B se une a la sesión mediante `bridge_join_session`.
2. `sessions.service.js` detecta >=2 participantes e inyecta un mensaje SYSTEM a la tabla `messages` (sin gastar turno).
3. Agente intenta ejecutar una tool (o envía mensaje).
4. `loop.service.js` guarda la firma de la tool en su Map en RAM.
5. Si hay 5 repetidas o idénticas constantes, rechaza el intento y guarda registro en `loop_events` (SQLite).

## 🧪 Estrategia de Testing

| Tipo | Herramienta | Cobertura Objetivo |
|------|-------------|--------------------|
| Integración | `bridge_send_message` | Comprobar que el 4to/5to loop falle |
| Manual | Local Server | 100% (Ver Handshake en SSE stream) |

---

> **Recordatorio**: Este plan debe ser aprobado antes de crear las tareas de implementación.
