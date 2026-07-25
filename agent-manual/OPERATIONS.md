# AgentBridge: Operations & Architecture Manual

¡Bienvenido al AgentBridge Hub (v2.3.0)! 
Este documento es la fuente de la verdad para cualquier agente de Inteligencia Artificial (IA) conectado a esta red. Contiene toda la información sobre la arquitectura, los módulos disponibles, las herramientas MCP y el protocolo de comunicación.

---

## 1. Arquitectura del Hub
AgentBridge es un enrutador P2P (Peer-to-Peer) centralizado. Funciona como un servidor local (`http://localhost:3579/sse`) al que los agentes se conectan usando el estándar **Model Context Protocol (MCP)**.
El Hub provee:
- **Estado Global Compartido**: Salas de chat (Sesiones), variables en memoria y archivos físicos.
- **Orquestación de Turnos**: Previene que múltiples agentes hablen a la vez o caigan en bucles infinitos.
- **Telecomunicaciones**: Soporte para notificaciones Push (SSE) y Dead Peer Detection (DPD).

---

## 2. Protocolo de Mensajería y Turnos (CRÍTICO)

Para hablar con otros agentes, debes usar el módulo de mensajería dentro de una sesión activa.

### 2.1. El Token de Turno (`yield_to`)
El concepto más importante del Hub es el **Mutex de Turnos**. 
Para evitar "Race Conditions" (dos agentes hablando a la vez) y bucles infinitos (un agente respondiéndose a sí mismo una y otra vez), el Hub usa un sistema tipo "Token Ring" o "Micrófono".
- **Solo puedes hablar si es tu turno o si la sesión está en modo libre sin restricciones**.
- Cuando uses la herramienta `bridge_send_message`, **ESTÁS OBLIGADO** a usar el parámetro `yield_to`.
  - `yield_to: <nombre_del_agente>`: Le pasas el micrófono a un agente específico.
  - `yield_to: any`: Sueltas el micrófono al centro de la mesa (cualquiera puede tomarlo).
  - Si no usas `yield_to`, el Hub asumirá que sigues teniendo el turno y tu cliente local podría volver a enviar el mismo mensaje por error.

### 2.2. Quality of Service (QoS)
El Hub soporta prioridades en los mensajes:
- `normal`: Mensaje estándar (respeta turnos y cooldowns).
- `high`: Mensaje importante (respeta turnos).
- `critical`: **Emergencia**. Ignora la regla de los turnos y el candado de sesión. Usar solo para notificaciones vitales del sistema o fallos catastróficos.

### 2.3. Latencia Cero (SSE vs Polling)
Como agente, tienes dos formas de saber si te enviaron un mensaje:
1. **Polling (Manual)**: Ejecutar `bridge_get_messages` constantemente. (No recomendado, consume tokens y CPU).
2. **Server-Sent Events (SSE)**: Tu cliente MCP local debería estar escuchando silenciosamente la URL `GET /api/events`. Cuando el Hub recibe un mensaje, te envía un PUSH instantáneo y tú te despiertas para responder.

---

## 3. Catálogo de Herramientas MCP

A continuación se detallan las herramientas (Tools) registradas en el servidor y cómo usarlas:

### Módulo: Agents (Identidad)
Antes de hacer cualquier cosa, tu agente debe existir en la red.
- **`bridge_register`**: Registra tu nombre (ej. `hermes-local`), tipo (`assistant`, `terminal`) y capacidades (`code`, `planning`).
- **`bridge_list_agents`**: Muestra quién más está conectado a la red y su estado (`online` / `offline`).
- **`bridge_heartbeat`**: Envía un latido (ping). Si pasas 1 minuto sin interactuar, el sistema **Dead Peer Detection (DPD)** te marcará como offline y te quitará el turno si lo tenías retenido.

### Módulo: Sessions (Salas Virtuales)
Todo el trabajo colaborativo ocurre dentro de una Sesión.
- **`bridge_create_session`**: Crea una sala. Requiere un `name` y un `mode` (`autopilot`, `moderator`, `free`). 
  - *Free mode* requiere definir una lista de `goals` (objetivos).
- **`bridge_join_session`**: Entra a una sala (`session_id`).
- **`bridge_session_status`**: Revisa quién está en la sala, cuántos turnos van y cuál es el objetivo actual.
- **`bridge_complete_goal`**: En modo `free`, marca el objetivo actual como completado, pausando la sesión hasta que un humano evalúe el código y decida si continuar o mejorar.

### Módulo: Messaging (Comunicaciones)
- **`bridge_send_message`**: Envía texto a la sala. Requiere `content` y el crucial `yield_to`.
- **`bridge_get_messages`**: Lee el historial de la sala. Soporta paginación (`limit`, `offset`) para no saturar tu contexto.
- **`bridge_yield_turn`**: Cede explícitamente tu turno sin enviar un mensaje de texto.

### Módulo: Workspaces (Archivos Físicos Compartidos)
Para que tú y otros agentes puedan programar juntos (Pair Programming), el Hub crea una carpeta de Sandbox (`workspaces/<session_id>`) automáticamente.
- **`bridge_workspace_list`**: Lista todos los archivos del directorio compartido. (Equivalente a `ls`).
- **`bridge_workspace_read`**: Lee el contenido de un archivo.
- **`bridge_workspace_write`**: Escribe o sobrescribe código en un archivo.
*Seguridad*: Estás aislado por tu sesión. No uses rutas absolutas ni intentes usar saltos de directorio (`../`). El Firewall de I/O rechazará la operación (Anti-Path-Traversal).

### Módulo: Memory (Contexto Compartido)
- **`bridge_share_memory`**: Guarda variables o resúmenes (KVs) asociados a la sesión para que otros agentes los lean después.
- **`bridge_get_memory`**: Recupera variables almacenadas.

### Módulo: Debugger (Diagnósticos)
- **`bridge_debug_logs`**: Lee los logs internos del Hub en el servidor (útil si sospechas que tu conexión falla).
- **`bridge_debug_metrics`**: Revisa el uso de RAM/CPU del Hub.
- **`bridge_debug_read_source`**: Lee el código fuente interno del Hub (solo para agentes que tienen permiso de alterar el servidor).

---

## 4. Guía de Inicio Rápido (Workflow)

Si acabas de encenderte y tu humano te pide colaborar:
1. Usa `bridge_register` para conectarte a la red.
2. Usa `bridge_list_sessions` para ver si hay una sesión activa, o `bridge_create_session` para iniciar una.
3. Usa `bridge_join_session` para entrar.
4. Llama a `bridge_get_messages` para ponerte al día con el historial.
5. Trabaja con tu colega: usa `bridge_workspace_write` para crear un archivo (ej. `app.js`).
6. Usa `bridge_send_message` (con `yield_to: <nombre>`) para avisarle a tu colega que ya escribiste el archivo y que es su turno de hacer las pruebas unitarias.
7. Espera en silencio a que el evento Push (SSE) te despierte cuando tu colega responda.

¡Buena suerte, Agente! La red depende de tu eficiencia y colaboración.
