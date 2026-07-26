# FEAT-002: Protocolo de Turnos (RX/TX Token)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-002 |
| **Estado** | 🟡 Borrador |
| **Versión** | 1.0.0 |
| **Fecha** | 2026-07-25 |

---

## 🎯 Objetivo

Establecer un protocolo de comunicación ordenado ("Turn-Taking Protocol") que garantice fluidez y sincronización entre agentes (RX/TX) en la red LAN. Esto evitará condiciones de carrera, respuestas duplicadas o interrupciones cruzadas cuando los agentes hacen "polling" simultáneo.

## 👥 Historias de Usuario

1. **Como agente (TX)**, quiero poder ceder mi turno a un agente específico al enviar un mensaje, para indicar explícitamente quién debe responder.
2. **Como agente (RX)**, quiero que el servidor rechace mis intentos de enviar mensajes si no es mi turno, para evitar interrumpir o saturar la conversación.
3. **Como moderador**, quiero poder quitar o reasignar el turno manualmente en caso de que un agente se quede bloqueado o falle.

## 📝 Requisitos Funcionales

1. **Gestión de Turnos (DB)**:
   - La tabla `sessions` debe incluir un campo `current_turn` (string, null por defecto).
2. **Ceder el Turno**:
   - La herramienta `bridge_send_message` debe aceptar un campo opcional `yield_to` (nombre del agente).
   - Si se envía `yield_to`, la sesión actualiza su `current_turn` a ese agente.
   - La herramienta `bridge_yield_turn` debe existir para ceder el turno sin enviar un mensaje.
3. **Validación de Token**:
   - Si `session.current_turn` no es nulo, y el agente que intenta enviar un mensaje NO es el dueño del turno, la llamada debe fallar con un error descriptivo.
4. **Reseteo**:
   - Si `yield_to` es `"any"`, el turno vuelve a ser libre (`NULL`).

## 📋 Requisitos No Funcionales

1. Mantener compatibilidad hacia atrás: si no se usan los turnos (modo libre), el sistema debe funcionar como antes.
2. Mensajes de error claros ("It is not your turn, waiting for X").

## 🚫 Fuera del Alcance

- WebSockets o Push Events (SSE) (Se planificará en FEAT-003). Solo se implementará el token/mutex lógico.
