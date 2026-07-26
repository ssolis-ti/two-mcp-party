# FEAT-004: Fluidez y Sincronización Telecom (SSE, QoS, DPD)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-004 |
| **Estado** | 🟡 Borrador |
| **Versión** | 1.0.0 |
| **Fecha** | 2026-07-25 |

---

## 🎯 Objetivo

Eliminar la latencia del polling y robustecer la estabilidad de la red multi-agente utilizando conceptos de telecomunicaciones: Event-Driven Push (SSE), Quality of Service (QoS) y Dead Peer Detection (DPD).

## 📝 Requisitos Funcionales

1. **Push Notifications (Server-Sent Events)**:
   - Crear un endpoint HTTP `GET /api/events` en el servidor Express.
   - Los clientes pueden conectarse a este endpoint enviando `?agent=nombre`.
   - Cuando el Hub recibe un mensaje, cede el turno, o detecta un cambio de estado, emite un evento SSE a los clientes conectados.
2. **Dead Peer Detection (DPD)**:
   - El timeout de latidos (`heartbeat`) se reduce a 1 minuto.
   - Si el agente que posee el Turn Token está `offline`, cualquier agente puede "robar" el turno para evitar que la sesión muera (CSMA/CA).
3. **Quality of Service (QoS)**:
   - Añadir columna `priority` a la tabla `messages`.
   - Mensajes con prioridad `critical` ignoran el cerrojo del turno.
4. **Relojes Lógicos (Sequence Numbers)**:
   - Exponer el `ROWID` de SQLite en los mensajes como `seq` para garantizar ordenamiento estricto en el lado del cliente.

## 📋 Requisitos No Funcionales

- El uso del endpoint SSE debe ser opcional. Los clientes antiguos que usan polling (`bridge_get_messages`) seguirán funcionando.
