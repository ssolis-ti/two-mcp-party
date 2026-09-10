# AgentBridge (Two MCP Party) 🚀

AgentBridge is a high-performance **P2P Router and Central Hub** designed to enable real-time collaboration between multiple AI Agents across a Local Area Network (LAN). It leverages the **Model Context Protocol (MCP)** over **Server-Sent Events (SSE)**.

## 📚 Documentation Index (Start Here!)

If you are a Human Developer or an AI Agent, use this index to navigate the project:

- 🤖 **[Agent Operations Manual](agent-manual/OPERATIONS.md)**: **AGENTS START HERE.** The mandatory System Prompt containing loop engineering rules, turn-taking etiquette (`yield_to`), and task discovery workflows.
- 🚀 **[Getting Started](documentation/GETTING_STARTED.md)**: Bring up the Hub, configure your network, and connect your first agents.
- 🛠️ **[MCP Tools API Reference](documentation/MCP_TOOLS.md)**: Detailed breakdown of the 34 MCP tools exposed by the Hub (Messaging, Shared Memory, Workspaces, Tasks, Swarm, Materialize).
- 🎛️ **[Session Modes Guide](documentation/SESSION_MODES.md)**: How `moderator`, `autopilot` and `free` modes change the interaction rules, and how goal checkpoints work.

## 🏗️ Architecture: Hub vs. Agents

To understand AgentBridge, imagine a virtual war room:

*   **The Hub / Server (This Repository):** The "Central Brain". It runs on **a single PC** in your network. It is not an intelligent agent; it is a telecom router and state machine (backed by SQLite) that manages shared memory, enforces turn-taking, and dispatches messages.
*   **The Agents (Clients):** These are the AI models (e.g., Claude, Antigravity, Hermes) running either on the same PC as the Hub or on **other PCs across your Wi-Fi network**. Agents connect to the Hub to "talk" to each other, write code together, and share memory.

---

## 🌟 Core Features (v2.6.1)

AgentBridge goes far beyond simple message passing. It provides telecom-grade infrastructure for autonomous agents, implementing advanced Loop Engineering concepts:

1. **Handshake V2 & Auto-Discovery**: When joining a session, the Hub automatically injects a `SYSTEM` message providing context about participants, rules, and turn status, enabling immediate situational awareness.
2. **Task Discovery System**: Agents can dynamically orchestrate work using `bridge_publish_task`, `bridge_list_tasks`, and `bridge_claim_task`, allowing decentralized work distribution.
3. **Intelligent Anti-Looping**: The Hub actively monitors agent behavior. It prevents "No-Progress" deadlocks by blocking agents that repeat the same tool calls or identical messages consecutively, forcing them to yield or change strategy.
4. **Strict Turn-Taking (`yield_to`)**: Prevents race conditions. Agents *must* yield the microphone when they finish speaking.
5. **Quality of Service (QoS)**: Messages support priorities (`normal`, `high`, `critical`). Critical messages bypass turn locks for system-level interrupts.
6. **Zero-Latency Push Notifications**: Thanks to SSE (`/api/events`), agents receive messages instantly in the background without polling.
7. **Shared Workspaces**: Secure physical sandbox folders (`workspaces/<session_id>`) with strict Path-Traversal security for remote Pair Programming.
8. **Dead Peer Detection (DPD)**: Reclaims turn tokens if an agent disconnects or crashes while holding the turn.
9. **Spec-Driven Development (SDD) Ready**: Designed to work flawlessly with SDD workflows (Specs, Plans, Tasks) in shared workspaces.

---

## ⚙️ Installation & Setup (For the Hub)

The server must be installed and run on the computer acting as the Central Node.

1. **Clone & Install:**
   ```bash
   git clone https://github.com/ssolis-ti/two-mcp-party
   cd two-mcp-party
   npm install
   ```

2. **Configure (optional):**
   The Hub runs with zero configuration — SQLite is created on first boot. Copy
   `.env.example` to `.env` only if you need to change the port, the log level,
   or enable the multi-model modules (see *LLM-backed modules* below).

3. **Run as a Background Service (Recommended):**
   To automatically start the Hub when your PC boots and keep it running invisibly:
   * **Windows:** Open an Administrator terminal and run:
     ```bash
     npm run service:install-windows
     ```
   * **Linux/Mac:**
     ```bash
     npm run service:install-linux
     ```
   You can check the live logs anytime with `pm2 logs`.

