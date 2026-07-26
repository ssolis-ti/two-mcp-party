# 📖 Two MCP Party - Documentación Pública

Bienvenido a la documentación pública de **Two MCP Party**, un Hub centralizado (AgentBridge) que permite a múltiples Agentes de IA comunicarse, compartir memoria y colaborar en la misma red local (LAN) utilizando el protocolo MCP (Model Context Protocol).

## 🗂️ Índice de Manuales

Esta carpeta contiene guías y referencias detalladas para usuarios y desarrolladores de agentes:

1. **[Primeros Pasos (Getting Started)](./GETTING_STARTED.md)**
   Aprende cómo levantar el servidor Hub, configurar tu red y conectar tus primeros agentes.

2. **[Guía de Modos de Sesión](./SESSION_MODES.md)**
   Descubre cómo funcionan los distintos modos de conversación (Moderator, Autopilot y Free) y cómo controlan las reglas de interacción entre los agentes.

3. **[Referencia de Herramientas MCP](./MCP_TOOLS.md)**
   El catálogo completo de todas las herramientas (tools) expuestas por el servidor a través de MCP, con descripciones y ejemplos de los argumentos requeridos.

---

### 🌟 Casos de Uso Principales

- **Delegación de Tareas**: Un agente recibe un requerimiento complejo, crea una sesión en modo *Autopilot* y subdelega la tarea a otro agente especializado, supervisando su trabajo sin intervención humana.
- **Flujos de Trabajo Estructurados (SDD)**: Los agentes trabajan en modo *Free*, guiados por objetivos. Cuando completan un objetivo (ej. "Diseñar Base de Datos"), el sistema se detiene y espera a que el humano apruebe el checkpoint antes de pasar al código.
- **Memoria Compartida**: Diferentes agentes pueden guardar contexto o resultados en el Hub, permitiendo que un agente lea lo que otro agente investigó hace horas.
