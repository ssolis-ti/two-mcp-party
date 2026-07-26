---
id: PLAN-002
title: Plan de Implementación Meta-Features (V1.1 y V1.2)
status: Completed
created: 2026-07-24
updated: 2026-07-24
version: 1.0.0
---

# Plan de Implementación: Debugger & Sessions

## 1. Arquitectura de Cambios

### 1.1 Debugger Module
- **Servicio:** `DebuggerService` lee logs usando `fs.readFileSync` (optimizado para logs pequeños/medianos) y obtiene métricas vía `process.memoryUsage()`.
- **Seguridad:** Se verifica con `path.resolve` y `startsWith` que `bridge_debug_read_source` no haga path traversal.
- **Inyección:** `src/modules/debugger/index.js` evalúa `process.env.DEBUG_MODE === 'true'`.

### 1.2 Sessions Module
- **Base de Datos:** Nueva tabla `sessions`. Alteración de la tabla `agents` agregando `current_session_id`.
- **Messaging & Memory:** Cambio estructural. Ambos esquemas referenciarán `session_id` en lugar de target agent o namespaces sueltos. 

## 2. Componentes

### Archivos Afectados
- `package.json` -> Agregar script `npm run dev`
- `src/core/logger.js` -> Configurar Pino Multistream
- `src/modules/debugger/*` -> Módulo nuevo
- `src/modules/sessions/*` -> Módulo nuevo
- `src/modules/agents/agents.schema.sql` -> + current_session_id
- `src/modules/messaging/*` -> Refactor a session_id
- `src/modules/memory/*` -> Refactor a session_id

## 3. Estrategia de Migración de BD
Como esto es código temprano (V1.0.0 a V1.2.0) y SQLite en este proyecto inicial se puede recrear, se pueden modificar los `.schema.sql` directamente.
