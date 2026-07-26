# 📚 Índice Maestro de Documentación

> Punto de entrada a toda la documentación del proyecto Two.

---

## 🗺️ Mapa de Documentación

| # | Documento | Propósito | Cuándo Usarlo |
|---|-----------|-----------|---------------|
| 01 | [Constitución](./01-CONSTITUTION.md) | Principios gobernantes | Al inicio, y para validar decisiones |
| 02 | [Plantilla de Spec](./02-SPEC-TEMPLATE.md) | Crear especificaciones (PRD) | Al definir QUÉ construir |
| 03 | [Plantilla de Plan](./03-PLAN-TEMPLATE.md) | Crear planes técnicos | Al definir CÓMO construir |
| 04 | [Plantilla de Tareas](./04-TASK-TEMPLATE.md) | Desglosar en tareas | Al planificar el trabajo |
| 05 | [Guía SDD](./05-SDD-GUIDE.md) | Entender la metodología | Para aprender SDD |
| 06 | [Flujo de Trabajo](./06-WORKFLOW.md) | Proceso paso a paso | Referencia diaria |
| 07 | [Convenciones](./07-CONVENTIONS.md) | Estándares y reglas | Al escribir código/docs |
| 09 | [Modelo de Conexión](./09-CONNECTION-MODEL.md) | Explicación Arquitectura MCP | Para entender el flujo cliente-servidor |
| 10 | [Modos de Sesión](./10-SESSION-MODES.md) | Configuración de MCP Hub | Para usar Autopilot o Free mode |
| 11 | [Loop Engineering](./11-LOOP-ENGINEERING.md) | Documentación de Handshake y Anti-Loop | Manual para agentes clientes |

---

## 🚀 ¿Por dónde empiezo?

### Si es tu primera vez:
1. Lee la [Guía SDD](./05-SDD-GUIDE.md) para entender la metodología
2. Revisa la [Constitución](./01-CONSTITUTION.md) para los principios
3. Estudia el [Flujo de Trabajo](./06-WORKFLOW.md)

### Si vas a crear una nueva funcionalidad:
1. Crea una spec usando la [Plantilla de Spec](./02-SPEC-TEMPLATE.md)
2. Crea un plan técnico con la [Plantilla de Plan](./03-PLAN-TEMPLATE.md)
3. Desglosa las tareas con la [Plantilla de Tareas](./04-TASK-TEMPLATE.md)

### Si necesitas una referencia rápida:
- [Convenciones](./07-CONVENTIONS.md) para naming, formato, y estándares

---

## 📁 Dónde vive cada cosa

```
docs/           ← Estás aquí — Documentación y templates
specs/          ← Especificaciones de producto (PRDs)
plans/          ← Planes técnicos de implementación
tasks/          ← Listas de tareas ejecutables
src/            ← Código fuente
tests/          ← Tests
```
