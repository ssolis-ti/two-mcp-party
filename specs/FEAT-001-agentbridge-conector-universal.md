# FEAT-001: AgentBridge — Conector Universal de Agentes AI

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-001 |
| **Autor** | P0zcl + Antigravity Agent |
| **Fecha** | 2026-07-24 |
| **Estado** | 🟡 Borrador |
| **Prioridad** | 🔴 Crítica (funcionalidad core del proyecto) |
| **Investigación** | `docs/08-RESEARCH-AgentBridge.md` |
| **Plan Técnico** | `plans/PLAN-001-agentbridge-hub.md` (pendiente) |

---

## 📋 Resumen

**AgentBridge** es un servidor ligero que actúa como conector universal entre agentes AI de coding (Antigravity, Hermes, Claude Code, OpenCode, OpenClaw, Cursor, etc.) en una red local. Permite que 2 o más agentes compartan chat, memoria, ideas y tareas para potenciarse mutuamente, usando **MCP como protocolo universal de conexión** y **WebSocket para comunicación en tiempo real**.

---

## 🎯 Objetivos

### Objetivo Principal
- [ ] Permitir que 2+ agentes AI se comuniquen y compartan contexto en una red local

### Objetivos Secundarios
- [ ] Zero-config para los agentes: solo agregar el MCP server a su configuración
- [ ] Memoria compartida persistente entre sesiones
- [ ] Escalable de 2 a N agentes sin cambios de arquitectura
- [ ] Funcionar 100% local, sin dependencia de internet
- [ ] Discovery automático de agentes en la red (mDNS)

---

## 👤 Usuarios Objetivo

| Persona | Descripción | Necesidad Principal |
|---------|-------------|---------------------|
| **Desarrollador Multi-Agente** | Tiene 2+ PCs con agentes AI distintos | Que sus agentes colaboren en el mismo proyecto |
| **Equipo Pequeño** | 2-5 personas, cada una con su agente preferido | Compartir hallazgos y contexto entre agentes |
| **Power User** | Una persona con múltiples agentes en la misma PC | Orquestar agentes especializados en diferentes tareas |

---

## 📖 User Stories

### US-001: Registro de Agente
**Como** agente AI conectado a AgentBridge
**Quiero** registrarme en la red con mi nombre y capacidades
**Para** que otros agentes sepan que existo y qué puedo hacer

**Criterios de Aceptación:**
- [ ] El agente puede llamar `bridge_register` vía MCP con nombre y descripción
- [ ] El registro persiste en la base de datos
- [ ] Otros agentes pueden ver al nuevo agente con `bridge_list_agents`
- [ ] Si el agente se desconecta y reconecta, mantiene su identidad

### US-002: Envío de Mensajes
**Como** agente A (Antigravity)
**Quiero** enviar un mensaje a agente B (Hermes)
**Para** compartir un hallazgo o solicitar ayuda en una tarea

**Criterios de Aceptación:**
- [ ] El agente A puede llamar `bridge_send_message` con destinatario y contenido
- [ ] El mensaje se persiste en la base de datos con timestamp
- [ ] El agente B puede leer el mensaje con `bridge_get_messages`
- [ ] Los mensajes soportan texto plano y markdown
- [ ] Se puede adjuntar metadata (tipo: pregunta, respuesta, hallazgo, tarea)

### US-003: Broadcast a Todos
**Como** agente AI
**Quiero** enviar un mensaje a TODOS los agentes conectados
**Para** compartir un descubrimiento relevante para todo el proyecto

**Criterios de Aceptación:**
- [ ] `bridge_broadcast` envía el mensaje a todos los agentes registrados
- [ ] Cada agente lo recibe como mensaje normal al consultar `bridge_get_messages`
- [ ] El sender es excluido de los destinatarios

### US-004: Memoria Compartida
**Como** agente AI
**Quiero** guardar y leer fragmentos de memoria/contexto compartido
**Para** que otros agentes puedan beneficiarse de lo que he aprendido

**Criterios de Aceptación:**
- [ ] `bridge_share_memory` guarda un fragmento con clave, valor, y metadata
- [ ] `bridge_get_memory` recupera fragmentos por clave o búsqueda
- [ ] La memoria persiste entre sesiones (SQLite)
- [ ] Se pueden crear namespaces (por proyecto, por feature)
- [ ] Cada entrada tiene: autor, timestamp, tags, contenido

### US-005: Gestión de Tareas Compartidas
**Como** agente AI
**Quiero** crear y actualizar tareas compartidas
**Para** coordinar trabajo entre agentes sin duplicar esfuerzo

**Criterios de Aceptación:**
- [ ] `bridge_create_task` crea una tarea con título, descripción, asignado
- [ ] `bridge_get_tasks` lista tareas filtradas por estado
- [ ] Las tareas tienen estados: `pending`, `in_progress`, `completed`, `blocked`
- [ ] Cualquier agente puede actualizar el estado de una tarea

### US-006: Discovery de Agentes
**Como** AgentBridge server
**Quiero** anunciarme automáticamente en la red local (mDNS)
**Para** que los agentes me encuentren sin configuración manual

**Criterios de Aceptación:**
- [ ] El server se anuncia como servicio `_agentbridge._tcp` vía mDNS
- [ ] Los clientes pueden descubrir el server sin conocer su IP
- [ ] Fallback: configuración manual de IP:puerto funciona igual

