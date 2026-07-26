# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

## [2.6.0] - 2026-07-26
### Agregado
- 🚀 **AgentBridge Hub V2.6.0**: Arquitectura Híbrida implementada.
- 🚀 **Handshake V2 (FEAT-010)**: El Hub ahora inyecta un mensaje automático `SYSTEM` en la sesión cuando un agente se une y hay 2+ participantes, revelando los presentes y turnos sin gastar tokens.
- 🚀 **Anti-Looping Inteligente (FEAT-010)**: Nuevo `loop.service.js` con un `Map` en RAM para monitorear las últimas 20 tool calls por agente. Detecta llamadas idénticas o repeticiones ciegas e inyecta alertas de `SYSTEM` cortando el bucle.
- 🛡️ **Loop Auditing**: Loops severos son logueados en frío en la nueva tabla `loop_events` de SQLite sin penalizar el I/O normal.

## [2.5.0] - 2026-07-25
### Agregado
- 🚀 **Loop Engineering (FEAT-009)**: Introducidas primitivas avanzadas para orquestación de bucles multi-agente.
- 🚀 **Anti-Looping Server-Side**: Detección de no-progreso. El servidor monitorea si un agente envía exactamente el mismo mensaje 3 veces seguidas e inyecta una advertencia de SYSTEM para romper bucles ciegos.
- 🚀 **Task Discovery**: Nuevo módulo `tasks` con tabla en SQLite para publicar y reclamar tareas asíncronamente en una sesión compartida.
- 🚀 **Nuevos Tools MCP**: `bridge_publish_task`, `bridge_list_tasks`, `bridge_claim_task`.

## [2.4.0] - 2026-07-25
### Agregado
- 🚀 **Sync Protocol V2 (FEAT-007)**: Incorporada arquitectura avanzada de sincronización.
- 🚀 **Targeted Push (SSE Filter)**: El Hub ahora requiere `?agent=` en la conexión `/api/events` para filtrar y hacer broadcast selectivo solo a los participantes de la sesión (evita ecos y desincronizaciones masivas).
- 🚀 **DPD Proactivo en Background**: El servidor ahora ejecuta un cron cada 30 segundos barriendo la tabla de sesiones. Libera automáticamente los candados de turnos si el agente poseedor se encuentra `offline`.
- 🚀 **Universal Cooldown**: El chequeo anti-spam mínimo (3 segundos) se movió al core de `sendMessage` para proteger la red en TODOS los modos (free, moderator, autopilot).
- 🚀 **Cron Status Architecture**: Confirmada la sinergia de `sync:status` en `bridge_share_memory` como mecanismo de Heartbeat compatible con el nuevo DPD.

## [2.3.0] - 2026-07-25
### Agregado
- 🚀 **MCP Resources (FEAT-006)**: La carpeta `docs/` ahora está expuesta a través de los handlers nativos de MCP (`ListResourcesRequestSchema` y `ReadResourceRequestSchema`), haciendo que la arquitectura del sistema sea 100% autodescubrible para cualquier agente cliente.

## [2.2.0] - 2026-07-25
### Agregado
- 🚀 **Shared Workspaces (FEAT-005)**: Nuevo módulo para compartir archivos. El Hub autogenera carpetas `workspaces/<session_id>` por sesión.
- 🚀 Nuevos tools MCP para I/O remota segura: `bridge_workspace_write`, `bridge_workspace_read`, `bridge_workspace_list`.
- 🛡️ **Seguridad Anti-Path-Traversal**: Las lecturas y escrituras están estrictamente aisladas al sandbox de la sesión.

## [2.1.0] - 2026-07-25
### Agregado
- 🚀 **Telecom Sync (FEAT-004)**: Integrado endpoint `GET /api/events` (Server-Sent Events) para recibir notificaciones Push en tiempo real de nuevos mensajes sin necesidad de polling.
- 🚀 **Dead Peer Detection**: Reducido heartbeat a 1 minuto; el Hub auto-libera candados de turnos de agentes desconectados.
- 🚀 **Quality of Service (QoS)**: Se añade prioridad de mensaje (`normal`, `high`, `critical`). Mensajes `critical` saltan reglas de turnos y cooldowns.
- 🚀 **Vector Clocks**: Los mensajes ahora incluyen `seq` asegurando orden secuencial inmutable.

## [2.0.0] - 2026-07-25
### Agregado
- 🚀 **Autopilot & Token Ring (FEAT-001 & FEAT-002)**: Introducidos los modos de sesión (`free`, `moderator`, `autopilot`).
- 🚀 Turnos estrictos mediante parámetro `yield_to` para orquestar diálogos sin colisiones.
- 🚀 Nuevo tool MCP: `bridge_yield_turn`.
### Cambiado
- 🔧 **Breaking**: `bridge_get_messages` retorna un nuevo schema con paginación optimizada.
- 🔧 **QA Audit Fixes**: Reparado el payload en `sessions.service.js` y `agents.service.js` que impedía unirse a sesiones vacías.

## [1.2.0] - 2026-07-24
### Agregado
- 🚀 Módulo `sessions`: Gestión de estado centralizado para salas virtuales.
- 🚀 Tools MCP: `bridge_create_session`, `bridge_join_session`, `bridge_leave_session`.
### Cambiado
- 🔧 **Breaking:** Módulo `messaging` ahora requiere unirse a una sesión. `to_agent` ha sido reemplazado por `session_id`.
- 🔧 **Breaking:** Módulo `memory` ahora asocia los registros al `session_id` activo del agente en lugar de un `namespace` global.
- 🔧 Los timestamps de los mensajes y la memoria ahora son generados unificadamente por el Hub.

## [1.1.0] - 2026-07-24
### Agregado
- 🐛 Módulo `debugger`: Meta-features para autodiagnóstico de agentes (ReadOnly).
- 🐛 Tools MCP: `bridge_debug_logs`, `bridge_debug_metrics`, `bridge_debug_read_source`.
- 🐛 Script `npm run dev` para levantar el hub con `DEBUG_MODE=true`.

## [1.0.0] - 2026-07-24
### Agregado
- 🎉 Primera versión funcional de AgentBridge (V1).
- 🚀 Transporte SSE (Server-Sent Events) sobre Express (puerto 3579) para conexiones LAN de baja latencia.
- 🚀 Base de datos core SQLite en modo WAL para concurrencia alta.
- 🚀 Módulo `agents`: Registro (`bridge_register`), latencia (`bridge_heartbeat`) y discovery (`bridge_list_agents`).
- 🚀 Módulo `messaging`: Buzón de entrada de mensajes entre agentes.
- 🚀 Módulo `memory`: Espacio global clave-valor para contexto persistente.

## [0.1.0] - 2026-07-24
### Agregado
- 🏗️ Estructura inicial del proyecto basada en Spec Kit (SDD)
- 📁 Carpetas: `docs/`, `specs/`, `plans/`, `tasks/`, `src/`, `tests/`
- 📝 Documentación completa en `docs/`
- ⚙️ Configuración: `.editorconfig`, `.gitignore`, `.specify/config.yml`
- 🤖 Instrucciones de agente AI en `.agents/AGENTS.md`
- 📄 README.md y LICENSE (MIT)
