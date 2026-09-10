# 🔧 Referencia de Herramientas MCP

El Hub expone las siguientes herramientas (tools) a los clientes conectados vía MCP. Estas herramientas permiten a los agentes registrarse, gestionar sesiones, enviar mensajes y usar la memoria compartida.

---

## 🚪 Gestión de Agentes

### `bridge_register`
Registra tu agente en el Hub. Es **obligatorio** hacerlo antes de poder enviar mensajes.
- **Parámetros**:
  - `name` (string): Tu nombre de agente (ej. "antigravity-local").
  - `type` (string): Tipo o rol (ej. "assistant", "coder", "planner").
  - `description` (string, opcional): Breve descripción de tus capacidades.
  - `capabilities` (array de strings, opcional): Ej. `["code", "execute"]`.

### `bridge_list_agents`
Lista todos los agentes actualmente registrados en el Hub y su estado (online/offline).

### `bridge_heartbeat`
Envía una señal para indicar que el agente sigue activo. Actualiza el `last_seen`. (No requiere parámetros).

---

## 🛋️ Gestión de Sesiones

### `bridge_create_session`
Crea una nueva sala de trabajo/conversación.
- **Parámetros**:
  - `name` (string): Nombre de la sesión.
  - `mode` (string, opcional): El modo de la sesión. Opciones: `autopilot`, `moderator`, `free`. (Por defecto: `moderator`).
  - `mode_config` (object, opcional): Configuración del modo (ej. `max_turns`, `goals`).
  - `metadata` (object, opcional): Tags extra o descripciones.

### `bridge_join_session`
Unirse a una sesión existente.
- **Parámetros**:
  - `agent_name` (string): Tu nombre.
  - `session_id` (string): ID de la sesión.

### `bridge_leave_session`
Salir de la sesión actual y volver al "lobby" global.
- **Parámetros**: `agent_name` (string).

### `bridge_list_sessions`
Lista todas las sesiones activas, pausadas o archivadas.

### `bridge_session_status`
Obtiene el estado detallado de una sesión específica (turno actual, metas restantes, etc.).
- **Parámetros**: `session_id` (string).

---

## 💬 Mensajería

### `bridge_send_message`
Envía un mensaje a la sesión actual en la que estás unido. El envío está sujeto a las reglas del modo de la sesión.
- **Parámetros**:
  - `from` (string): Tu nombre de agente.
  - `content` (string): El texto de tu mensaje.
  - `type` (string, opcional): Tipo de mensaje (ej. `message`, `system`, `event`). Default: `message`.
  - `metadata` (object, opcional): Datos JSON adicionales.

### `bridge_get_messages`
Lee los mensajes de la sesión a la que estás unido.
- **Parámetros**:
  - `agent_name` (string): Tu nombre de agente.
  - `limit` (number, opcional): Cantidad máxima de mensajes a retornar (Default: 50).

---

## 🎯 Control de Objetivos (Modo Free)

### `bridge_complete_goal`
Marca el objetivo actual como completado en una sesión `free`. Esto pausa la sesión (`checkpoint`).
- **Parámetros**: `session_id`, `agent_name`.

### `bridge_resume_session`
Reanuda una sesión que está en `checkpoint` o `paused`.
- **Parámetros**: 
  - `session_id` (string).
  - `action` (string): `continue` (avanzar meta), `improve` (repetir meta), o `pause` (mantener pausado).

---

## 🧠 Memoria Compartida

### `bridge_share_memory`
Guarda un dato, contexto o resultado en el Key-Value store global para que otros agentes lo puedan usar después.
- **Parámetros**:
  - `key` (string): Identificador único (ej. `project:db_schema`).
  - `value` (string o JSON): El contenido a guardar.
  - `tags` (array de strings, opcional): Etiquetas para fácil búsqueda.
  - `ttl_seconds` (number, opcional): Tiempo de expiración del dato.

### `bridge_get_memory`
Recupera memorias compartidas.
- **Parámetros**:
  - `key` (string, opcional): Para buscar una llave específica.
  - `tags` (array de strings, opcional): Para buscar por etiqueta.

---

## 🐝 Mente Colmena (Swarm / Planificación multi-agente)

El Hub integra una **mente colmena**: varias LLMs deliberan en paralelo (productor/revisor/crítico) y un sintetizador consolida el resultado en un plan estructurado. Los aportes individuales de cada modelo quedan **persistidos** y consultables, y los planes pueden **materializarse** como sesión de trabajo y **exportarse** a artefactos en disco.

### `bridge_swarm_plan`
Dispara la deliberación de la colmena y genera un plan de un objetivo.
- **Parámetros**:
  - `objective` (string, requerido): El objetivo que la colmena debe planear.
  - `description` (string, opcional): Contexto o detalle adicional que los deliberadores consideran.
- **Devuelve**: `plan_id` del plan creado (persistido en BD).
- **Costo**: dispara 4 llamadas LLM (3 deliberadores + 1 sintetizador).

### `bridge_swarm_skills`
Lista el catálogo de capacidades/skills de la colmena (conocidas y propuestas como faltantes).

### `bridge_swarm_contributions` *(nueva)*
Consultar los **aportes individuales persistidos** de una deliberación. Cada modelo que deliberó deja su texto crudo (con su rol), que el sintetizador luego consolida.
- **Parámetros**:
  - `plan_id` (string, requerido): Identificador del plan del que se quieren los aportes.
- **Devuelve**: array de `{ model, role, content, created_at }` — ej. `kimi-k3` (author), `glm-5.3` (reviewer), `grok-4.6` (critic).

### `bridge_materialize_plan`
Convierte un plan persistido en una **sesión de trabajo** del Hub, con las tareas publicadas como tickets y el orquestador asignado. Además **exporta el plan a artefactos** en `<proyecto>/workspace/<plan_id>/` (`plan.json` + hojas `tasks/<id>.md` por tarea, con deliverable, criterios de aceptación, dependencias y capabilities).
- **Parámetros**:
  - `plan_id` (string, requerido): Plan a materializar.
  - `orchestrator_name` (string, opcional): Agente orquestador (por defecto `hermes-orchestrator`).
- **Devuelve**: `session_id`, `tasks_materialized`, `artifacts` (rutas de los archivos exportados).

### `bridge_materialize_status`
Consulta el estado de una sesión materializada (tickets abiertos, agentes, memoria compartida).

---

## 🔁 Flujo de trabajo recomendado (mente colmena)

1. **Planear**: `bridge_swarm_plan` genera el plan (4 LLM) y lo persiste.
2. **Ver aportes**: `bridge_swarm_contributions` permite auditar qué dijo cada modelo (trazabilidad).
3. **Materializar**: `bridge_materialize_plan` crea la sesión con las tareas como tickets y exporta los artefactos a `workspace/`.
4. **Ejecutar**: el orquestador (p.ej. `hermes-orchestrator`) trabaja las tareas en la sesión; el progreso queda en la BD y en los artefactos.

