# 🔧 Plantilla de Plan Técnico

> Usa esta plantilla para crear planes técnicos de implementación.
> Guarda el resultado en `plans/PLAN-NNN-nombre-descriptivo.md`
> Cada plan DEBE referenciar una spec aprobada.

---

# PLAN-NNN: [Título del Plan]

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-NNN |
| **Spec Asociada** | `specs/FEAT-NNN-nombre.md` |
| **Autor** | [Nombre] |
| **Fecha** | YYYY-MM-DD |
| **Estado** | 🟡 Borrador / 🟢 Aprobado / 🔵 En Ejecución / ✅ Completado |

---

## 📋 Resumen Técnico

> Descripción de CÓMO se implementará la spec. Resumen de la arquitectura y decisiones técnicas principales.

## 🏗️ Arquitectura

### Diagrama de Alto Nivel

```
[Describir o dibujar la arquitectura con texto/ASCII/Mermaid]
```

### Componentes Principales

| Componente | Responsabilidad | Tecnología |
|------------|----------------|------------|
| [Componente 1] | [Qué hace] | [Tech stack] |
| [Componente 2] | [Qué hace] | [Tech stack] |

## 🔧 Stack Tecnológico

| Categoría | Tecnología | Versión | Justificación |
|-----------|------------|---------|---------------|
| Frontend | [Ej: HTML/CSS/JS] | [versión] | [Por qué] |
| Backend | [Ej: Node.js] | [versión] | [Por qué] |
| Base de datos | [Ej: SQLite] | [versión] | [Por qué] |
| Testing | [Ej: Vitest] | [versión] | [Por qué] |

## 📁 Estructura de Archivos Propuesta

```
src/
├── [directorio/]
│   ├── [archivo.ext]     # [Descripción]
│   └── [archivo.ext]     # [Descripción]
└── [directorio/]
    └── [archivo.ext]     # [Descripción]
```

## 🔄 Flujo de Datos

> Describir cómo fluyen los datos a través del sistema.

1. [Paso 1: entrada de datos]
2. [Paso 2: procesamiento]
3. [Paso 3: salida/renderizado]

## 📐 Decisiones Técnicas

### Decisión 1: [Título]
- **Contexto**: [Situación que requiere decisión]
- **Opciones evaluadas**: [Opción A], [Opción B], [Opción C]
- **Decisión**: [Opción elegida]
- **Justificación**: [Por qué esta opción]
- **Consecuencias**: [Implicaciones de la decisión]

### Decisión 2: [Título]
- **Contexto**: [Situación]
- **Decisión**: [Qué se decidió]
- **Justificación**: [Por qué]

## 🔌 APIs & Interfaces

### [Nombre de API/Interfaz]

```
[Definir endpoints, métodos, parámetros, respuestas]
```

## 🧪 Estrategia de Testing

| Tipo | Herramienta | Cobertura Objetivo |
|------|-------------|--------------------|
| Unit Tests | [Tool] | [%] |
| Integration | [Tool] | [%] |
| E2E | [Tool] | [%] |

## ⚡ Performance

| Métrica | Objetivo |
|---------|----------|
| Tiempo de carga inicial | < [X]s |
| Interacción a respuesta | < [X]ms |
| Tamaño del bundle | < [X]KB |

## 🛡️ Seguridad

- [ ] [Consideración de seguridad 1]
- [ ] [Consideración de seguridad 2]

## 🚀 Plan de Deploy

> Describir cómo se desplegará esta funcionalidad.

## ⚠️ Riesgos & Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| [Riesgo 1] | Alta/Media/Baja | Alto/Medio/Bajo | [Plan B] |

---

> **Recordatorio**: Este plan debe ser aprobado antes de crear las tareas de implementación.
