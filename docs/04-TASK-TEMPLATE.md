# 📋 Plantilla de Desglose de Tareas

> Usa esta plantilla para desglosar un plan técnico en tareas ejecutables.
> Guarda el resultado en `tasks/TASK-NNN-nombre-descriptivo.md`
> Cada lista de tareas DEBE referenciar un plan técnico aprobado.

---

# TASK-NNN: [Título del Desglose]

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | TASK-NNN |
| **Plan Asociado** | `plans/PLAN-NNN-nombre.md` |
| **Spec Asociada** | `specs/FEAT-NNN-nombre.md` |
| **Fecha** | YYYY-MM-DD |
| **Estado General** | ⏳ Pendiente / 🔵 En Progreso / ✅ Completado |
| **Progreso** | 0/N tareas completadas |

---

## 📊 Resumen de Progreso

```
[████░░░░░░] 40% completado (4/10 tareas)
```

---

## 🔖 Fase 1: [Nombre de la Fase]

> [Breve descripción del objetivo de esta fase]

### Tareas

- [ ] **T-001**: [Descripción de la tarea]
  - Estimación: [X]h
  - Archivos: `[archivo(s) a crear/modificar]`
  - Dependencias: ninguna
  - Criterio de completitud: [Cuándo está "hecha"]

- [ ] **T-002**: [Descripción de la tarea]
  - Estimación: [X]h
  - Archivos: `[archivo(s)]`
  - Dependencias: T-001
  - Criterio de completitud: [Cuándo está "hecha"]

- [ ] **T-003**: [Descripción de la tarea]
  - Estimación: [X]h
  - Archivos: `[archivo(s)]`
  - Dependencias: T-001
  - Criterio de completitud: [Cuándo está "hecha"]

---

## 🔖 Fase 2: [Nombre de la Fase]

> [Breve descripción]

### Tareas

- [ ] **T-004**: [Descripción]
  - Estimación: [X]h
  - Archivos: `[archivo(s)]`
  - Dependencias: Fase 1 completada
  - Criterio de completitud: [Cuándo está "hecha"]

- [ ] **T-005**: [Descripción]
  - Estimación: [X]h
  - Archivos: `[archivo(s)]`
  - Dependencias: T-004
  - Criterio de completitud: [Cuándo está "hecha"]

---

## 🔖 Fase 3: Testing & Validación

> Verificar que todo funciona según la spec.

### Tareas

- [ ] **T-00N**: Escribir tests unitarios
  - Archivos: `tests/`
  - Criterio: Cobertura >= 80%

- [ ] **T-00N+1**: Verificar criterios de aceptación de la spec
  - Referencia: `specs/FEAT-NNN-nombre.md`
  - Criterio: Todos los criterios de aceptación marcados como ✅

- [ ] **T-00N+2**: Actualizar documentación
  - Archivos: `README.md`, `CHANGELOG.md`
  - Criterio: Documentación refleja el estado actual

---

## 📈 Estimación Total

| Fase | Tareas | Horas Estimadas |
|------|--------|-----------------|
| Fase 1 | N | Xh |
| Fase 2 | N | Xh |
| Fase 3 | N | Xh |
| **Total** | **N** | **Xh** |

---

## 📝 Notas de Implementación

> Notas que surjan durante la implementación. Actualizar este documento conforme avanza el trabajo.

| Fecha | Nota |
|-------|------|
| YYYY-MM-DD | [Observación o decisión tomada durante implementación] |

---

> **Recordatorio**: Marcar tareas como completadas conforme se avanza. Actualizar el progreso general.
