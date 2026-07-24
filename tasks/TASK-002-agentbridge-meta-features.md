---
id: TASK-002
title: Tareas Meta-Features (V1.1 y V1.2)
status: Completed
created: 2026-07-24
updated: 2026-07-24
---

# Tasks: Debugger & Sessions

## Debugger Module (V1.1)
- [x] Actualizar logger para salida dual (pino multistream)
- [x] Crear schema `debugger.service.js` con métodos readSourceFile, getLogs, getSystemMetrics
- [x] Crear `debugger.tools.js`
- [x] Crear `index.js` condicional (evaluando `DEBUG_MODE`)
- [x] Actualizar package.json con script `dev`

## Sessions Module (V1.2)
- [x] Modificar tabla agents (+ current_session_id)
- [x] Crear `sessions.schema.sql`
- [x] Crear `sessions.service.js` y `sessions.tools.js`
- [x] Crear `index.js` del módulo
- [x] Refactorizar messaging module para obligar `session_id`
- [x] Refactorizar memory module para usar `session_id`
