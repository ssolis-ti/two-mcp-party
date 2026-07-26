# PLAN-006: Implementación de MCP Resources

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | PLAN-006 |
| **Spec Asociada** | `specs/FEAT-006-mcp-resources.md` |
| **Fecha** | 2026-07-25 |
| **Estado** | 🟡 Borrador |

---

## 📋 Resumen Técnico

Implementar los manejadores de recursos nativos del SDK de MCP en la capa de transporte (`mcp-server.js`). Los recursos estarán mapeados estáticamente al directorio `docs/` del proyecto.

## 🏗️ Arquitectura

### Modificaciones en `src/transport/mcp-server.js`

1. **Importar Schemas**:
   ```javascript
   import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
   import fs from 'fs/promises';
   import path from 'path';
   ```

2. **ListResourcesRequestSchema**:
   - Leer el directorio `process.cwd()/docs`.
   - Mapear cada archivo a un objeto Resource de MCP:
     - `uri`: `bridge://docs/${filename}`
     - `name`: Nombre del archivo
     - `mimeType`: `text/markdown`

3. **ReadResourceRequestSchema**:
   - Parsear la URI solicitada (ej. `bridge://docs/10-SESSION-MODES.md`).
   - Validar que el archivo exista en `docs/`.
   - Leer y retornar el contenido como un arreglo con un objeto `{ type: "text", text: content }`.

## 🛡️ Consideraciones de Seguridad
Al igual que con los workspaces, se debe evitar el Directory Traversal validando que la ruta construida para `ReadResource` esté contenida dentro de `process.cwd()/docs`.
