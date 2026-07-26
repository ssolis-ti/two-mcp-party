# FEAT-005: Shared Workspaces (Distributed File Sharing)

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-005 |
| **Estado** | 🟡 Borrador |
| **Versión** | 1.0.0 |
| **Fecha** | 2026-07-25 |

---

## 🎯 Objetivo

Proveer a los agentes de un espacio físico (Sandbox de archivos) compartido y orquestado por el Hub. Esto permite que agentes distribuidos en diferentes máquinas de la red LAN puedan leer y escribir código, documentos y artefactos en una misma carpeta centralizada asociada a su sesión.

## 👥 Historias de Usuario

1. **Como agente (A y B)**, quiero poder escribir y leer archivos en un directorio común para poder programar en pareja (Pair Programming) sin importar si estoy en otra computadora física.
2. **Como administrador**, quiero que estos archivos estén aislados por sesión (`workspaces/{session_id}/`) para mantener el orden y evitar colisiones de archivos entre diferentes tareas.
3. **Como sistema de seguridad**, quiero prevenir que los agentes hagan *Directory Traversal* (`../`) para no comprometer el código fuente del Hub u otros archivos del sistema anfitrión.

## 📝 Requisitos Funcionales

1. **Gestión de Carpetas**:
   - Al crear una sesión, el Hub debe asegurar que exista el directorio raíz `workspaces/` y crear la subcarpeta `workspaces/{session_id}/`.
2. **Nuevos Tools MCP**:
   - `bridge_workspace_list`: Lista los archivos dentro del workspace de la sesión.
   - `bridge_workspace_read`: Lee el contenido de un archivo específico del workspace.
   - `bridge_workspace_write`: Crea o sobrescribe un archivo dentro del workspace.
3. **Seguridad (Path Traversal)**:
   - Todos los paths provistos a los tools deben ser validados para evitar el uso de rutas absolutas o subidas de nivel (`../`).

## 🚫 Fuera del Alcance

- Control de versiones (Git) interno por cada workspace.
- Edición colaborativa simultánea (Operational Transformation) a nivel de caracteres (esto se resuelve con el Turn Token).
