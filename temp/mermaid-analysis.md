# MarkText Mermaid Implementation Analysis

This document analyzes the current Mermaid implementation in the MarkText codebase.

## 1. Current Mermaid Version

**Version: 10.6.1** (upgraded from earlier version in commit cd845297)

- Package.json specifies: `"mermaid": "^10.0.0"`
- Installed version: 10.6.1
- Upgrade happened in March 2024 with mindmap support added

## 2. Files that Import or Use Mermaid

### Core Renderer Files
- `/src/muya/lib/renderers/index.js` - Dynamic import of mermaid core module
- `/src/muya/lib/parser/render/index.js` - Main rendering logic and caching
- `/src/muya/lib/parser/render/renderBlock/renderLeafBlock.js` - Leaf block rendering
- `/src/muya/lib/parser/render/renderBlock/renderContainerBlock.js` - Container block rendering

### Configuration Files
- `/src/muya/lib/config/index.js` - Default configuration including theme settings
- `/src/muya/lib/ui/quickInsert/config.js` - Quick insert menu configuration

### Export/Import Files
- `/src/muya/lib/utils/exportMarkdown.js` - Markdown export functionality
- `/src/muya/lib/utils/exportHtml.js` - HTML export functionality
- `/src/muya/lib/utils/importMarkdown.js` - Markdown import functionality

### Content State Files
- `/src/muya/lib/contentState/containerCtrl.js` - Container creation and control
- `/src/muya/lib/contentState/copyCutCtrl.js` - Copy/cut operations
- `/src/muya/lib/contentState/backspaceCtrl.js` - Backspace handling
- `/src/muya/lib/contentState/paragraphCtrl.js` - Paragraph control

### UI and Styling Files
- `/src/muya/lib/assets/styles/index.css` - CSS styling for mermaid blocks
- `/src/muya/lib/assets/icons/mermaid.svg` - Mermaid icon
- `/src/renderer/assets/styles/printService.css` - Print styling

## 3. Mermaid Initialization and Configuration

### Dynamic Loading
The mermaid library is loaded dynamically in `/src/muya/lib/renderers/index.js`:
```javascript
case 'mermaid':
  m = await import('mermaid/dist/mermaid.core.mjs')
  rendererCache.set(name, m.default)
  break
```

### Initialization Settings
In `/src/muya/lib/parser/render/index.js`:
```javascript
mermaid.initialize({
  securityLevel: 'strict',
  theme: this.muya.options.mermaidTheme
})
```

### Configuration Options
From `/src/muya/lib/config/index.js`:
- Default theme: `'default'`
- Available themes: `'dark'`, `'forest'`, `'default'`
- Security level: `'strict'`

## 4. Custom Themes and Configurations

### Default Configuration
```javascript
mermaidTheme: 'default', // dark / forest / default
```

### CSS Classes
- `.ag-mermaid` - Main mermaid container class
- `.ag-container-preview` - Preview container
- `.ag-container-block` - Container block styling
- `.ag-math-error` - Error state styling

### Block Identification
- Function type: `'mermaid'`
- Language type: `'yaml'` (for syntax highlighting)
- Data role: `'mermaid'`

## 5. Rendering Pipeline

### 1. Block Recognition
Mermaid blocks are recognized as container blocks with `functionType: 'mermaid'`

### 2. Caching System
- `mermaidCache` Map stores code and metadata by block key
- Cache is cleared after each render cycle
- Format: `{ code, functionType }`

### 3. Rendering Process
1. **Initial Render**: Shows "Loading..." placeholder
2. **Cache Population**: Code stored in mermaidCache with `#${block.key}` as key
3. **Async Rendering**: `renderMermaid()` processes all cached items
4. **DOM Update**: Mermaid diagrams replace placeholders
5. **Error Handling**: Invalid code shows "< Invalid Mermaid Codes >"

### 4. Rendering Methods
- `render()` - Full page render
- `partialRender()` - Partial updates
- `singleRender()` - Single block render

All methods call `renderMermaid()` after DOM updates.

### 5. Security Measures
- DOMPurify sanitization with `PREVIEW_DOMPURIFY_CONFIG`
- Strict security level in mermaid initialization
- Code parsing validation before rendering

## 6. Test Files

**No dedicated Mermaid test files found** in the current codebase.

Test directories checked:
- `/test/unit/specs/` - No mermaid-specific tests
- `/test/e2e/` - No mermaid-specific tests
- `/test/specs/` - No mermaid-specific tests

## 7. Integration Points

### Quick Insert Menu
Mermaid is available in the diagram section of the quick insert menu:
```javascript
{
  title: 'Mermaid',
  subTitle: 'Render Diagram by mermaid.',
  label: 'mermaid',
  icon: mermaidIcon
}
```

### Export/Import Support
- Markdown export: Handled as fenced code block with `mermaid` language
- HTML export: Diagrams are rendered and included
- Import: Recognizes `mermaid` code blocks

### Print Support
Print CSS includes specific styling for mermaid diagrams.

## 8. Recent Changes

**March 2024 Upgrade (commit cd845297)**:
- Upgraded from older version to Mermaid 10
- Added mindmap support
- Changed import from `'mermaid'` to `'mermaid/dist/mermaid.core.mjs'`

## 9. Architecture Notes

- Uses lazy loading pattern for performance
- Implements caching system to avoid re-rendering unchanged diagrams
- Separates parsing/validation from rendering
- Integrates with the broader block rendering system
- Supports theming through configuration options