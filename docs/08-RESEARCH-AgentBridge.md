# 🔬 Investigación: Interconexión Universal de Agentes AI

> Documento de investigación previo a la especificación.
> Fecha: 2026-07-24

---

## 📋 Tabla de Contenidos

- [Contexto del Problema](#contexto-del-problema)
- [Estado del Arte](#estado-del-arte)
- [Protocolos Existentes](#protocolos-existentes)
- [Agentes Objetivo](#agentes-objetivo)
- [Patrones Arquitectónicos](#patrones-arquitectónicos)
- [Stack Tecnológico Evaluado](#stack-tecnológico-evaluado)
- [Conclusiones y Recomendación](#conclusiones-y-recomendación)

---

## Contexto del Problema

En una red local pueden existir múltiples PCs, cada una con un agente AI diferente instalado:

- **PC1**: Antigravity IDE (Google)
- **PC2**: Hermes (Nous Research)
- **PC3**: Claude Code / OpenCode / OpenClaw

**Problema central**: Cada agente está aislado. No pueden:
- Compartir hallazgos sobre el codebase
- Colaborar en tareas complejas
- Intercambiar memoria/contexto
- Potenciarse mutuamente

**Analogía**: Es como tener 3 expertos en una oficina, cada uno en un cuarto cerrado, trabajando en el mismo proyecto sin poder hablar entre sí.

---

## Estado del Arte

### Protocolos Estándar (2025-2026)

| Protocolo | Propósito | Mantenedor | Estado |
|-----------|-----------|------------|--------|
| **MCP** (Model Context Protocol) | Agente ↔ Herramientas | Anthropic | ✅ Estándar de facto |
| **A2A** (Agent-to-Agent) | Agente ↔ Agente | Google → Linux Foundation | ✅ Adoptado (AWS, MS, IBM, Salesforce) |
| **ACP** (Agent Client Protocol) | Editor ↔ Agente | Comunidad | 🟡 Emergente |

### Relación entre protocolos

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ACP                    A2A                  MCP   │
│   (Editor ↔ Agente)      (Agente ↔ Agente)    (Agente ↔ Herramienta)  │
│                                                     │
│   Zed ←→ Claude Code     Agent A ←→ Agent B   Agent ←→ DB/API/FS    │
│   VSCode ←→ Hermes       Antigravity ←→ Hermes                      │
│                                                     │
│   JSON-RPC / stdio       HTTPS / JSON-RPC 2.0  JSON-RPC / stdio/SSE │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Insight clave

> **MCP** = cómo un agente "mira" al mundo (tools/datos)
> **A2A** = cómo los agentes "hablan" entre sí
> **Nuestro proyecto** = Implementar ambos de forma práctica para red local

---

## Protocolos Existentes

### A2A (Agent-to-Agent Protocol)

**Especificación técnica:**
- Transporte: **HTTPS** (o HTTP para local)
- Formato: **JSON-RPC 2.0**
- Discovery: **Agent Card** en `/.well-known/agent.json`
- Streaming: **Server-Sent Events (SSE)**

**Agent Card** — El "pasaporte" de cada agente:
```json
{
  "name": "antigravity-agent",
  "description": "Google Antigravity IDE coding agent",
  "url": "http://192.168.1.10:9000",
  "version": "1.0.0",
  "skills": [
    {
      "id": "code-generation",
      "name": "Code Generation",
      "description": "Generate code from specifications"
    }
  ],
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  }
}
```

**Ventajas para nuestro caso:**
- ✅ Estándar abierto, respaldado por Google/AWS/MS/IBM
- ✅ Basado en HTTP/JSON — universal
- ✅ Agent Cards para discovery
- ✅ Diseñado para interoperabilidad entre vendors

**Desventajas:**
- ❌ Pensado para cloud, no optimizado para LAN
- ❌ Requiere que cada agente implemente el protocolo completo
- ❌ No incluye shared memory nativo

### MCP (Model Context Protocol)

**Insight crucial**: Casi TODOS los agentes modernos ya soportan MCP:
- ✅ Antigravity IDE
- ✅ Claude Code
- ✅ Hermes
- ✅ OpenCode / OpenClaw
- ✅ Cursor, Windsurf, Cline, Roo Code...

**Implicación**: Si creamos un **MCP Server que actúe como bridge**, cada agente puede conectarse SIN necesitar adaptadores custom.

---

## Agentes Objetivo

| Agente | Tipo | MCP Support | A2A/ACP Support | Plataforma |
|--------|------|-------------|-----------------|------------|
| **Antigravity IDE** | IDE Agent | ✅ Nativo | 🔧 Via SDK | Windows/Mac/Linux |
| **Hermes** | Terminal Agent | ✅ Nativo | ✅ ACP | Multi-plataforma |
| **Claude Code** | Terminal Agent | ✅ Nativo | ❌ | Multi-plataforma |
| **OpenCode** | Terminal Agent | ✅ Probable | ✅ ACP | Multi-plataforma |
| **OpenClaw** | Gateway Agent | ✅ Nativo | ✅ A2A + ACP | Multi-plataforma |
| **Cursor** | IDE Agent | ✅ Nativo | ❌ | Multi-plataforma |
| **Cline/Roo** | Extension | ✅ Nativo | ❌ | VSCode |

### Observación crítica

> **MCP es el denominador común universal.** Todos los agentes lo soportan.
> La estrategia más pragmática es construir sobre MCP como capa base.

---

## Patrones Arquitectónicos

### Opción A: Hub MCP Puro

```
Agent A ──── MCP ────┐
                     │
Agent B ──── MCP ────┼──── AgentBridge Server (MCP + WebSocket)
                     │         │
Agent C ──── MCP ────┘    [SQLite DB]
                          [Shared Memory]
```

**Pros**: Máxima compatibilidad (todos hablan MCP), zero-config por agente
**Contras**: MCP es request-response, no push real-time

### Opción B: Hub Híbrido (MCP + WebSocket)

```
Agent A ──── MCP Client ────┐
                            │
Agent B ──── MCP Client ────┼──── AgentBridge Hub
                            │     ├── MCP Server (tools)
Agent C ──── MCP Client ────┘     ├── WebSocket Server (real-time)
                                  ├── HTTP/A2A API (discovery)
                                  └── SQLite DB (memory)
```

**Pros**: Lo mejor de ambos mundos — compatibilidad MCP + push real-time
**Contras**: Ligeramente más complejo

### Opción C: Mesh P2P

```
Agent A ←──── WebSocket ────→ Agent B
  ↕                             ↕
Agent C ←──── WebSocket ────→ Agent D
```

**Pros**: Sin punto central de fallo
**Contras**: Complejidad O(N²), cada agente necesita adapter custom

### ✅ Recomendación: Opción B (Hub Híbrido)

**Justificación:**
1. MCP como punto de entrada universal — zero-config para los agentes
2. WebSocket para push notifications entre agentes en real-time
3. API HTTP/A2A para que agentes que soporten A2A puedan usarlo directamente
4. SQLite para memoria compartida persistente
5. Un solo servidor ligero, fácil de deployar

---

## Stack Tecnológico Evaluado

### Server

| Tecnología | Evaluación | Decisión |
|------------|-----------|----------|
| **Node.js** | Async nativo, excelente WS support, MCP SDK oficial | ✅ Elegido |
| Python (FastAPI) | Bueno pero más overhead para WS | ❌ Descartado |
| Go | Performante pero sin MCP SDK oficial | ❌ Descartado |
| Rust | Sobre-ingeniería para este caso | ❌ Descartado |

### Transporte

| Tecnología | Uso |
|------------|-----|
| **MCP (JSON-RPC / stdio+SSE)** | Conexión principal de agentes |
| **WebSocket (`ws` library)** | Push real-time entre agentes |
| **HTTP REST** | Agent Cards, health checks, dashboard API |

### Almacenamiento

| Tecnología | Uso |
|------------|-----|
| **SQLite (better-sqlite3)** | Mensajes, memoria compartida, audit log |
| **WAL mode** | Concurrencia de lecturas/escrituras |
| **JSON campos** | Datos flexibles dentro de SQLite |

### Discovery (Red Local)

| Tecnología | Uso |
|------------|-----|
| **mDNS (bonjour-service)** | Auto-discovery zero-config en LAN |
| **Manual config (fallback)** | Para redes que bloquean multicast |
| **Agent Cards (A2A-style)** | Metadata de capacidades |

### Dashboard (Opcional v2)

| Tecnología | Uso |
|------------|-----|
| **HTML/CSS/JS vanilla** | UI de monitoreo |
| **EventSource (SSE)** | Updates en real-time |

---

## Conclusiones y Recomendación

### Nombre propuesto: **AgentBridge**

> Un conector universal de agentes AI para red local.

### Arquitectura recomendada

```
┌────────────────────────────────────────────────────────────┐
│                   AgentBridge Hub Server                    │
│                                                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐        │
│  │ MCP      │  │ WebSocket    │  │ HTTP/REST     │        │
│  │ Server   │  │ Server       │  │ API           │        │
│  │ (tools)  │  │ (real-time)  │  │ (discovery)   │        │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘        │
│       │               │                  │                 │
│       └───────────────┼──────────────────┘                 │
│                       │                                    │
│              ┌────────┴────────┐                           │
│              │   Core Engine   │                           │
│              │  ├─ Router      │                           │
│              │  ├─ Memory      │                           │
│              │  ├─ Discovery   │                           │
│              │  └─ Audit Log   │                           │
│              └────────┬────────┘                           │
│                       │                                    │
│              ┌────────┴────────┐                           │
│              │   SQLite DB     │                           │
│              │   (WAL mode)    │                           │
│              └─────────────────┘                           │
└────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    MCP Client     WebSocket      HTTP/A2A
         │              │              │
    ┌────┴───┐    ┌─────┴────┐   ┌────┴───┐
    │Agent A │    │ Agent B  │   │Agent C │
    │(Antigr)│    │(Hermes)  │   │(Claude)│
    └────────┘    └──────────┘   └────────┘
```

### MCP Tools que el server expondrá

| Tool | Descripción |
|------|-------------|
| `bridge_register` | Registrar este agente en la red |
| `bridge_send_message` | Enviar mensaje a otro agente |
| `bridge_get_messages` | Leer mensajes recibidos |
| `bridge_list_agents` | Ver agentes conectados |
| `bridge_share_memory` | Compartir contexto/memoria |
| `bridge_get_memory` | Leer memoria compartida |
| `bridge_create_task` | Crear tarea compartida |
| `bridge_get_tasks` | Ver tareas del proyecto |
| `bridge_broadcast` | Mensaje a todos los agentes |

### Por qué esta arquitectura es ganadora

1. **Universal**: MCP es soportado por TODOS los agentes modernos
2. **Zero-config por agente**: Solo agregar el MCP server a la config del agente
3. **Real-time**: WebSocket para notificaciones push
4. **Persistente**: SQLite guarda todo — chat, memoria, tareas
5. **Escalable**: Agregar un 3er, 4to, Nto agente es agregar otra conexión MCP
6. **Liviano**: Un solo proceso Node.js, sin dependencias pesadas
7. **Auditable**: Cada interacción queda loggeada
8. **Local-first**: Funciona en LAN sin internet

---

## Referencias

- [Spec Kit - GitHub](https://github.com/github/spec-kit)
- [A2A Protocol](https://a2a-protocol.org)
- [MCP - Model Context Protocol](https://modelcontextprotocol.io)
- [A2A Protocol - Google Dev](https://google.dev)
- [MCP SDK - GitHub](https://github.com/modelcontextprotocol)
- [bonjour-service - npm](https://www.npmjs.com/package/bonjour-service)
- [ws - npm](https://www.npmjs.com/package/ws)
- [better-sqlite3 - npm](https://www.npmjs.com/package/better-sqlite3)
