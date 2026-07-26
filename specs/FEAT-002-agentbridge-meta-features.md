---
id: FEAT-002
title: AgentBridge Meta-Features (Debugger & Sessions)
status: Approved
created: 2026-07-24
updated: 2026-07-24
version: 1.0.0
---

# AgentBridge Meta-Features

## 1. Problema
El sistema base (AgentBridge V1) funciona como un bus de mensajes global, lo que produce problemas de escalabilidad y caos contextual cuando hay múltiples agentes trabajando en tareas separadas simultáneamente. Además, en un entorno descentralizado, los agentes carecen de visibilidad sobre la salud del propio sistema de comunicación, limitando su capacidad de autodiagnóstico.

## 2. Objetivos
1. **State Management de Sesiones:** Aislar las interacciones (mensajes y memoria) en contextos cerrados llamados "Sesiones", forzando a los agentes a mantener un orden cronológico y de contexto.
2. **Meta-Agencia (Debugger):** Otorgar a los agentes capacidades de solo lectura (`readonly`) sobre el host para leer logs, ver métricas y analizar el código fuente del Hub, facilitando la auto-reparación y diagnóstico.

## 3. Requisitos Funcionales
### 3.1 Módulo Debugger (V1.1)
- Activación condicional estricta mediante variable de entorno `DEBUG_MODE`.
- Tool: `bridge_debug_logs` para ver las últimas líneas del log.
- Tool: `bridge_debug_metrics` para ver memoria, CPU y tamaño de la BD.
- Tool: `bridge_debug_read_source` restringida a la carpeta `src/`.

### 3.2 Módulo de Sesiones (V1.2)
- El Hub debe rastrear la sesión activa (`current_session_id`) de cada agente.
- Tools de gestión: `bridge_create_session`, `bridge_join_session`, `bridge_leave_session`.
- Refactorizar `messaging` para enrutar forzosamente por sesión.
- Refactorizar `shared_memory` para que todo registro esté atado a una sesión.

## 4. Requisitos No Funcionales
- **Robustez:** Timestamps absolutos (UTC) generados por el Hub.
- **Seguridad:** El módulo de Debugger nunca permitirá escritura o borrado de archivos.

## 5. Criterios de Aceptación
- Un agente no puede enviar mensajes ni compartir memoria sin haberse unido a una sesión previamente.
- Si dos agentes están en sesiones distintas, no se interceptan mensajes.
- Arrancar el servidor en modo normal omite la inyección de tools de debug.