4. **Run Manually (Dev Mode):**
   ```bash
   npm run dev
   ```

5. **Verify:**
   The console will indicate that the server is listening. Note the IP address of this computer if you plan to connect agents from other PCs (e.g., `http://192.168.1.50:3579/sse`).
   Run the regression suite with `npm test`.

---

## 🧠 LLM-backed modules (optional)

Most of the Hub is pure coordination infrastructure and needs no AI provider: it
routes messages between the agents *you* connect, each of which brings its own
model. Three modules are different — they call language models *themselves* and
therefore need an external gateway:

| Module | Tools | What it does |
| --- | --- | --- |
| `hosted` | `bridge_spawn_conversation`, `bridge_list_models`, `bridge_hosted_status` | Runs debates/panels/reviews between several models with a deterministic turn plan. |
| `swarm` | `bridge_swarm_*` (8 tools) | Hivemind planning: several models deliberate, a synthesizer emits a structured master plan. It designs — it never executes. |
| `materialize` | `bridge_materialize_plan`, `bridge_materialize_status` | Turns a stored plan into a real MCP session with tasks published as tickets. |

**Without a gateway the Hub still starts and the other 23 tools work normally** —
these 11 simply return an error explaining that the gateway is unreachable.

### Any OpenAI-compatible gateway works

The Hub does **not** integrate providers. It speaks one dialect — the OpenAI
chat API — and delegates provider multiplexing, fallback and rate limiting to
the gateway. So there is nothing to implement per provider: point the URL at
whichever you run.

```bash
LLM_GATEWAY_URL=http://localhost:4000   # LiteLLM
LLM_GATEWAY_URL=http://localhost:8080   # Bifrost
LLM_GATEWAY_URL=http://localhost:8000   # vLLM
LLM_GATEWAY_URL=https://openrouter.ai/api
```

LM Studio, Ollama and the OpenAI API itself work the same way. Provide the key
via `LLM_GATEWAY_KEY` (or `LLM_GATEWAY_ENV_FILE`), and set the model names in
`hosted.config.js` to whatever your gateway exposes — `bridge_list_models` lists
them. The `LITELLM_*` variables are still accepted as aliases. See
`.env.example`.

---

## 🤖 Connecting an Agent (For the Clients)

If you are an AI Agent connecting to the network, configure your MCP client to use SSE transport pointing to the Hub's URL.

**Connection URL:**
*   Same PC as Hub: `http://localhost:3579/sse`
*   Different PC (LAN): `http://<HUB_IP>:3579/sse`

### Agent Workflow

Once connected, the Hub exposes **34 MCP Tools** covering messaging, shared memory, workspace files, task discovery, and multi-model planning.

👉 **[See the Full MCP Tools API Reference](documentation/MCP_TOOLS.md)** 👈

Follow this standard flow:

1. **Register:** Use `bridge_register` to identify yourself.
2. **Join a Session:** Use `bridge_create_session` or `bridge_join_session`. **NO** messaging or file sharing is allowed outside a session.
3. **Collaborate:**
   *   Use `bridge_send_message` to talk. **ALWAYS** use the `yield_to` parameter to pass the turn.
   *   Use `bridge_workspace_write` to save code into the shared project folder.
   *   Use `bridge_publish_task` and `bridge_claim_task` to assign work.
4. **Listen:** Stay connected to the SSE stream to wake up instantly when another agent yields the turn to you.

---

## ⚠️ Network & Firewall Considerations

If connecting agents from **different computers**, be aware of standard LAN barriers:

1. **Windows Firewall:** By default, Windows blocks incoming connections. 
   * **Quick Fix:** We included a script. Open PowerShell as **Administrator** and run:
     ```powershell
     .\scripts\setup-firewall.ps1
     ```
   * 🛡️ **Security Note:** Our script applies the `LocalSubnet` restriction. It is impossible to connect from outside the local network. Combined with your router's NAT, the system is 100% private.

2. **Network Profile:** Ensure the Hub's Wi-Fi or Ethernet connection is set to **Private Network** (not Public). Public networks isolate devices.

3. **Dynamic IPs:** If your router reboots, your Hub's local IP might change (e.g., from `192.168.1.10` to `192.168.1.12`). Run `ipconfig` to find the new IP and update the agents' connection strings.

---
*Built for distributed, autonomous AI agency without cloud dependencies.*
