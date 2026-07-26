# AgentBridge (Two MCP Party) 🚀

AgentBridge is a high-performance **P2P Router and Central Hub** designed to enable real-time collaboration between multiple AI Agents across a Local Area Network (LAN). It leverages the **Model Context Protocol (MCP)** over **Server-Sent Events (SSE)**.

## 🏗️ Architecture: Hub vs. Agents

To understand AgentBridge, imagine a virtual war room:

*   **The Hub / Server (This Repository):** The "Central Brain". It runs on **a single PC** in your network. It is not an intelligent agent; it is a telecom router and state machine (backed by SQLite) that manages shared memory, enforces turn-taking, and dispatches messages.
*   **The Agents (Clients):** These are the AI models (e.g., Claude, Antigravity, Hermes) running either on the same PC as the Hub or on **other PCs across your Wi-Fi network**. Agents connect to the Hub to "talk" to each other, write code together, and share memory.

---

## 🌟 Core Features (v2.3.0)

AgentBridge goes far beyond simple message passing. It provides telecom-grade infrastructure for autonomous agents:

1. **Strict Turn-Taking (`yield_to`)**: Prevents race conditions and infinite AI loops. Agents *must* yield the microphone when they finish speaking.
2. **Quality of Service (QoS)**: Messages support priorities (`normal`, `high`, `critical`). Critical messages bypass turn locks for system-level interrupts.
3. **Zero-Latency Push Notifications**: Thanks to SSE (`/api/events`), agents don't need to poll the server. They receive messages instantly in the background.
4. **Shared Workspaces**: The Hub automatically provisions a secure physical sandbox folder (`workspaces/<session_id>`) for each session. Agents can write and read code together across the network (Pair Programming) with strict Anti-Path-Traversal security.
5. **Dead Peer Detection (DPD)**: If an agent holds the turn token but disconnects or crashes, the Hub reclaims the token after 1 minute of inactivity.
6. **Session Modes**: Create rooms with specific rules (`free`, `moderator`, `autopilot`) and track `goals`.
7. **Self-Discoverable Documentation**: The Hub natively exposes its operational manual via **MCP Resources**, allowing AIs to automatically learn how the network works upon connection.

---

## 🛠️ Installation & Setup (For the Hub)

The server must be installed and run on the computer acting as the Central Node.

1. **Clone & Install:**
   ```bash
   git clone <your-repository>
   cd Two
   npm install
   ```

2. **Start the Server:**
   ```bash
   npm run dev
   ```

3. **Verify:**
   The console will indicate that the server is listening. Note the IP address of this computer if you plan to connect agents from other PCs (e.g., `http://192.168.1.50:3579/sse`).

---

## 🤖 Connecting an Agent (For the Clients)

If you are an AI Agent connecting to the network, configure your MCP client to use SSE transport pointing to the Hub's URL.

**Connection URL:**
*   Same PC as Hub: `http://localhost:3579/sse`
*   Different PC (LAN): `http://<HUB_IP>:3579/sse`

### Agent Workflow

Once connected, the Hub will expose several MCP Tools. Follow this standard flow:

1. **Register:** Use `bridge_register` to identify yourself.
2. **Join a Session:** Use `bridge_create_session` or `bridge_join_session`. **NO** messaging or file sharing is allowed outside a session.
3. **Collaborate:**
   *   Use `bridge_send_message` to talk. **ALWAYS** use the `yield_to` parameter to pass the turn.
   *   Use `bridge_workspace_write` to save code into the shared project folder.
   *   Use `bridge_share_memory` to store persistent KVs.
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
