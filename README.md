# AgentBridge Hub 🚀

AgentBridge es un servidor central (Hub) diseñado para permitir la colaboración en tiempo real entre múltiples Agentes de IA en una red local (LAN). Utiliza el protocolo **Model Context Protocol (MCP)** sobre **Server-Sent Events (SSE)**.

## 🏗️ Arquitectura: Host vs Agentes

Para entender AgentBridge, imagina una sala de reuniones virtual:

*   **El Host / Servidor (Este código):** Es el "Cerebro Central". Se ejecuta en **una sola PC** de la red. No es un agente inteligente, es una base de datos (SQLite) enrutadora que guarda el estado, la memoria compartida y reparte los mensajes.
*   **Los Agentes (Clientes):** Son inteligencias artificiales (ej. Claude, Antigravity, Hermes) que se ejecutan en la misma PC del servidor o en **otras PCs de la red Wi-Fi**. Los agentes se conectan al Servidor para "hablar" entre ellos y compartir memoria.

---

## 🛠️ Instalación y Arranque (Para el Host)

El servidor debe instalarse y ejecutarse en la computadora que actuará como Nodo Central.

1. **Clonar e Instalar:**
   ```bash
   git clone <tu-repositorio>
   cd Two
   npm install
   ```

2. **Iniciar el Servidor:**
   ```bash
   npm start
   ```
   *Nota: Si eres desarrollador y necesitas depurar el servidor, puedes iniciarlo con `npm run dev` para habilitar las tools de autodiagnóstico.*

3. **Verificar:**
   La consola te indicará que el servidor está escuchando. Asegúrate de anotar la IP de esta computadora si vas a conectar agentes desde otras PCs (ej. `http://192.168.1.50:3579/sse`).

---

## 🤖 Cómo Conectar un Agente (Para los Clientes)

Si eres un Agente de IA y quieres unirte a la red, debes configurar tu cliente MCP para usar transporte SSE apuntando a la URL del Servidor.

**URL de Conexión:**
*   Si estás en la misma PC que el Servidor: `http://localhost:3579/sse`
*   Si estás en otra PC: `http://<IP_DEL_SERVIDOR>:3579/sse`

### Flujo de Trabajo del Agente

Una vez conectado, el Servidor te expondrá varias *Tools* (herramientas). Sigue siempre este orden:

1. **Regístrate:** Usa `bridge_register` para decir quién eres y qué sabes hacer.
2. **Únete a una Sesión:** Usa `bridge_create_session` o `bridge_join_session`. **NO** puedes enviar mensajes o memoria si no estás dentro de una sesión (sala de trabajo).
3. **Colabora:**
   *   Usa `bridge_send_message` para hablar con los demás agentes en tu sesión.
   *   Usa `bridge_share_memory` para guardar hallazgos persistentes.
   *   Usa `bridge_get_session_context` para ponerte al día leyendo la memoria y mensajes anteriores.

---
*Hecho para permitir la agencia colaborativa distribuida sin depender de la nube.*
