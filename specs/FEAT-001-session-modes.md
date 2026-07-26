# FEAT-001: Modos de Conversación Autónoma entre Agentes

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-001 |
| **Autor** | Antigravity + User |
| **Fecha** | 2025-07-25 |
| **Estado** | 🟡 Borrador |
| **Prioridad** | 🔴 Crítica |
| **Plan Técnico** | `plans/PLAN-001-session-modes.md` |

---

## 📋 Resumen

Implementar tres modos de conversación en las sesiones del Hub que permitan a los agentes conversar de forma autónoma con distintos niveles de intervención humana: **Autopilot** (limitado), **Moderator** (usuario participa activamente), y **Free** (agentes autónomos con checkpoints por goal).

## 🎯 Objetivos

### Objetivo Principal
- [ ] Los agentes pueden mantener conversaciones autónomas sin intervención humana constante, con guardrails de seguridad

### Objetivos Secundarios
- [ ] El usuario puede elegir su nivel de participación al crear la sesión
- [ ] Las restricciones por modo se aplican server-side (no dependen de la buena voluntad del agente)
- [ ] El sistema de goals permite pausas naturales para revisión humana

## 👤 Usuarios Objetivo

| Persona | Descripción | Necesidad Principal |
|---------|-------------|---------------------|
| Operador Humano | Dueño de ambos agentes | Observar/moderar la conversación sin estar pegado al chat |
| Agente A (Antigravity) | Agente IDE local | Conversar y colaborar con Agente B autónomamente |
| Agente B (Hermes) | Agente remoto LAN | Conversar y colaborar con Agente A autónomamente |

## 📖 User Stories

### US-001: Crear sesión con modo
**Como** operador humano
**Quiero** crear una sesión especificando un modo (`autopilot`, `moderator`, `free`)
**Para** controlar el nivel de autonomía de los agentes

**Criterios de Aceptación:**
- [ ] `bridge_create_session` acepta un campo `mode` con valores: `autopilot`, `moderator`, `free`
- [ ] El modo se persiste en la tabla `sessions`
- [ ] Si no se especifica modo, el default es `moderator`

### US-002: Modo Autopilot
**Como** operador humano
**Quiero** que los agentes conversen de forma limitada en segundo plano
**Para** que resuelvan cosas simples sin mi intervención

**Criterios de Aceptación:**
- [ ] La sesión tiene un `max_turns` configurable (default: 10)
- [ ] El Hub rechaza mensajes que excedan el límite de turnos
- [ ] Hay un `cooldown_seconds` mínimo entre mensajes del mismo agente (anti-spam)
- [ ] Al alcanzar el límite, la sesión cambia a status `paused` y se notifica

### US-003: Modo Moderator
**Como** operador humano
**Quiero** participar activamente en la conversación junto a los agentes
**Para** guiar la discusión y tomar decisiones

**Criterios de Aceptación:**
- [ ] El usuario se registra como un agente especial de tipo `human`
- [ ] Los agentes pueden dirigir mensajes/preguntas al moderador (type: `question`)
- [ ] Sin límite de turnos (la sesión vive mientras el humano quiera)
- [ ] El Hub reconoce el rol `moderator` en la sesión

### US-004: Modo Free con Goals
**Como** operador humano
**Quiero** que los agentes conversen libremente hacia un objetivo, con pausas al completar cada goal
**Para** supervisar el progreso sin micromanagement

**Criterios de Aceptación:**
- [ ] La sesión se crea con una lista de `goals` en metadata
- [ ] Los agentes pueden marcar un goal como `completed` via `bridge_complete_goal`
- [ ] Al completar un goal, la sesión pasa a `checkpoint` y se espera aprobación humana
- [ ] El humano puede: `continue` (siguiente goal), `improve` (rehacer), o `pause`
- [ ] Sin límite de turnos dentro de un goal

## 🔧 Diseño Técnico (Alto Nivel)

### Cambios al Schema de Sessions

```sql
ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'moderator'; 
-- valores: 'autopilot', 'moderator', 'free'
ALTER TABLE sessions ADD COLUMN mode_config TEXT; 
-- JSON: {max_turns, cooldown_seconds, goals[], current_goal_index}
ALTER TABLE sessions ADD COLUMN turn_count INTEGER DEFAULT 0;
```

### Nuevo Tool: `bridge_session_status`
Devuelve el estado actual de la sesión incluyendo modo, turnos restantes, goal actual, etc. Los agentes lo consultan antes de actuar.

### Nuevo Tool: `bridge_complete_goal`
Solo para modo `free`. El agente declara que un goal se completó y la sesión entra en `checkpoint`.

### Nuevo Tool: `bridge_resume_session`
Solo para el operador humano. Responde a un checkpoint con `continue`, `improve`, o `pause`.

### Enforcement Server-Side
El `MessagingService.sendMessage()` debe validar:
1. ¿La sesión está en modo `paused` o `checkpoint`? → Rechazar
2. ¿Modo autopilot y `turn_count >= max_turns`? → Rechazar y pausar
3. ¿Cooldown activo para este agente? → Rechazar temporalmente

## ⚠️ Restricciones

- El enforcement DEBE ser server-side. No confiar en que los agentes respeten las reglas
- Los modos no se pueden cambiar mid-session (hay que crear una nueva)
- El cooldown es por agente, no global (dos agentes pueden hablar en paralelo)

## 🔗 Dependencias

| Dependencia | Tipo | Estado |
|-------------|------|--------|
| Schema de sessions existente | Técnica | ✅ Resuelta |
| MessagingService existente | Técnica | ✅ Resuelta |
| Polling client-side (schedule) | Técnica | ⏳ Cada agente debe implementar su propio polling |

## 📊 Métricas de Éxito

| Métrica | Objetivo | Cómo se Mide |
|---------|----------|--------------|
| Conversación autopilot completa | 10 turnos sin error | Logs del Hub |
| Checkpoint de goal funciona | Sesión pausa correctamente | Test manual |
| Moderator flow | Humano + 2 agentes interactúan | Test manual |

## ❌ Fuera de Alcance

- Webhooks o push notifications (se sigue usando polling)
- UI web para el moderador (todo via MCP tools)
- Autenticación o permisos por agente

---

> **Recordatorio**: Esta spec debe ser aprobada antes de crear el plan técnico.
