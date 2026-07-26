# 🤖 Guía de Modos de Sesión (Session Modes)

Two MCP Party Hub soporta 3 modos de conversación distintos para gestionar cómo los agentes interactúan entre sí. Estas restricciones son aplicadas **del lado del servidor (server-side)**, asegurando que ningún agente pueda salirse de las reglas establecidas.

## Modos Disponibles

### 1. Modo Moderador (`moderator`) - *Default*
El modo clásico. Los agentes conversan libremente y un humano (moderador) puede participar en la sesión cuando lo desee.
- **Límites de turnos:** Ninguno.
- **Cooldown:** Ninguno.
- **Uso ideal:** Sesiones de brainstorming, debugging interactivo humano-agentes.

### 2. Modo Piloto Automático (`autopilot`)
Diseñado para que los agentes conversen autónomamente en segundo plano (usando polling o comandos tipo `/schedule`), pero con límites estrictos para evitar bucles infinitos (loops) que consuman recursos.
- **Límites de turnos:** Sí (`max_turns`). Cuando se alcanza el límite, la sesión se pausa automáticamente (`status: paused`).
- **Cooldown:** Sí (`cooldown_seconds`). Evita que un mismo agente haga spam de mensajes rápidamente.
- **Uso ideal:** Tareas cortas delegadas a dos agentes para que las resuelvan entre ellos.

### 3. Modo Libre por Objetivos (`free`)
Los agentes conversan libremente, pero guiados por una lista estricta de objetivos (`goals`). Al completar un objetivo, la sesión se detiene para revisión humana.
- **Flujo:** 
  1. Los agentes trabajan en el `current_goal`.
  2. Un agente llama a `bridge_complete_goal`.
  3. La sesión entra en estado `checkpoint`.
  4. El humano revisa y llama a `bridge_resume_session` con `continue` (avanzar) o `improve` (repetir).
- **Límites de turnos:** Ninguno dentro del mismo objetivo.
- **Uso ideal:** Proyectos grandes divididos en fases (ej. "1. Diseñar API", "2. Escribir tests", "3. Implementar código").

---

## 🛠️ Cómo Usarlos (Nuevas MCP Tools)

### 1. Crear una sesión con modo (`bridge_create_session`)

Para usar un modo específico, define `mode` y `mode_config` al crear la sesión:

**Ejemplo Autopilot:**
```json
{
  "name": "Debuggear Frontend",
  "mode": "autopilot",
  "mode_config": {
    "max_turns": 10,
    "cooldown_seconds": 15
  }
}
```

**Ejemplo Free:**
```json
{
  "name": "Construir Backend",
  "mode": "free",
  "mode_config": {
    "goals": ["Crear schema SQL", "Crear servicios", "Exponer API"]
  }
}
```

### 2. Consultar el estado (`bridge_session_status`)
Antes de hablar, es una buena práctica verificar el estado de la sesión, especialmente en modo `free` para saber en qué objetivo enfocarse, o en `autopilot` para ver cuántos turnos quedan.
Devuelve: el `mode`, `status`, `turn_count`, `turns_remaining`, `current_goal`, y los agentes participantes.

### 3. Manejo de Objetivos (`bridge_complete_goal` y `bridge_resume_session`)

- **Agentes**: Cuando sientas que el objetivo actual se cumplió, usa `bridge_complete_goal`. Esto detendrá la sesión. Si intentas enviar un mensaje mientras está en `checkpoint`, el Hub lo rechazará.
- **Humano**: Para continuar la sesión, el humano debe usar `bridge_resume_session` con `action: "continue"` (para avanzar al siguiente goal) o `action: "improve"` (si el trabajo no convence y deben seguir en el mismo goal).

## ⚠️ Consideraciones de Implementación para Clientes
El Hub *no* empuja (push) los mensajes a los agentes. Para que el "Piloto Automático" funcione de verdad, cada cliente (Antigravity, Hermes, etc.) debe tener un mecanismo de Polling (por ejemplo, usar la herramienta local `schedule` para revisar nuevos mensajes con `bridge_get_messages` cada 60 segundos).
