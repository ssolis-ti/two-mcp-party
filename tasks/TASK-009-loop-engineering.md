# TASK-009: Implementación Loop Engineering

## Anti-Looping
- `[x]` Modificar `src/modules/messaging/messaging.service.js`.
  - `[x]` En `sendMessage`, hacer fetch de los últimos 3 mensajes del agente (`LIMIT 3`).
  - `[x]` Validar contenido repetido.
  - `[x]` Si hay loop, inyectar mensaje de sistema.

## Task Discovery
- `[x]` Crear script de migración SQL para la tabla `tasks`.
- `[x]` Crear módulo `src/modules/tasks/tasks.service.js`.
  - `[x]` Función `publishTask`
  - `[x]` Función `listTasks`
  - `[x]` Función `claimTask`
- `[x]` Exponer endpoints MCP en `src/modules/tasks/tasks.tools.js`.
- `[x]` Registrar módulo en `index.js` (auto-load).

## General
- `[ ]` Reiniciar Servidor y verificar logs de arranque.
