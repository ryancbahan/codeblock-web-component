# CodeBlock Web Component

A lightweight, framework-agnostic web component for displaying code with syntax highlighting, line numbers, copy functionality, and code folding.

**[Live Demo](https://ryancbahan.github.io/codeblock-web-component/)** | [Documentation](#api-reference)

## Features

- **Syntax Highlighting** - Uses CSS Custom Highlight API with Prism.js tokenization
- **Line Numbers** - Optional line number gutter
- **Copy Button** - One-click code copying with visual feedback
- **Code Folding** - Collapse/expand code blocks for C-style languages
- **Editable Mode** - Make code blocks editable with live syntax highlighting
- **Theming** - Multiple themes with full CSS custom property support
- **Lightweight** - ~15kb minified, ~5.8kb gzipped
- **Zero Dependencies** - Prism.js loaded from CDN on demand
- **Framework Agnostic** - Works with any framework or vanilla JS
- **Accessible** - Proper ARIA roles and keyboard support

## Browser Support

Requires browsers that support the [CSS Custom Highlight API](https://caniuse.com/mdn-api_css_highlights):
- Chrome 105+
- Edge 105+
- Safari 17.2+
- Firefox 132+

## Installation

### NPM

```bash
npm install codeblock-web-component
```

```javascript
import { CodeBlock } from 'codeblock-web-component';
import 'codeblock-web-component/themes/themes.css';

// Register the custom element
await CodeBlock.define();
```

### CDN

```html
<link rel="stylesheet" href="https://unpkg.com/codeblock-web-component/dist/themes/themes.css">
<script type="module">
  import { CodeBlock } from 'https://unpkg.com/codeblock-web-component/dist/codeblock.js';
  await CodeBlock.define();
</script>
```

## Quick Start

```html
<code-block language="javascript" line-numbers copy-button>
function greet(name) {
  console.log(`Hello, ${name}!`);
}
</code-block>
```

## Usage Examples

### Basic Syntax Highlighting

```html
<code-block language="python">
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
</code-block>
```

### With Line Numbers and Copy Button

```html
<code-block language="typescript" line-numbers copy-button>
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
</code-block>
```

### Editable Code Block

```html
<code-block language="css" editable copy-button>
.container {
  display: flex;
  gap: 1rem;
  padding: 2rem;
}
</code-block>
```

### Code Folding

Code folding works with C-style languages (JavaScript, TypeScript, CSS, Java, etc.):

```html
<code-block language="javascript" line-numbers foldable copy-button>
class Calculator {
  constructor(value = 0) {
    this.value = value;
  }

  add(n) {
    this.value += n;
    return this;
  }

  subtract(n) {
    this.value -= n;
    return this;
  }
}
</code-block>
```

## API Reference

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `'plaintext'` | Programming language for syntax highlighting |
| `line-numbers` | boolean | `false` | Show line number gutter |
| `copy-button` | boolean | `false` | Show copy-to-clipboard button |
| `editable` | boolean | `false` | Make content editable |
| `foldable` | boolean | `false` | Enable code folding (requires `line-numbers`) |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `language` | `string` | Get/set the programming language |
| `lineNumbers` | `boolean` | Get/set line numbers visibility |
| `copyButton` | `boolean` | Get/set copy button visibility |
| `editable` | `boolean` | Get/set editable mode |
| `foldable` | `boolean` | Get/set code folding |
| `value` | `string` | Get/set the code content |
| `highlights` | `ReadonlySet` | Get current highlight ranges |

### Methods

| Method | Description |
|--------|-------------|
| `copy()` | Copy code to clipboard programmatically |
| `clearTokenHighlights()` | Clear all syntax highlighting |
| `paintTokenHighlights()` | Re-apply syntax highlighting |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `copy` | `{ value: string, success: boolean }` | Fired when code is copied |
| `change` | `{ value: string }` | Fired when content changes (editable mode) |

```javascript
const codeBlock = document.querySelector('code-block');

codeBlock.addEventListener('copy', (e) => {
  console.log('Copied:', e.detail.value);
  console.log('Success:', e.detail.success);
});

codeBlock.addEventListener('change', (e) => {
  console.log('New content:', e.detail.value);
});
```

### Static Configuration

Configure all instances before calling `define()`:

```javascript
import { CodeBlock } from 'codeblock-web-component';

// Preload additional languages
CodeBlock.config = {
  languages: ['markup', 'css', 'javascript', 'typescript', 'python', 'rust'],
};

// Customize icons
CodeBlock.config = {
  icons: {
    copy: '<svg>...</svg>',
    copied: '<svg>...</svg>',
    foldExpanded: '−',
    foldCollapsed: '+',
  },
};

await CodeBlock.define();
```

## Theming

### Built-in Themes

Two themes are included:

- **Prettylights** (default) - GitHub-style syntax colors
- **Prism** - Classic Prism.js theme

Switch themes using the `data-theme` attribute on any parent element:

```html
<!-- Default: Prettylights theme -->
<html>
  <code-block language="javascript">...</code-block>
</html>

<!-- Prism theme -->
<html data-theme="prism">
  <code-block language="javascript">...</code-block>
</html>
```

### CSS Custom Properties

All colors and UI elements can be customized:

#### Syntax Colors

| Property | Description |
|----------|-------------|
| `--cb-bg` | Background color |
| `--cb-fg` | Default text color |
| `--cb-comment` | Comments |
| `--cb-constant` | Constants, attr-name, char, builtin, operator |
| `--cb-entity` | Entity, selector, class-name, function |
| `--cb-entity-tag` | Property, tag, boolean, symbol |
| `--cb-keyword` | Keywords |
| `--cb-string` | Strings, attr-value |
| `--cb-string-regexp` | Regular expressions |
| `--cb-variable` | Variables |
| `--cb-deleted-bg` | Deleted text background |
| `--cb-deleted-text` | Deleted text color |
| `--cb-inserted-bg` | Inserted text background |
| `--cb-inserted-text` | Inserted text color |

#### UI Elements

| Property | Description |
|----------|-------------|
| `--cb-gutter-border` | Line numbers gutter border |
| `--cb-line-number` | Line number text color |
| `--cb-fold-toggle` | Fold toggle icon color |
| `--cb-fold-toggle-hover` | Fold toggle hover color |
| `--cb-copy-bg` | Copy button background |
| `--cb-copy-bg-hover` | Copy button hover background |
| `--cb-copy-color` | Copy button icon color |
| `--cb-copy-color-hover` | Copy button hover icon color |
| `--cb-copy-color-success` | Copy button success color |
| `--cb-caret` | Cursor color in editable mode |
| `--cb-focus-ring` | Focus outline for editable mode |

### Creating a Custom Theme

```css
[data-theme="my-theme"] {
  --cb-bg: #1e1e1e;
  --cb-fg: #d4d4d4;
  --cb-comment: #6a9955;
  --cb-constant: #4fc1ff;
  --cb-entity: #dcdcaa;
  --cb-entity-tag: #569cd6;
  --cb-keyword: #c586c0;
  --cb-string: #ce9178;
  --cb-variable: #9cdcfe;
}

[data-theme="my-theme"] code-block {
  font-family: 'Fira Code', monospace;
  font-size: 13px;
}
```

## Supported Languages

The component supports all [Prism.js languages](https://prismjs.com/#supported-languages). Common languages are loaded automatically. For less common languages, configure them before registration:

```javascript
CodeBlock.config = {
  languages: ['markup', 'css', 'javascript', 'typescript', 'python', 'rust', 'go', 'kotlin'],
};
await CodeBlock.define();
```

### Language Aliases

Common aliases are supported:

| Alias | Language |
|-------|----------|
| `js` | javascript |
| `ts` | typescript |
| `py` | python |
| `rb` | ruby |
| `sh`, `shell` | bash |
| `yml` | yaml |
| `md` | markdown |
| `html`, `xml`, `svg` | markup |
| `cs`, `dotnet` | csharp |

## TypeScript

Full TypeScript support with exported types:

```typescript
import {
  CodeBlock,
  CodeBlockConfig,
  CodeBlockIcons,
  CodeBlockCopyEventDetail,
  CodeBlockChangeEventDetail,
  CodeBlockEventMap,
} from 'codeblock-web-component';

const block = document.querySelector('code-block') as CodeBlock;

block.addEventListener('copy', (e: CustomEvent<CodeBlockCopyEventDetail>) => {
  console.log(e.detail.value);
});
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Build with source maps
npm run build:dev

# Watch mode
npm run watch

# Type check
npm run typecheck

# Run tests
npm test

# Run unit tests only
npm run test:unit

# Run e2e tests only
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui

# Test coverage
npm run test:coverage
```

## Project Structure

```
src/
├── index.ts           # Main CodeBlock web component
├── folding.ts         # Code folding utilities
├── utils.ts           # Highlight API helpers
├── tokenizer/
│   └── prism.ts       # Prism.js tokenization
└── themes/
    └── themes.css     # Theme stylesheets
tests/
└── codeblock.spec.ts  # Playwright e2e tests
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
