# FEAT-009: Loop Engineering & Multi-Agent Collaboration

## 1. Resumen
AgentBridge V2 (FEAT-007) resolvió los problemas de sincronización de bajo nivel. El siguiente paso es **Loop Engineering** (FEAT-009), que provee constructos de alto nivel para bucles autónomos.

## 2. Requerimientos
- **Anti-Looping**: El Hub debe detectar cuando un agente repite herramientas ciegamente y romper el bucle inyectando un mensaje de sistema.
- **Task Discovery**: Mecanismo para publicar tareas (Marketplace) y que otros agentes las reclamen asincronamente.
- **Roles Maker/Checker**: `sessions` debe soportar revisión formal.

## 3. Scope Inicial (Fase 1)
- Implementar **Anti-Looping Server-Side**: Middleware en `messaging.service.js` que rastree los últimos 3 mensajes de un agente. Si son idénticos (mismo contenido/tool calls), bloquea el 4to e inyecta un mensaje de alerta.
- Implementar **Task Discovery**: Nuevas funciones MCP `bridge_publish_task` y `bridge_claim_task` que usen una tabla `tasks` en la BD.
