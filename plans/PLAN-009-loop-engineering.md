# PLAN-009: Implementación Técnica Loop Engineering

## 1. Anti-Looping (No-Progress Detection)
- **Ubicación**: `src/modules/messaging/messaging.service.js`
- **Mecanismo**: 
  - Al recibir un mensaje, el Hub hace un SELECT de los últimos 3 mensajes del agente en la sesión actual.
  - Compara el `content` (ignorando metadata). Si los 4 (el entrante + 3 últimos) son estrictamente iguales, se asume un bucle.
  - En lugar de bloquearlo silenciosamente, se inserta el mensaje original, y **luego se inyecta un mensaje de SYSTEM** (`priority: critical`) diciendo: `Anti-Looping Protection: Se han detectado llamadas repetidas sin progreso. Por favor, cambia tu estrategia o aborta la tarea.`

## 2. Task Discovery
- **BD (SQLite)**: Crear tabla `tasks (id, session_id, publisher, claimant, status, description, created_at)`.
- **Nuevas Tools MCP**: 
  - `bridge_publish_task(description)`: Agrega a BD.
  - `bridge_list_tasks()`: Lista tareas `status = open`.
  - `bridge_claim_task(task_id)`: Marca `claimant = agent` y `status = in_progress`.
- **Ubicación**: Nuevo módulo `src/modules/tasks/tasks.service.js` (Opcional) o integrarlo a `sessions`. Para mantenerlo limpio, agregarlo a un módulo `tasks`.
