# PLAN-001: AgentBridge Hub — Plan Técnico de Implementación

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-001 |
| **Spec Asociada** | `specs/FEAT-001-agentbridge-conector-universal.md` |
| **Autor** | P0zcl + Antigravity Agent |
| **Fecha** | 2026-07-24 |
| **Estado** | 🟡 Borrador |

---

## 📋 Resumen Técnico

AgentBridge es un servidor Node.js ligero con arquitectura **modular de plugins** que expone un MCP Server como punto de entrada universal para agentes AI. Funciona en **LAN** en v1, con escalabilidad futura vía **Cloudflare Tunnel**.

**Principio de diseño**: Cada capacidad es un **módulo independiente** que se registra en el core. Agregar funciones = agregar módulos, sin tocar el core.

---

## 🏗️ Arquitectura

### Diagrama de Alto Nivel

```
┌──────────────────────────────────────────────────────────────┐
│                    AgentBridge Hub Server                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Transport Layer                       │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │ MCP      │  │ WebSocket    │  │ HTTP/REST        │  │ │
│  │  │ Server   │  │ Server       │  │ API              │  │ │
│  │  │ :3577    │  │ :3578        │  │ :3579            │  │ │
│  │  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │ │
│  └───────┼───────────────┼────────────────────┼────────────┘ │
│          │               │                    │              │
│  ┌───────┴───────────────┴────────────────────┴────────────┐ │
│  │                     Core Engine                          │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │ │
│  │  │ Router   │  │ EventBus  │  │ Module Registry      │  │ │
│  │  └──────────┘  └───────────┘  └──────────────────────┘  │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────────┐ │
│  │                    Modules (Plugins)                      │ │
│  │  ┌────────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐  │ │
│  │  │ Messaging  │ │ Memory   │ │ Tasks  │ │ Discovery  │  │ │
│  │  │ Module     │ │ Module   │ │ Module │ │ Module     │  │ │
│  │  └────────────┘ └──────────┘ └────────┘ └────────────┘  │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────────┐ │
│  │                    Storage Layer                          │ │
│  │           SQLite (WAL mode) — agentbridge.db              │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲
    ┌────┴───┐    ┌─────┴────┐   ┌────┴───┐
    │Agent A │    │ Agent B  │   │Agent C │
    │MCP cli │    │ MCP cli  │   │MCP cli │
    └────────┘    └──────────┘   └────────┘
```

### Componentes Principales

| Componente | Responsabilidad | Tecnología |
|------------|----------------|------------|
| **Transport Layer** | Recibir conexiones MCP/WS/HTTP | MCP SDK, ws, express |
| **Core Engine** | Routing, eventos, registro de módulos | Custom (EventEmitter) |
| **Module Registry** | Cargar/descargar módulos dinámicamente | Custom plugin system |
| **Messaging Module** | Chat entre agentes | SQLite + EventBus |
| **Memory Module** | Memoria compartida persistente | SQLite + JSON |
| **Tasks Module** | Tareas compartidas | SQLite |
| **Discovery Module** | mDNS auto-discovery en LAN | bonjour-service |
| **Storage Layer** | Persistencia de todos los datos | better-sqlite3 (WAL) |

---

## 🔧 Stack Tecnológico

| Categoría | Tecnología | Versión | Justificación |
|-----------|------------|---------|---------------|
| Runtime | **Node.js** | >= 18 | Async nativo, MCP SDK oficial, excelente WS |
| MCP | **@modelcontextprotocol/sdk** | latest | SDK oficial — máxima compatibilidad |
| WebSocket | **ws** | latest | Ligero (0 deps), alta performance |
| HTTP | **express** | 4.x | Maduro, simple, para REST API y health |
| Database | **better-sqlite3** | latest | Sincrónico (ideal para Node), WAL mode |
| Discovery | **bonjour-service** | latest | Pure JS, sin deps nativas, cross-platform |
| CLI | **commander** | latest | Para `agentbridge start`, `agentbridge status` |
| Logging | **pino** | latest | JSON logger ultra-rápido |
| Tunnel (futuro) | **cloudflared** | - | CLI de Cloudflare para exposición WAN |

---

## 📁 Estructura de Archivos

