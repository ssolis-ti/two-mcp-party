# 🔄 Flujo de Trabajo del Proyecto

> Referencia rápida del proceso paso a paso para trabajar en este proyecto.

---

## 🗺️ Diagrama del Flujo

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   💡 IDEA                                               │
│    │                                                    │
│    ▼                                                    │
│   📜 CONSTITUCIÓN  ◄── ¿Primera vez? Definir principios │
│    │                                                    │
│    ▼                                                    │
│   📝 ESPECIFICACIÓN (PRD)                               │
│    │  ¿QUÉ construir? ¿POR QUÉ?                       │
│    │  → specs/FEAT-NNN-*.md                            │
│    │                                                    │
│    ▼                                                    │
│   🔧 PLAN TÉCNICO                                       │
│    │  ¿CÓMO construir?                                  │
│    │  → plans/PLAN-NNN-*.md                            │
│    │                                                    │
│    ▼                                                    │
│   📋 TAREAS                                             │
│    │  Desglose ejecutable                               │
│    │  → tasks/TASK-NNN-*.md                            │
│    │                                                    │
│    ▼                                                    │
│   🚀 IMPLEMENTACIÓN                                     │
│    │  Código + Tests                                    │
│    │  → src/ + tests/                                  │
│    │                                                    │
│    ▼                                                    │
│   ✅ VALIDACIÓN                                         │
│    │  Tests pasan, spec cumplida                        │
│    │  → CHANGELOG.md actualizado                       │
│    │                                                    │
│    ▼                                                    │
│   🔄 FEEDBACK → Actualizar specs si es necesario        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Checklist por Fase

### 💡 Nueva Idea / Funcionalidad

- [ ] ¿La idea se alinea con la constitución del proyecto?
- [ ] ¿Existe ya una spec similar? Revisar `specs/`
- [ ] ¿Se consultó con el equipo/stakeholder?

### 📝 Crear Especificación

- [ ] Copiar template de `docs/02-SPEC-TEMPLATE.md`
- [ ] Guardar como `specs/FEAT-NNN-nombre.md`
- [ ] Completar: resumen, objetivos, user stories, criterios de aceptación
- [ ] Definir qué está FUERA de alcance
- [ ] Marcar estado como 🟡 Borrador
- [ ] Solicitar aprobación → Marcar como 🟢 Aprobada

### 🔧 Crear Plan Técnico

- [ ] Verificar que la spec está 🟢 Aprobada
- [ ] Copiar template de `docs/03-PLAN-TEMPLATE.md`
- [ ] Guardar como `plans/PLAN-NNN-nombre.md`
- [ ] Definir: arquitectura, stack, decisiones técnicas
- [ ] Documentar justificación de cada decisión
- [ ] Solicitar aprobación

### 📋 Crear Tareas

- [ ] Verificar que el plan está aprobado
- [ ] Copiar template de `docs/04-TASK-TEMPLATE.md`
- [ ] Guardar como `tasks/TASK-NNN-nombre.md`
- [ ] Desglosar en fases con dependencias
- [ ] Estimar horas por tarea
- [ ] Definir criterios de completitud

### 🚀 Implementar

- [ ] Verificar que las tareas están definidas
- [ ] Seguir el orden de fases/dependencias
- [ ] Marcar tareas como ✅ al completarlas
- [ ] Escribir tests junto con el código
- [ ] Actualizar progreso en el archivo de tareas

### ✅ Validar & Cerrar

- [ ] Todos los tests pasan
- [ ] Todos los criterios de aceptación cumplidos
- [ ] CHANGELOG.md actualizado
- [ ] README.md actualizado si es necesario
- [ ] Spec marcada como ✅ Completada

---

## 🚨 Reglas de Oro

1. **Nunca codificar sin spec** → Siempre crear la spec primero
2. **Nunca implementar sin plan** → La arquitectura se decide antes
3. **Nunca mergear sin tests** → La calidad es un requisito
4. **Siempre actualizar el CHANGELOG** → La historia del proyecto importa
5. **Specs evolucionan** → Si cambia la implementación, actualizar la spec
