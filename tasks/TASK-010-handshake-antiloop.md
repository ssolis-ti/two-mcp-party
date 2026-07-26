# TASK-010: Handshake V2 y Anti-Looping Inteligente

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | TASK-010 |
| **Plan Asociado** | `plans/PLAN-010-handshake-antiloop.md` |
| **Spec Asociada** | `specs/FEAT-010-handshake-antiloop.md` |
| **Fecha** | 2026-07-26 |
| **Estado General** | 🔵 En Progreso |
| **Progreso** | 1/6 tareas completadas |

---

## 📊 Resumen de Progreso

```
[██░░░░░░░░] 16% completado (1/6 tareas)
```

---

## 🔖 Fase 1: Arquitectura Base

> Crear archivos y schemas necesarios.

### Tareas

- [x] **T-001**: Escribir documentos SDD (FEAT, PLAN, TASK)
  - Archivos: `specs/`, `plans/`, `tasks/`

- [ ] **T-002**: Actualizar esquema de base de datos
  - Archivos: `src/modules/sessions/sessions.schema.sql`
  - Dependencias: T-001
  - Criterio de completitud: Tabla `loop_events` agregada.

---

## 🔖 Fase 2: Lógica de Backend

> Implementar servicios.

### Tareas

- [ ] **T-003**: Implementar `loop.service.js`
  - Archivos: `src/modules/messaging/loop.service.js`
  - Criterio de completitud: El Map de RAM detecta repeticiones.

- [ ] **T-004**: Refactorizar `messaging.service.js`
  - Archivos: `src/modules/messaging/messaging.service.js`
  - Dependencias: T-003
  - Criterio de completitud: Usa `loop.service.js` en lugar del chequeo antiguo de DB.

- [ ] **T-005**: Implementar Handshake V2
  - Archivos: `src/modules/sessions/sessions.service.js`
  - Criterio de completitud: Emite evento system en `joinSession` al llegar al 2do participante.

---

## 🔖 Fase 3: Testing & Validación

### Tareas

- [ ] **T-006**: Probar Handshake V2 y Anti-looping
  - Archivos: Local Server
  - Criterio de completitud: Verificar que el servidor inyecta SYSTEM en caso de loop.

---

## 📝 Notas de Implementación

| Fecha | Nota |
|-------|------|
| 2026-07-26 | Arquitectura aprobada. SDD creado. |

---