```
src/
├── index.js                    # Entry point — CLI + bootstrap
├── server.js                   # Inicialización del hub server
│
├── core/
│   ├── engine.js               # Core engine — routing + lifecycle
│   ├── event-bus.js            # EventBus interno (pub/sub)
│   ├── module-registry.js      # Carga dinámica de módulos
│   ├── database.js             # Wrapper SQLite + migrations
│   └── logger.js               # Logger configurado (pino)
│
├── transport/
│   ├── mcp-server.js           # MCP Server — punto de entrada principal
│   ├── websocket-server.js     # WebSocket para push real-time
│   └── http-server.js          # REST API (health, agent cards, dashboard)
│
├── modules/
│   ├── messaging/
│   │   ├── index.js            # Registro del módulo
│   │   ├── messaging.service.js    # Lógica de mensajes
│   │   ├── messaging.tools.js      # MCP tools: send, get, broadcast
│   │   └── messaging.schema.sql    # Schema de tabla messages
│   │
│   ├── memory/
│   │   ├── index.js
│   │   ├── memory.service.js
│   │   ├── memory.tools.js
│   │   └── memory.schema.sql
│   │
│   ├── tasks/
│   │   ├── index.js
│   │   ├── tasks.service.js
│   │   ├── tasks.tools.js
│   │   └── tasks.schema.sql
│   │
│   ├── agents/
│   │   ├── index.js
│   │   ├── agents.service.js       # Registro, heartbeat, status
│   │   ├── agents.tools.js         # MCP tools: register, list
│   │   └── agents.schema.sql
│   │
│   └── discovery/
│       ├── index.js
│       └── discovery.service.js    # mDNS announce + browse
│
├── config/
│   └── defaults.js             # Configuración por defecto
│
└── utils/
    ├── id.js                   # Generador de IDs únicos
    └── validators.js           # Validaciones comunes
```

---

## 🔌 Sistema de Módulos (Plugin Architecture)

### Interfaz de un Módulo

Cada módulo exporta un objeto que implementa esta interfaz:

```javascript
// modules/messaging/index.js
export default {
  name: 'messaging',
  version: '1.0.0',
  description: 'Agent-to-agent messaging',

  // Schema SQL para crear tablas
  schema: './messaging.schema.sql',

  // MCP Tools que este módulo registra
  tools: [
    { name: 'bridge_send_message', handler: sendMessage, schema: {...} },
    { name: 'bridge_get_messages', handler: getMessages, schema: {...} },
    { name: 'bridge_broadcast',    handler: broadcast,   schema: {...} },
  ],

  // Hooks del ciclo de vida
  async onLoad(engine) { /* inicialización */ },
  async onUnload(engine) { /* cleanup */ },
};
```

### Cómo agregar un módulo nuevo

1. Crear carpeta en `src/modules/mi-modulo/`
2. Implementar `index.js` con la interfaz de módulo
3. Los MCP tools se registran automáticamente
4. Las tablas SQL se crean automáticamente
5. **No se toca ningún otro archivo**

### Registro automático

```javascript
// core/module-registry.js
class ModuleRegistry {
  async loadAll(modulesDir) {
    const dirs = fs.readdirSync(modulesDir);
    for (const dir of dirs) {
      const mod = await import(`../modules/${dir}/index.js`);
      this.register(mod.default);
    }
  }
}
```

---

## 🔄 Flujo de Datos

### Mensaje entre 2 agentes

```
1. Agent A llama MCP tool "bridge_send_message"
   → { to: "hermes", content: "Encontré un bug en auth.js", type: "finding" }

2. MCP Server recibe la llamada
   → Router la envía al Messaging Module

3. Messaging Module:
   → Persiste en SQLite (tabla messages)
   → Emite evento "message:new" en EventBus
   → WebSocket Server notifica a Agent B (si está conectado por WS)

4. Agent B llama MCP tool "bridge_get_messages"
   → Recibe el mensaje de Agent A
```

### Registro de un agente

```
1. Agent A llama MCP tool "bridge_register"
   → { name: "antigravity", type: "ide", capabilities: ["code-gen", "refactor"] }

2. Agents Module:
   → Crea/actualiza registro en SQLite (tabla agents)
   → Emite evento "agent:registered"
   → Retorna agent_id y lista de agentes actuales
```

---

## 📐 Decisiones Técnicas

### Decisión 1: MCP como transporte primario (no A2A)
- **Contexto**: A2A es más elegante pero requiere adapters custom por agente
- **Decisión**: MCP como entrada principal, A2A como opción futura
- **Justificación**: MCP es soportado por el 100% de los agentes objetivo
- **Consecuencias**: Cada agente solo necesita agregar un MCP server a su config

### Decisión 2: SQLite en vez de Redis/PostgreSQL
- **Contexto**: Necesitamos persistencia con mínima fricción de setup
- **Decisión**: SQLite con WAL mode
- **Justificación**: Zero-config, un solo archivo, suficiente para LAN con <50 agentes
- **Consecuencias**: No apto para cientos de agentes concurrentes (no es el caso de uso)

### Decisión 3: Arquitectura modular de plugins
- **Contexto**: El usuario requiere poder agregar funciones incrementalmente
- **Decisión**: Cada feature es un módulo auto-contenido
- **Justificación**: Desacoplamiento total, se pueden agregar/quitar sin tocar core
- **Consecuencias**: Ligero overhead de abstracción, pero máxima extensibilidad

### Decisión 4: Puertos por defecto
- **Contexto**: Necesitamos puertos que no colisionen con servicios comunes
- **Decisión**: MCP stdio (default) / HTTP :3579 / WS :3578
- **Justificación**: Puertos altos, poco usados, fáciles de recordar (357x)
- **Consecuencias**: Configurables vía CLI args o env vars

