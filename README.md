# 🌱 Project Two

> *Define what to build before building it.*

---

<p align="center">
    <strong>Un proyecto construido con la metodología Spec-Driven Development (SDD), donde las especificaciones son el artefacto principal y el código es su expresión.</strong>
</p>

---

## 📋 Estado del Proyecto

| Fase | Estado |
|------|--------|
| 🏗️ Estructura Base | ✅ Completada |
| 📜 Constitución | ⏳ Pendiente |
| 📝 Especificación (PRD) | ⏳ Pendiente |
| 🔧 Plan Técnico | ⏳ Pendiente |
| 📋 Desglose de Tareas | ⏳ Pendiente |
| 🚀 Implementación | ⏳ Pendiente |

## 🤔 ¿Qué es SDD?

Spec-Driven Development **invierte la relación tradicional** entre código y especificaciones. En vez de escribir specs que sirven al código, el código sirve a las specs:

- **Las especificaciones son la fuente de verdad**, no el código
- **El código se genera** a partir de especificaciones precisas
- **Mantener el software** significa evolucionar las especificaciones
- **Debuggear** significa corregir las specs que generan código incorrecto

## 📁 Estructura del Proyecto

```
Two/
├── .agents/                  # Configuración de agentes AI
│   └── AGENTS.md            # Reglas y comportamiento del agente
├── .specify/                 # Configuración de Spec Kit
│   └── config.yml           # Configuración del proyecto SDD
├── docs/                     # Documentación completa
│   ├── 00-INDEX.md          # Índice maestro de documentación
│   ├── 01-CONSTITUTION.md   # Principios gobernantes del proyecto
│   ├── 02-SPEC-TEMPLATE.md  # Plantilla para crear especificaciones
│   ├── 03-PLAN-TEMPLATE.md  # Plantilla para planes técnicos
│   ├── 04-TASK-TEMPLATE.md  # Plantilla para desglose de tareas
│   ├── 05-SDD-GUIDE.md      # Guía de Spec-Driven Development
│   ├── 06-WORKFLOW.md        # Flujo de trabajo del proyecto
│   └── 07-CONVENTIONS.md    # Convenciones y estándares
├── specs/                    # Especificaciones del producto (PRDs)
│   └── .gitkeep
├── plans/                    # Planes técnicos de implementación
│   └── .gitkeep
├── tasks/                    # Desglose de tareas
│   └── .gitkeep
├── src/                      # Código fuente
│   └── .gitkeep
├── tests/                    # Tests
│   └── .gitkeep
├── .editorconfig             # Configuración del editor
├── .gitignore                # Archivos ignorados por git
├── CHANGELOG.md              # Registro de cambios
├── LICENSE                   # Licencia del proyecto
└── README.md                 # Este archivo
```

## ⚡ Inicio Rápido

### 1. Lee la constitución del proyecto
```
docs/01-CONSTITUTION.md
```

### 2. Comprende el flujo de trabajo SDD
```
docs/06-WORKFLOW.md
```

### 3. Crea tu primera especificación
Usa la plantilla en `docs/02-SPEC-TEMPLATE.md` y guarda el resultado en `specs/`.

### 4. Genera el plan técnico
Usa la plantilla en `docs/03-PLAN-TEMPLATE.md` y guarda el resultado en `plans/`.

### 5. Desglosa en tareas
Usa la plantilla en `docs/04-TASK-TEMPLATE.md` y guarda el resultado en `tasks/`.

## 📚 Documentación

Toda la documentación se encuentra en la carpeta [`docs/`](./docs/). Comienza por el [Índice Maestro](./docs/00-INDEX.md).

## 🔧 Basado en

Este proyecto utiliza la metodología y estructura de [Spec Kit](https://github.com/github/spec-kit) de GitHub — un toolkit de código abierto para Spec-Driven Development.

## 📄 Licencia

MIT License — ver [LICENSE](./LICENSE) para detalles.
