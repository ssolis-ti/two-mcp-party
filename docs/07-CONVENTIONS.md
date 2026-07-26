# 📏 Convenciones y Estándares

> Reglas de estilo, naming, formato y estándares que aplican a todo el proyecto.

---

## 📁 Naming de Archivos

### Artefactos SDD

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Especificación | `FEAT-NNN-nombre-descriptivo.md` | `FEAT-001-sistema-autenticacion.md` |
| Plan Técnico | `PLAN-NNN-nombre-descriptivo.md` | `PLAN-001-auth-jwt-strategy.md` |
| Tareas | `TASK-NNN-nombre-descriptivo.md` | `TASK-001-implementar-auth.md` |

### Código Fuente

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Archivos JS/TS | camelCase | `userService.js` |
| Componentes | PascalCase | `UserProfile.jsx` |
| Archivos CSS | kebab-case | `user-profile.css` |
| Archivos de test | `*.test.js` o `*.spec.js` | `userService.test.js` |
| Utilidades | camelCase | `formatDate.js` |
| Constantes | SCREAMING_SNAKE_CASE (dentro del archivo) | `MAX_RETRIES = 3` |

---

## ✍️ Estilo de Código

### JavaScript / TypeScript
- **Indentación**: 2 espacios
- **Strings**: Comillas simples `'texto'`
- **Punto y coma**: Siempre
- **Funciones**: Preferir arrow functions para callbacks
- **Variables**: `const` por defecto, `let` si necesita reasignarse, nunca `var`
- **Exports**: Named exports preferidos sobre default exports

### CSS
- **Indentación**: 2 espacios
- **Naming**: BEM o kebab-case para clases
- **Variables**: CSS custom properties (`--color-primary`)
- **Unidades**: `rem` para tipografía, `px` para borders/shadows
- **Orden de propiedades**: Positioning → Box model → Typography → Visual → Misc

### HTML
- **Indentación**: 2 espacios
- **Atributos**: Dobles comillas `"valor"`
- **Semántica**: Usar elementos semánticos (`header`, `main`, `nav`, `section`, `article`)
- **IDs**: Únicos y descriptivos para elementos interactivos

---

## 📝 Commits

### Formato

```
tipo(alcance): descripción breve

[cuerpo opcional — explicar el POR QUÉ, no el QUÉ]

[footer opcional — refs, breaking changes]
```

### Tipos de Commit

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Cambios en documentación |
| `style` | Formato, punto y coma, etc. (no cambia lógica) |
| `refactor` | Reestructuración sin cambiar funcionalidad |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento (deps, configs) |
| `spec` | Cambios en especificaciones, planes o tareas |

### Ejemplos

```
feat(auth): agregar login con email y contraseña
fix(ui): corregir overflow en tarjetas móviles
spec(prd): crear spec para sistema de notificaciones
docs(readme): actualizar instrucciones de instalación
```

---

## 📄 Documentación

### En Código
- Funciones públicas: JSDoc o docstring obligatorio
- Lógica compleja: Comentario explicando el POR QUÉ
- TODO/FIXME: Incluir referencia a spec o issue `// TODO(FEAT-001): implementar cache`

### En Markdown
- Títulos: Un solo `#` por documento
- Listas: Guiones `-` (no asteriscos)
- Código inline: Backticks `` `variable` ``
- Bloques de código: Triple backtick con lenguaje especificado
- Links internos: Rutas relativas `./docs/archivo.md`

---

## 🌿 Git Branching

### Estrategia

| Branch | Propósito |
|--------|-----------|
| `main` | Producción — siempre estable |
| `develop` | Integración — donde se mergean features |
| `feat/FEAT-NNN-nombre` | Feature branches |
| `fix/descripcion` | Hotfixes |
| `spec/FEAT-NNN-nombre` | Cambios en specs |

### Flujo

```
main ◄── develop ◄── feat/FEAT-001-nombre
                 ◄── feat/FEAT-002-nombre
                 ◄── spec/FEAT-003-nombre
```

---

## 🔢 Versionamiento

Este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/):

```
MAJOR.MINOR.PATCH

MAJOR → Cambios incompatibles con versiones anteriores
MINOR → Nueva funcionalidad compatible hacia atrás
PATCH → Correcciones de bugs compatibles hacia atrás
```

### Pre-release
- Alpha: `0.1.0-alpha.1`
- Beta: `0.1.0-beta.1`
- RC: `0.1.0-rc.1`
