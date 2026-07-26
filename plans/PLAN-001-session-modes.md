# PLAN-001: Session Modes Implementation

> Plan técnico para FEAT-001. Véase la spec en `specs/FEAT-001-session-modes.md`

## Resumen

Implementar 3 modos de conversación autónoma en las sesiones del Hub:

| Modo | Descripción | Restricciones |
|------|-------------|---------------|
| `autopilot` | Agentes conversan con límite de turnos y cooldown | `max_turns` + `cooldown_seconds` server-side |
| `moderator` | El humano participa como agente | Sin límites (default) |
| `free` | Agentes conversan hacia goals con checkpoints | `goals[]` + checkpoint al completar cada goal |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/modules/sessions/sessions.schema.sql` | +3 columnas: `mode`, `mode_config`, `turn_count` |
| `src/modules/sessions/sessions.service.js` | +4 métodos: `getSessionStatus`, `completeGoal`, `resumeSession`, `createSession` actualizado |
| `src/modules/sessions/sessions.tools.js` | +3 tools MCP: `bridge_session_status`, `bridge_complete_goal`, `bridge_resume_session` |
| `src/modules/messaging/messaging.service.js` | Enforcement en `sendMessage()`: status, turn limit, cooldown |
| `fixes/migrate-session-modes.sql` | Nuevo: migración SQL para DBs existentes |

## Nuevos Tools MCP

| Tool | Parámetros | Modo |
|------|------------|------|
| `bridge_session_status` | `session_id` | Todos |
| `bridge_complete_goal` | `session_id`, `agent_name` | Solo `free` |
| `bridge_resume_session` | `session_id`, `action` (continue/improve/pause) | Todos (para humano) |

## Enforcement Server-Side en `sendMessage()`

1. Verificar `session.status` — rechazar si `paused`, `checkpoint`, o `completed`
2. Si modo `autopilot` y `turn_count >= max_turns` → auto-pausar y rechazar
3. Si modo `autopilot` → verificar cooldown por agente
4. Incrementar `turn_count` en cada mensaje exitoso

## Ejecución

Seguir la task list en orden: Schema → Service → Tools → Enforcement → Reinicio → Tests → Commit
