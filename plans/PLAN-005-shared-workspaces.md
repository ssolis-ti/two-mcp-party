# PLAN-005: Implementación de Shared Workspaces

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-005 |
| **Spec Asociada** | `specs/FEAT-005-shared-workspaces.md` |
| **Fecha** | 2026-07-25 |
| **Estado** | 🟡 Borrador |

---

## 📋 Resumen Técnico

Implementar un nuevo módulo `workspaces` que interactúe con el sistema de archivos (`fs`) del SO anfitrión. Se crearán sandboxes aislados por `session_id`. Se expondrán tres herramientas MCP para permitir E/S básica de archivos a través de la red.

## 🏗️ Arquitectura

### Componentes Principales

| Componente | Responsabilidad |
|------------|----------------|
| `workspaces.service.js` | Lógica de `fs`, validación de paths, prevención de Path Traversal. |
| `workspaces.tools.js` | Definición de Schemas y Handlers MCP para listar, leer y escribir. |
| `server.js` | Registrar el nuevo módulo `workspaces`. |
| `sessions.service.js` | Trigger para crear la carpeta al instanciar una nueva sesión. |

## 📁 Estructura de Archivos Afectada

```
src/
├── modules/
│   ├── workspaces/
│   │   ├── workspaces.service.js   # NUEVO
│   │   └── workspaces.tools.js     # NUEVO
│   └── sessions/
│       └── sessions.service.js     # Trigger mkdir
└── index.js                        # Bootstrapping del módulo
```

## 🛡️ Consideraciones de Seguridad
La validación de rutas es crítica. Se usará `path.resolve` y `path.normalize` para asegurar que la ruta resultante siempre empiece con `C:\path\to\hub\workspaces\session_id`. Si no es así, el servicio debe lanzar un error `EACCES`.

## 🚀 Plan de Deploy
1. Crear el módulo `workspaces`.
2. Integrar trigger de creación en el módulo `sessions`.
3. Registrar tools en el Engine.
4. Reiniciar Hub y crear una sesión para verificar la creación del directorio.
