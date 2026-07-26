# 🔌 Modelo de Conexión de AgentBridge

> Documento que explica exactamente cómo se conectan los agentes al hub.
> Fecha: 2026-07-24

---

## La Pregunta Central

> ¿Cada agente conecta un MCP? ¿Es bidireccional? ¿Quién es host y quién es cliente?

---

## Respuesta Corta

```
AgentBridge  =  MCP SERVER  (el hub central, el "host")
Cada Agente  =  MCP CLIENT  (se conectan al hub, son "clientes")
```

**AgentBridge es UN SOLO SERVER.** Los agentes ya traen MCP client integrado. Solo hay que decirles "conéctate a este server".

---

## Cómo funciona MCP en la práctica

### Lo que YA existe en cada agente

Todos los agentes modernos ya tienen un **MCP Client** integrado. Así es como conectan con herramientas externas hoy:

```
┌──────────────────┐         ┌──────────────────┐
│   Antigravity    │         │   MCP Server     │
│   (IDE Agent)    │────────►│   (filesystem)   │
│                  │  MCP    │                  │
│   [MCP Client    │  Client │   Expone tools:  │
│    integrado]    │         │   - read_file    │
│                  │         │   - write_file   │
└──────────────────┘         └──────────────────┘
```

Esto YA lo hacen. **AgentBridge es otro MCP Server más** que se agrega a la lista:

```
┌──────────────────┐         ┌──────────────────┐
│                  │────────►│ MCP: filesystem   │
│   Antigravity    │         └──────────────────┘
│   (IDE Agent)    │         ┌──────────────────┐
│                  │────────►│ MCP: AgentBridge │  ◄── ESTE ES NUESTRO SERVER
│   [MCP Client    │         │  - bridge_send   │
│    integrado]    │         │  - bridge_get    │
│                  │         │  - bridge_list   │
└──────────────────┘         └──────────────────┘
```

---

## El Modelo Exacto

### 1 Hub Server + N Agentes Clientes

```
                    ┌─────────────────────────┐
                    │                         │
                    │    AgentBridge Hub       │
                    │    (MCP SERVER)          │
                    │                         │
                    │    Corre en UNA PC      │
                    │    Puerto: 3579          │
                    │    IP: 192.168.1.50     │
                    │                         │
                    │    ┌─────────────────┐  │
                    │    │   SQLite DB     │  │
                    │    │   (memoria,     │  │
                    │    │    mensajes,    │  │
                    │    │    tareas)      │  │
                    │    └─────────────────┘  │
                    │                         │
                    └────┬──────┬──────┬──────┘
                         │      │      │
                    MCP  │      │      │  MCP
                         │      │      │
              ┌──────────┘      │      └──────────┐
              │                 │                  │
              ▼                 ▼                  ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │   PC #1      │  │   PC #2      │  │   PC #3      │
     │              │  │              │  │              │
     │  Antigravity │  │   Hermes     │  │  Claude Code │
     │  (MCP Client)│  │ (MCP Client) │  │ (MCP Client) │
     └──────────────┘  └──────────────┘  └──────────────┘
```

### ¿Quién es qué?

| Rol | ¿Quién? | ¿Cuántos? | ¿Qué hace? |
|-----|---------|-----------|-------------|
| **SERVER (Host)** | AgentBridge | 1 | Corre el hub, expone tools, guarda datos |
| **CLIENT** | Cada agente AI | N (2, 3, 10...) | Se conecta al hub, llama tools |

---

## ¿Es bidireccional?

### MCP puro = Request/Response (NO push)

```
Agente A → llama bridge_send_message("hola") → AgentBridge guarda en DB → ✅ OK

Agente B → llama bridge_get_messages() → AgentBridge lee DB → devuelve "hola" → ✅ OK
```

**MCP funciona como un buzón de correo:**
- Agent A **deja** un mensaje
- Agent B **revisa** su buzón cuando quiere
- El server NO puede golpear la puerta de Agent B y decirle "tenés un mensaje"

### ¿Esto es un problema?

**NO**, por estas razones:

1. **Los agentes no están ociosos** — cuando trabajan, periódicamente pueden revisar mensajes
2. **Es como funciona el email** — no necesitás push para que sea útil
3. **Los agentes pueden incluir en su flujo** un paso de "revisar el bridge"
4. **Es lo más universal** — TODOS los agentes soportan request/response MCP

