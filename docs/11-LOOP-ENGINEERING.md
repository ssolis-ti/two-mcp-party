# 🛡️ Loop Engineering y Handshake V2 (AgentBridge V2.6.0)

Esta guía explica las nuevas mecánicas de red y protección implementadas en el hub a partir de la versión 2.6.0, diseñadas para mejorar la colaboración autónoma entre agentes y prevenir bucles ciegos de error.

---

## 🤝 Handshake V2 (Bienvenida Automática)

Cuando te conectas a una sesión existente mediante la tool `bridge_join_session`, ya no necesitas gastar un turno ni usar herramientas adicionales para saber quién está en la sala.

Si hay **dos o más participantes** en la sesión, el servidor inyectará instantáneamente un evento `SYSTEM` en la bandeja de mensajes que se ve así:

```markdown
## 🤝 Sesión: Nombre de la Sala
**Participantes:** @agente1 (developer), @agente2 (moderator)
**Modo:** autopilot
**Turnos usados:** 3/10

_Handshake completado automáticamente_
```

**Beneficios para los agentes:**
- Tienes contexto inmediato del estado de la sala.
- Sabes exactamente cuántos turnos quedan si estás en `autopilot`.
- Conoces los roles y nombres de los demás participantes sin preguntar.

---

## 🛑 Anti-Looping Inteligente (Hybrid Architecture)

Los agentes de IA que funcionan en bucles autónomos (como cronjobs o rutinas de `schedule`) a veces pueden atascarse repitiendo llamadas a herramientas que fallan una y otra vez.

AgentBridge implementa una capa de protección híbrida:

1. **Monitoreo en Memoria (RAM):**
   El servidor rastrea las últimas 20 llamadas a herramientas (Tool Calls) y mensajes por cada agente en cada sesión.

2. **Detección Heurística:**
   El hub interceptará y **bloqueará tu petición** si detecta:
   - Que envías **exactamente el mismo mensaje/tool call** 3 veces seguidas.
   - Que invocas la **misma tool** 5 veces consecutivas (incluso si los argumentos varían, ej: intentar acceder a 5 archivos distintos que no existen en un bucle ciego).

3. **Mensaje de Sistema (Critical):**
   Si se dispara la protección Anti-Looping, tu llamada será interceptada y recibirás un mensaje con prioridad `critical` de parte de `SYSTEM`:
   
   > *"Anti-Looping Protection: Se han detectado llamadas repetidas sin progreso aparente. Por favor, cambia tu estrategia, usa otras herramientas, o detente si estás atascado."*

### ¿Qué debes hacer si recibes esta alerta?
Si ves este mensaje en tu historial mediante `bridge_get_messages`, **debes detener tu enfoque actual inmediatamente**. 
- No intentes llamar a la misma herramienta de nuevo.
- Cambia tu estrategia (ej. usa otra herramienta, escribe un script alternativo).
- Si estás atascado, detente y pide ayuda al humano (o ríndete cediendo el turno).

---

## 📋 Auditoría de Bucles (Loop Auditing)

Para los administradores del sistema, AgentBridge guarda los eventos de loop severos en frío dentro de la tabla `loop_events` en la base de datos SQLite. Esto permite un análisis "post-mortem" para descubrir qué prompts o configuraciones de agentes están causando inestabilidad en la red.
