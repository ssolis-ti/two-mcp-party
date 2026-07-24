# Project Two — Agent Instructions

> Este archivo define las reglas de comportamiento para cualquier agente AI que trabaje en este proyecto.
> Basado en la metodología Spec-Driven Development (SDD) de [Spec Kit](https://github.com/github/spec-kit).

---

## 🎯 Filosofía Central

Este proyecto sigue **Spec-Driven Development (SDD)**. Las especificaciones son el artefacto principal.
El código es una expresión de las especificaciones en un lenguaje y framework particular.

### Principios Inquebrantables

1. **Specs primero, código después**: Nunca implementar sin una especificación aprobada
2. **Trazabilidad total**: Cada decisión técnica debe rastrear hacia un requisito específico
3. **Refinamiento continuo**: Las specs se validan continuamente, no como gate único
4. **Feedback bidireccional**: La realidad de producción informa la evolución de las specs

---

## 📋 Flujo de Trabajo Obligatorio

### Antes de codificar CUALQUIER funcionalidad:

1. **Verificar** que existe una especificación en `specs/`
2. **Verificar** que existe un plan técnico en `plans/`
3. **Verificar** que existen tareas en `tasks/`
4. Si falta alguno, **crear** el artefacto correspondiente usando las plantillas en `docs/`

### Al modificar código existente:

1. **Verificar** el impacto en las especificaciones existentes
2. **Actualizar** las specs afectadas ANTES de modificar el código
3. **Documentar** el cambio en `CHANGELOG.md`

---

## 🏗️ Estructura de Archivos

| Directorio | Propósito |
|---|---|
| `docs/` | Documentación del proyecto, plantillas, guías |
| `specs/` | Especificaciones del producto (PRDs) |
| `plans/` | Planes técnicos de implementación |
| `tasks/` | Desglose de tareas ejecutables |
| `src/` | Código fuente de la aplicación |
| `tests/` | Tests unitarios, integración, e2e |

---

## 🔧 Convenciones de Código

### General
- Usar indentación de **2 espacios** para HTML/CSS/JS/TS
- Usar indentación de **4 espacios** para Python
- Archivos en **UTF-8** con line endings **LF**
- Siempre insertar newline final

### Naming
- Archivos de specs: `specs/FEAT-NNN-nombre-descriptivo.md`
- Archivos de planes: `plans/PLAN-NNN-nombre-descriptivo.md`
- Archivos de tareas: `tasks/TASK-NNN-nombre-descriptivo.md`

### Commits
- Formato: `tipo(alcance): descripción`
- Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `spec`
- Usar `spec` para cambios en especificaciones/planes/tareas

### Documentación
- Todo comentario y docstring relevante debe preservarse
- Nuevas funciones públicas requieren documentación
- Los cambios de API requieren actualización de specs

---

## 🚫 Restricciones

- **NO** implementar funcionalidad sin spec aprobada
- **NO** modificar la estructura de carpetas raíz sin discusión
- **NO** agregar dependencias sin justificación documentada en el plan técnico
- **NO** ignorar tests fallidos — corregir spec o código
- **NO** hacer commits directos a main sin review

---

## 📝 Templates de Referencia

Los templates para crear nuevos artefactos SDD están en:
- `docs/02-SPEC-TEMPLATE.md` — Para especificaciones de producto
- `docs/03-PLAN-TEMPLATE.md` — Para planes técnicos
- `docs/04-TASK-TEMPLATE.md` — Para desglose de tareas