### Decisión 5: LAN primero, Cloudflare Tunnel para escalar
- **Contexto**: El usuario quiere local pero escalable a WAN
- **Decisión**: v1 puro LAN, documentar Cloudflare Tunnel como opción
- **Justificación**: `cloudflared tunnel` expone cualquier puerto local a internet con zero-config
- **Consecuencias**: El server no necesita cambios para funcionar por tunnel

---

## 🗄️ Schema de Base de Datos

### Tabla: agents

```sql
CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  type        TEXT DEFAULT 'generic',
  description TEXT,
  capabilities TEXT,  -- JSON array
  status      TEXT DEFAULT 'online',
  host        TEXT,
  metadata    TEXT,  -- JSON object
  created_at  TEXT DEFAULT (datetime('now')),
  last_seen   TEXT DEFAULT (datetime('now'))
);
```

### Tabla: messages

```sql
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  from_agent  TEXT NOT NULL,
  to_agent    TEXT,            -- NULL = broadcast
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'message',  -- message, finding, question, answer
  metadata    TEXT,            -- JSON
  read        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (from_agent) REFERENCES agents(id)
);
```

### Tabla: memory

```sql
CREATE TABLE IF NOT EXISTS memory (
  id          TEXT PRIMARY KEY,
  namespace   TEXT DEFAULT 'default',
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  tags        TEXT,            -- JSON array
  author      TEXT NOT NULL,
  metadata    TEXT,            -- JSON
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (author) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_namespace_key ON memory(namespace, key);
```

### Tabla: tasks

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'pending',  -- pending, in_progress, completed, blocked
  assigned_to TEXT,
  created_by  TEXT NOT NULL,
  priority    TEXT DEFAULT 'medium',
  metadata    TEXT,            -- JSON
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (assigned_to) REFERENCES agents(id),
  FOREIGN KEY (created_by) REFERENCES agents(id)
);
```

---

## 🧪 Estrategia de Testing

| Tipo | Herramienta | Cobertura Objetivo |
|------|-------------|--------------------|
| Unit Tests | Node.js test runner (built-in) | 80%+ para services |
| Integration | Node.js test runner | MCP tools end-to-end |
| Manual | 2 agentes reales | Antigravity ↔ otro agente |

### Tests clave

1. **Registro de agente** → Crear, listar, verificar persistencia
2. **Envío de mensaje** → A→B, verificar que B lo recibe
3. **Broadcast** → A→todos, verificar que B y C lo reciben
4. **Memoria compartida** → Guardar, leer, buscar por namespace
5. **Tareas** → Crear, asignar, actualizar estado
6. **Reconexión** → Agente se desconecta y reconecta, mantiene datos

---

## ⚡ Performance

| Métrica | Objetivo |
|---------|----------|
| Startup del server | < 2s |
| Latencia MCP tool call | < 50ms (LAN) |
| Latencia WebSocket push | < 10ms (LAN) |
| Memoria RAM del server | < 50MB |
| Tamaño en disco (sin DB) | < 5MB |
| Agentes simultáneos | >= 10 |

---

## 🛡️ Seguridad (v1 — mínima)

- [ ] Server solo escucha en interfaz LAN (no 0.0.0.0 por defecto)
- [ ] Validación de inputs en todos los MCP tools
- [ ] SQLite con prepared statements (prevenir injection)
- [ ] Límite de tamaño de mensaje (1MB)
- [ ] Log de todas las operaciones (audit trail)

---

## 🚀 Plan de Escalabilidad (futuro)

### Cloudflare Tunnel

```bash
# Exponer AgentBridge a internet via Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3579

# Resultado: https://random-name.trycloudflare.com
# Los agentes remotos se conectan a esa URL
```

No se requieren cambios en el server — Cloudflare Tunnel es transparente.

### Módulos futuros (post-v1)

| Módulo | Descripción | Prioridad |
|--------|-------------|-----------|
| `dashboard` | UI web para monitoreo | v2 |
| `auth` | Tokens por agente | v2 |
| `file-share` | Compartir archivos entre agentes | v3 |
| `a2a-gateway` | Soporte A2A protocol nativo | v3 |
| `webhooks` | Notificaciones externas | v3 |
| `encryption` | E2E encryption de mensajes | v4 |

---

## ⚠️ Riesgos & Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| MCP SDK breaking changes | Baja | Alto | Pinear versión, tests de integración |
| SQLite lock contention | Baja | Medio | WAL mode + lecturas no-bloqueantes |
| mDNS bloqueado por firewall | Media | Bajo | Fallback a config manual IP:puerto |
| Agente no soporta MCP SSE | Media | Alto | Soportar tanto stdio como SSE transport |

---

> **Recordatorio**: Este plan debe ser aprobado antes de crear las tareas en `tasks/TASK-001-implementar-agentbridge.md`.
