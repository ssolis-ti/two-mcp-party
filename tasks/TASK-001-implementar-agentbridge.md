# TASK-001: Implementación Core de AgentBridge

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | TASK-001 |
| **Plan Asociado** | `plans/PLAN-001-agentbridge-hub.md` |
| **Autor** | P0zcl + Antigravity Agent |
| **Fecha** | 2026-07-24 |
| **Estado** | 🔴 Todo |

---

## 📋 Lista de Tareas (Ejecución)

### Fase 1: Setup del Proyecto
- [ ] 1.1 Iniciar proyecto Node.js (`npm init -y`) en `src/` (o en la raíz si aplica)
- [ ] 1.2 Instalar dependencias core (`@modelcontextprotocol/sdk`, `express`, `ws`, `better-sqlite3`, `bonjour-service`, `pino`)
- [ ] 1.3 Configurar `package.json` para ES Modules (`"type": "module"`) y scripts
- [ ] 1.4 Crear estructura base de carpetas (`src/core`, `src/modules`, `src/transport`, etc.)

### Fase 2: Core Engine & DB
- [ ] 2.1 Implementar `src/core/database.js` (Wrapper SQLite + WAL mode)
- [ ] 2.2 Implementar `src/core/event-bus.js` (EventEmitter básico)
- [ ] 2.3 Implementar `src/core/logger.js` (Configuración de Pino)
- [ ] 2.4 Implementar `src/core/module-registry.js` (Carga dinámica de módulos)
- [ ] 2.5 Implementar `src/core/engine.js` (Orquestador principal)

### Fase 3: Transport Layer (MCP Server)
- [ ] 3.1 Implementar `src/transport/mcp-server.js` (Servidor stdio/SSE básico)
- [ ] 3.2 Integrar el registro de tools desde los módulos hacia el MCP Server

### Fase 4: Módulo de Agentes (Agents Module)
- [ ] 4.1 Crear `src/modules/agents/agents.schema.sql`
- [ ] 4.2 Implementar `src/modules/agents/agents.service.js` (Guardar, listar agentes, timeout de heartbeat)
- [ ] 4.3 Implementar `src/modules/agents/agents.tools.js` (`bridge_register`, `bridge_list_agents`, `bridge_heartbeat`)
- [ ] 4.4 Implementar `index.js` del módulo

### Fase 5: Módulo de Mensajería (Messaging Module)
- [ ] 5.1 Crear `src/modules/messaging/messaging.schema.sql`
- [ ] 5.2 Implementar `messaging.service.js` (Guardar, leer mensajes, manejar broadcasts)
- [ ] 5.3 Implementar `messaging.tools.js` (`bridge_send_message`, `bridge_get_messages`, `bridge_broadcast`)
- [ ] 5.4 Implementar `index.js` del módulo

### Fase 6: Módulo de Memoria Compartida (Memory Module)
- [ ] 6.1 Crear `src/modules/memory/memory.schema.sql`
- [ ] 6.2 Implementar `memory.service.js` (Guardar, buscar, filtrar por namespace/clave)
- [ ] 6.3 Implementar `memory.tools.js` (`bridge_share_memory`, `bridge_get_memory`)
- [ ] 6.4 Implementar `index.js` del módulo

### Fase 7: Entry Point & Integración
- [ ] 7.1 Implementar `src/server.js` (Instanciar base de datos, motor, cargar módulos, iniciar transporte)
- [ ] 7.2 Implementar `src/index.js` (CLI y gestión de procesos)
- [ ] 7.3 Realizar prueba end-to-end local (Registrar agente manual, enviar mensaje)

---

## 📝 Notas de Implementación
- El módulo de Tareas y Discovery se implementarán en una Fase 8 posterior, una vez validado el core.
- Se debe asegurar que las rutas SQL se lean dinámicamente o se inyecten al iniciar el motor.
- `better-sqlite3` debe configurarse con `pragma journal_mode = WAL;`.
