# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

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