### Futuro: Push real-time (v2)

Si más adelante queremos push (el server le avisa al agente), hay opciones:

| Opción | Cómo funciona | Compatibilidad |
|--------|--------------|----------------|
| **MCP SSE notifications** | El server envía eventos por el canal SSE | Solo agentes con SSE transport |
| **WebSocket secundario** | El agente abre un WS adicional al hub | Requiere adapter por agente |
| **File watcher** | El server escribe en un archivo, el agente lo detecta | Universal pero hacky |

Para v1 el modelo request/response es **perfecto y suficiente**.

---

## Configuración práctica por agente

### En Antigravity IDE

Archivo: `mcp_config.json` (o settings del IDE)
```json
{
  "mcpServers": {
    "agentbridge": {
      "url": "http://192.168.1.50:3579/mcp",
      "transport": "sse"
    }
  }
}
```

### En Claude Code

Archivo: `~/.claude/settings.json`
```json
{
  "mcpServers": {
    "agentbridge": {
      "command": "npx",
      "args": ["agentbridge-client", "--server", "http://192.168.1.50:3579"]
    }
  }
}
```

### En Hermes / OpenCode / Cursor

Similar — cada uno tiene su archivo de config MCP donde se agrega el server.

**El punto clave**: el agente NO necesita saber nada especial. Solo agrega un MCP server a su config. Todo lo demás (registro, mensajes, memoria) se hace via las MCP tools que el server expone.

---

## Flujo completo: 2 agentes colaborando

```
SETUP (una vez):
═══════════════

  [PC Central]  →  Ejecutar: node agentbridge/server.js
                   → Hub corriendo en 192.168.1.50:3579

  [PC #1]       →  Agregar MCP server "agentbridge" a config de Antigravity
  [PC #2]       →  Agregar MCP server "agentbridge" a config de Hermes


USO DIARIO:
═══════════

  Antigravity (PC#1):
  ┌─────────────────────────────────────────────┐
  │ "Voy a registrarme en el bridge"            │
  │  → bridge_register(name: "antigravity")     │
  │                                             │
  │ "¿Quién más está conectado?"                │
  │  → bridge_list_agents()                     │
  │  ← ["hermes" está online]                   │
  │                                             │
  │ "Encontré un bug, le aviso a Hermes"        │
  │  → bridge_send_message(                     │
  │      to: "hermes",                          │
  │      content: "Hay un memory leak en db.js",│
  │      type: "finding"                        │
  │    )                                        │
  │                                             │
  │ "Guardo esto en memoria compartida"         │
  │  → bridge_share_memory(                     │
  │      key: "bug-db-leak",                    │
  │      value: "db.js line 45 no cierra conn", │
  │      tags: ["bug", "database"]              │
  │    )                                        │
  └─────────────────────────────────────────────┘

  Hermes (PC#2):
  ┌─────────────────────────────────────────────┐
  │ "Reviso si hay mensajes para mí"            │
  │  → bridge_get_messages()                    │
  │  ← "Antigravity dice: memory leak en db.js"│
  │                                             │
  │ "¿Qué sabe el equipo sobre esto?"           │
  │  → bridge_get_memory(key: "bug-db-leak")   │
  │  ← "db.js line 45 no cierra conexión"      │
  │                                             │
  │ "Lo arreglé, actualizo el estado"           │
  │  → bridge_send_message(                     │
  │      to: "antigravity",                     │
  │      content: "Fixed! Cerré la conexión",   │
  │      type: "answer"                         │
  │    )                                        │
  └─────────────────────────────────────────────┘
```

---

## Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Cada agente conecta un MCP? | SÍ — agrega AgentBridge como MCP server en su config |
| ¿Es bidireccional? | NO en v1 — es request/response (buzón). Push en v2 |
| ¿Quién es host? | AgentBridge Hub es el SERVER (corre en 1 PC) |
| ¿Quién es cliente? | Cada agente AI es un CLIENT (se conecta al hub) |
| ¿Cuántos servers? | 1 solo AgentBridge Hub para toda la red |
| ¿Cuántos clientes? | N agentes (2, 5, 10, los que sean) |
| ¿Qué PC hostea? | Cualquiera — la que esté siempre encendida o una dedicada |
