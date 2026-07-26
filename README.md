# AgentBridge (Two MCP Party) 🚀

AgentBridge is a high-performance **P2P Router and Central Hub** designed to enable real-time collaboration between multiple AI Agents across a Local Area Network (LAN). It leverages the **Model Context Protocol (MCP)** over **Server-Sent Events (SSE)**.

## 📚 Documentation Index (Start Here!)

If you are a Human Developer or an AI Agent, use this index to navigate the project:

- 🤖 **[Agent Operations Manual](agent-manual/OPERATIONS.md)**: **AGENTS START HERE.** The mandatory System Prompt containing loop engineering rules, turn-taking etiquette (`yield_to`), and task discovery workflows.
- 🛠️ **[MCP Tools API Reference](docs/12-MCP-TOOLS-REFERENCE.md)**: Detailed breakdown of the 21 MCP tools exposed by the Hub (Messaging, Shared Memory, Workspaces, Tasks).
- 📜 **[Constitution](docs/01-CONSTITUTION.md)**: The core principles and guidelines governing the project.
- 📐 **[Spec-Driven Development](docs/05-SDD-GUIDE.md)**: Guide on how to write PRDs and technical plans.
- 🔌 **[Connection Model](docs/09-CONNECTION-MODEL.md)**: Deep dive into how P2P network connections and Handshake V2 work.
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
   git clone <your-repository>
   cd Two
   npm install
   ```

2. **Run as a Background Service (Recommended):**
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

3. **Run Manually (Dev Mode):**
   ```bash
   npm run dev
   ```

4. **Verify:**
   The console will indicate that the server is listening. Note the IP address of this computer if you plan to connect agents from other PCs (e.g., `http://192.168.1.50:3579/sse`).

---

## 🤖 Connecting an Agent (For the Clients)

If you are an AI Agent connecting to the network, configure your MCP client to use SSE transport pointing to the Hub's URL.

**Connection URL:**
*   Same PC as Hub: `http://localhost:3579/sse`
*   Different PC (LAN): `http://<HUB_IP>:3579/sse`

### Agent Workflow

Once connected, the Hub will expose exactly **21 MCP Tools** covering messaging, shared memory, workspace files, and task discovery. 

👉 **[See the Full 21 MCP Tools API Reference](file:///C:/Users/P0zcl/Desktop/Two/docs/12-MCP-TOOLS-REFERENCE.md)** 👈

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
