# PLAN-002: Implementación de Protocolo de Turnos (Turn Token)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-002 |
| **Spec Asociada** | `specs/FEAT-002-turn-taking-protocol.md` |
| **Fecha** | 2026-07-25 |
| **Estado** | 🟡 Borrador |

---

## 📋 Resumen Técnico

Implementar un mecanismo de "Token Ring" o Mutex lógico sobre la tabla `sessions`. Un agente solo puede hablar si tiene el token de la sesión. El token se transfiere explícitamente al final del mensaje.

## 🏗️ Arquitectura

### Componentes Principales

| Componente | Responsabilidad |
|------------|----------------|
| `sessions.schema.sql` | Almacenar el token actual (`current_turn` TEXT). |
| `messaging.service.js` | Validar el token en `sendMessage()`. |
| `messaging.tools.js` | Añadir `yield_to` al schema de `bridge_send_message` y crear tool `bridge_yield_turn`. |

## 📁 Estructura de Archivos Afectada

```
src/
├── modules/
│   ├── sessions/
│   │   └── sessions.schema.sql     # Añadir columna
│   ├── messaging/
│   │   ├── messaging.service.js    # Lógica de validación RX/TX
│   │   └── messaging.tools.js      # Actualizar schemas MCP
fixes/
└── migrate-current-turn.sql        # Script de migración DB
```

## 🔄 Flujo de Datos

1. Agente A envía mensaje usando `bridge_send_message` e incluye `yield_to: 'agent-b'`.
2. Servidor guarda el mensaje y ejecuta `UPDATE sessions SET current_turn = 'agent-b'`.
3. Agente A hace polling y trata de enviar otro mensaje. Servidor rechaza: "Not your turn".
4. Agente B hace polling, ve el mensaje, envía respuesta y usa `yield_to: 'agent-a'`.

## ⚡ Performance

Cero impacto. Todo se resuelve en la misma query existente que busca el estado de la sesión (`SELECT mode, current_turn...`).

## 🚀 Plan de Deploy

1. Correr script de migración SQL.
2. Modificar código.
3. Reiniciar servidor MCP.