### US-007: Listado de Agentes
**Como** agente AI
**Quiero** ver qué otros agentes están conectados y sus capacidades
**Para** saber a quién puedo pedirle ayuda o delegarle trabajo

**Criterios de Aceptación:**
- [ ] `bridge_list_agents` retorna todos los agentes registrados
- [ ] Cada entrada incluye: nombre, tipo, capacidades, estado, última actividad
- [ ] Se distingue entre agentes online y offline

### US-008: Heartbeat (Ping de Estado)
**Como** agente AI conectado
**Quiero** enviar un ping o heartbeat periódicamente
**Para** que el hub y otros agentes sepan que sigo activo (live)

**Criterios de Aceptación:**
- [ ] El agente puede llamar `bridge_heartbeat` para actualizar su `last_seen`
- [ ] El hub marca automáticamente como `offline` a los agentes que no enviaron heartbeat en X minutos (timeout)
- [ ] El estado `online`/`offline` se refleja en `bridge_list_agents`

---

## 🎨 Diseño & UX

### Interfaz del Agente (MCP Tools)

Los agentes interactúan con AgentBridge exclusivamente a través de **MCP tools**. No necesitan UI gráfica — simplemente llaman herramientas:

```
Agente → MCP Client → AgentBridge MCP Server → SQLite/WebSocket
```

### Flujo Típico de Uso

1. **Setup** (una vez):
   - Instalar y ejecutar AgentBridge: `npx agentbridge` o `node server.js`
   - Agregar MCP server a la config del agente (un JSON/YAML)

2. **Conexión**:
   - El agente inicia sesión y detecta AgentBridge
   - Llama `bridge_register` para anunciarse
   - Llama `bridge_list_agents` para ver quién más está

3. **Colaboración**:
   - Envía mensajes: `bridge_send_message`
   - Comparte hallazgos: `bridge_share_memory`
   - Crea tareas: `bridge_create_task`

4. **Lectura**:
   - Revisa mensajes: `bridge_get_messages`
   - Consulta memoria: `bridge_get_memory`
   - Ve tareas: `bridge_get_tasks`

### Dashboard Web (v2 — futuro)

Un panel web ligero para monitoreo visual:
- Ver agentes conectados en tiempo real
- Leer el chat entre agentes
- Buscar en la memoria compartida
- Gestionar tareas

---

## ⚠️ Restricciones

- **Solo red local (LAN)**: No diseñado para internet/WAN en v1
- **Sin autenticación en v1**: Confianza implícita en la red local
- **Tamaño de mensaje**: Máximo 1MB por mensaje
- **No reemplaza al agente**: AgentBridge no ejecuta código — solo facilita comunicación
- **MCP como requisito**: Los agentes deben soportar MCP para conectarse

---

## 🔗 Dependencias

| Dependencia | Tipo | Estado |
|-------------|------|--------|
| Node.js >= 18 | Runtime | ✅ Resuelta |
| MCP SDK (@modelcontextprotocol/sdk) | Protocolo | ✅ Disponible |
| ws (WebSocket) | Transporte | ✅ Disponible |
| better-sqlite3 | Storage | ✅ Disponible |
| bonjour-service | Discovery | ✅ Disponible |

---

## 📊 Métricas de Éxito

| Métrica | Objetivo | Cómo se Mide |
|---------|----------|--------------|
| Latencia de mensaje | < 100ms en LAN | Timestamp send vs receive |
| Setup time | < 5 minutos para conectar 2 agentes | Manual testing |
| Agentes simultáneos | >= 10 | Load testing |
| Uptime del server | > 99% en sesión activa | Monitoring |
| Tamaño del server | < 5MB instalado | Disk usage |

---

## ❌ Fuera de Alcance (v1)

- Autenticación/autorización entre agentes
- Encriptación de mensajes
- Soporte para WAN/internet
- Ejecución remota de código entre agentes
- Video/audio streaming entre agentes
- Dashboard web (será v2)
- Plugin system para extensiones
- Rate limiting

---

## 📝 Notas Adicionales

### ¿Por qué MCP como base?

La decisión de usar MCP como protocolo base se fundamenta en que es el **único protocolo soportado por TODOS los agentes AI modernos** (ver `docs/08-RESEARCH-AgentBridge.md`). Mientras que A2A es más elegante teóricamente, requeriría adapters custom para cada agente. MCP ya está integrado — solo hay que agregar un server a la config.

### Escalabilidad a futuro

La arquitectura Hub Híbrido permite evolucionar sin romper compatibilidad:
- **v1**: MCP Server + SQLite (funcional, simple)
- **v2**: + Dashboard web + WebSocket push notifications
- **v3**: + A2A protocol support + discovery avanzado
- **v4**: + Autenticación + soporte WAN

### Inspiración

Este proyecto se inspira en:
- El concepto de "Agent Cards" de A2A Protocol
- La filosofía de MCP de ser un "conector universal"
- La simplicidad de SQLite como base de datos embebida
- La potencia de WebSocket para comunicación real-time

---

> **Recordatorio**: Esta spec debe ser aprobada antes de crear el plan técnico en `plans/PLAN-001-agentbridge-hub.md`.
