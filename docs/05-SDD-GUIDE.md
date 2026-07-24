# 🌱 Guía de Spec-Driven Development (SDD)

> Esta guía explica la metodología SDD que gobierna este proyecto.
> Basada en [Spec Kit](https://github.com/github/spec-kit) de GitHub.

---

## ¿Qué es SDD?

**Spec-Driven Development** invierte la relación tradicional entre código y especificaciones:

| Desarrollo Tradicional | Spec-Driven Development |
|------------------------|------------------------|
| Código es la fuente de verdad | **Specs son la fuente de verdad** |
| Specs sirven al código | **Código sirve a las specs** |
| Mantener = evolucionar código | **Mantener = evolucionar specs** |
| Debuggear = corregir código | **Debuggear = corregir specs** |
| Docs se desactualizan | **Docs generan implementación** |

---

## La Inversión de Poder

Por décadas, el código ha sido rey. Las especificaciones eran andamios que construíamos y descartábamos una vez que el "trabajo real" de programar comenzaba.

SDD cambia esto: **las especificaciones se vuelven ejecutables**, generando directamente implementaciones funcionales en lugar de solo guiarlas.

### El Gap Especificación ↔ Implementación

```
TRADICIONAL:
  Spec ----[gap]----> Código ----[gap]----> Tests
  (se desactualiza)          (se desvía)

SDD:
  Spec ====> Plan ====> Tareas ====> Código + Tests
  (fuente de verdad, trazabilidad total)
```

---

## Las 6 Fases de SDD

### 📜 Fase 1: Constitución
Establece los principios gobernantes del proyecto. Estos son inamovibles y guían todas las decisiones posteriores.

**Artefacto**: `docs/01-CONSTITUTION.md`

### 📝 Fase 2: Especificación (PRD)
Define QUÉ construir y POR QUÉ. Enfocarse en el problema del usuario, no en la tecnología.

**Artefacto**: `specs/FEAT-NNN-*.md`
**Template**: `docs/02-SPEC-TEMPLATE.md`

### 🔧 Fase 3: Plan Técnico
Define CÓMO construir. Stack tecnológico, arquitectura, decisiones técnicas con justificación.

**Artefacto**: `plans/PLAN-NNN-*.md`
**Template**: `docs/03-PLAN-TEMPLATE.md`

### 📋 Fase 4: Desglose de Tareas
Convierte el plan en tareas ejecutables con estimaciones, dependencias y criterios de completitud.

**Artefacto**: `tasks/TASK-NNN-*.md`
**Template**: `docs/04-TASK-TEMPLATE.md`

### 🚀 Fase 5: Implementación
Ejecuta las tareas según el plan. El código generado debe ser trazable a la spec original.

**Artefacto**: Código en `src/` y tests en `tests/`

### ✅ Fase 6: Validación
Verifica que la implementación cumple con la spec. Actualiza documentación.

**Artefacto**: Tests pasando, CHANGELOG actualizado

---

## Principios Clave de SDD

### 1. Especificaciones como Lingua Franca
La spec se convierte en el artefacto primario. El código es su expresión en un lenguaje particular.

### 2. Especificaciones Ejecutables
Las specs deben ser lo suficientemente precisas, completas y no ambiguas para generar sistemas funcionales.

### 3. Refinamiento Continuo
La validación de consistencia ocurre continuamente, no como un gate único.

### 4. Contexto por Investigación
Los agentes de investigación recopilan contexto crítico a lo largo del proceso de especificación.

### 5. Feedback Bidireccional
La realidad de producción informa la evolución de las especificaciones.

### 6. Branching para Exploración
Se pueden generar múltiples enfoques de implementación desde la misma spec para explorar diferentes optimizaciones.

---

## ¿Por qué SDD Ahora?

1. **AI puede implementar specs complejas** → El gap spec-código se puede eliminar
2. **La complejidad del software crece** → Necesitamos alineación sistemática
3. **El cambio se acelera** → Los pivots deben ser regeneraciones, no reescrituras manuales

---

## Referencia

- [Spec Kit por GitHub](https://github.com/github/spec-kit)
- [Spec-Driven Development (artículo original)](https://github.com/github/spec-kit/blob/main/spec-driven.md)
