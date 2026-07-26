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
