# FEAT-006: MCP Resources (Agent Documentation)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-006 |
| **Estado** | 🟡 Borrador |
| **Versión** | 1.0.0 |
| **Fecha** | 2026-07-25 |

---

## 🎯 Objetivo

Exponer la documentación técnica del proyecto (carpeta `docs/`) a través del estándar nativo **MCP Resources**. Esto permitirá que cualquier agente AI que se conecte al Hub pueda descubrir y leer las reglas de negocio, los modos de sesión y las instrucciones de uso sin necesidad de tener acceso directo al repositorio de código.

## 👥 Historias de Usuario

1. **Como agente AI**, quiero poder invocar `resources/list` para ver qué manuales y guías están disponibles en el servidor.
2. **Como agente AI**, quiero invocar `resources/read` para aprender cómo funciona el sistema de turnos (`yield_to`) y los modos de sesión, permitiéndome interactuar correctamente.

## 📝 Requisitos Funcionales

1. **ListResourcesRequestSchema**:
   - Escanear la carpeta `docs/` en la raíz del proyecto.
   - Retornar una lista de recursos MCP, donde la URI será `file:///docs/<filename>` y el nombre será el nombre del archivo.
2. **ReadResourceRequestSchema**:
   - Recibir una URI de recurso.
   - Leer el contenido del archivo correspondiente en `docs/` y retornarlo como texto.
   - Validar que no se intente leer fuera de la carpeta `docs/` (Path Traversal Prevention).

## 🚫 Fuera del Alcance
- Exponer carpetas de código fuente (solo se expondrá `docs/`).
