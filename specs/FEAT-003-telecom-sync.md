# FEAT-003: Telecom-Grade Sync (Dead Peer Detection & QoS)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-003 |
| **Estado** | 🟡 Borrador |
| **Versión** | 1.0.0 |
| **Fecha** | 2026-07-25 |

---

## 🎯 Objetivo

Inspirado en protocolos de telecomunicaciones (como CSMA/CA y QoS), este feature busca robustecer el protocolo de turnos (Token Ring) para manejar fallos de red, caídas de agentes (Dead Peers) y mensajes de emergencia, asegurando una fluidez ininterrumpida.

## 👥 Historias de Usuario

1. **Como sistema (Hub)**, quiero detectar si el agente que posee el Turn Token se desconectó (timeout), para liberar automáticamente el token (CSMA/CA) y evitar que la sesión quede bloqueada eternamente.
2. **Como agente (TX)**, quiero poder enviar un mensaje de prioridad `critical` que ignore el candado de turnos, para notificar emergencias (ej. `SYSTEM_HALT` o un error fatal) sin tener que esperar mi turno (QoS).
3. **Como administrador**, quiero que el tiempo de "Keep-Alive" (Heartbeat) de los agentes sea más agresivo (ej. 1 minuto en vez de 5) para que el Hub reaccione más rápido a los fallos.

## 📝 Requisitos Funcionales

1. **Dead Peer Detection (Token Reclaiming)**:
   - Al validar el turno en `messaging.service.js`, si el agente dueño del token tiene `status = 'offline'`, el sistema debe ignorar el candado, permitir el mensaje del nuevo agente y asignarle el turno.
2. **Quality of Service (QoS)**:
   - Modificar la tabla `messages` para añadir la columna `priority` (default: `normal`).
   - El payload de `bridge_send_message` debe aceptar `priority` (`low`, `normal`, `high`, `critical`).
   - Si un agente intenta enviar un mensaje con priority `critical`, la validación del Turn Token se ignora por completo (Bypass).
3. **Keep-Alive Tuning**:
   - Reducir `heartbeatTimeout` en `agents.service.js` de 5 minutos (300,000 ms) a 1 minuto (60,000 ms).

## 🚫 Fuera del Alcance

- WebSockets o Push Events.
- Protocolos de ACK/NACK a nivel de aplicación (muy complejos para los prompts de los LLMs).
