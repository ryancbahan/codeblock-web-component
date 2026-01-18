import { setup, tokenize, tokenTypes, resolveLanguage, type FlatToken } from './tokenizer/prism';
import { setupTokenHighlights, isHighlightApiSupported, type LanguageTokens } from './utils';

export interface CodeBlockConfig {
  languages: string[];
  tokenTypes: string[];
  languageTokens: LanguageTokens;
}

interface StoredHighlight {
  tokenType: string;
  range: Range;
}

const defaultConfig: CodeBlockConfig = {
  languages: ['markup', 'css', 'javascript', 'typescript'],
  tokenTypes,
  languageTokens: {},
};

// Default copy icon (clipboard)
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

// Checkmark icon (shown after copy)
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

export class CodeBlock extends HTMLElement {
  static observedAttributes = ['language', 'line-numbers', 'copy-button'];

  static #config: CodeBlockConfig = { ...defaultConfig };
  static #initialized = false;

  static get config(): CodeBlockConfig {
    return CodeBlock.#config;
  }

  static set config(value: Partial<CodeBlockConfig>) {
    CodeBlock.#config = { ...CodeBlock.#config, ...value };
  }

  static async define(
    tagName = 'code-block',
    registry = customElements
  ): Promise<typeof CodeBlock | undefined> {
    if (!isHighlightApiSupported()) {
      console.info('The CSS Custom Highlight API is not supported in this browser.');
      return;
    }

    if (!registry.get(tagName)) {
      await setup(CodeBlock.#config.languages);
      setupTokenHighlights(CodeBlock.#config.tokenTypes, {
        languageTokens: CodeBlock.#config.languageTokens,
      });
      CodeBlock.#initialized = true;
      registry.define(tagName, CodeBlock);
      return CodeBlock;
    }
  }

  #highlights = new Set<StoredHighlight>();
  #internals: ElementInternals;
  #codeElement: HTMLElement | null = null;
  #gutterElement: HTMLElement | null = null;
  #copyButtonElement: HTMLButtonElement | null = null;
  #originalContent: string | null = null;
  #copyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = 'code';
  }

  get language(): string {
    return this.getAttribute('language') || 'plaintext';
  }

  set language(value: string) {
    this.setAttribute('language', value);
  }

  get lineNumbers(): boolean {
    return this.hasAttribute('line-numbers');
  }

  set lineNumbers(value: boolean) {
    if (value) {
      this.setAttribute('line-numbers', '');
    } else {
      this.removeAttribute('line-numbers');
    }
  }

  get copyButton(): boolean {
    return this.hasAttribute('copy-button');
  }

  set copyButton(value: boolean) {
    if (value) {
      this.setAttribute('copy-button', '');
    } else {
      this.removeAttribute('copy-button');
    }
  }

  get highlights(): Set<StoredHighlight> {
    return this.#highlights;
  }

  get #contentElement(): HTMLElement {
    return this.#codeElement || this;
  }

  get #textNode(): Text | null {
    const content = this.#contentElement;
    const firstChild = content.firstChild;
    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
      return firstChild as Text;
    }
    return null;
  }

  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }

    // Store original content before any DOM manipulation
    if (this.#originalContent === null) {
      this.#originalContent = this.textContent || '';
    }

    if (CodeBlock.#initialized) {
      this.#setupStructure();
      this.paintTokenHighlights();
    } else {
      this.#initAndPaint();
    }
  }

  disconnectedCallback(): void {
    this.clearTokenHighlights();
    if (this.#copyTimeout) {
      clearTimeout(this.#copyTimeout);
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    // Don't process changes until we've captured the original content
    // (attributeChangedCallback fires BEFORE connectedCallback during upgrade)
    if (this.#originalContent === null) return;

    if (name === 'language' && CodeBlock.#initialized) {
      this.#loadLanguageAndRepaint(newValue || 'plaintext');
    } else if (name === 'line-numbers' && CodeBlock.#initialized) {
      this.clearTokenHighlights();
      this.#setupStructure();
      this.paintTokenHighlights();
    } else if (name === 'copy-button' && CodeBlock.#initialized) {
      this.#updateCopyButton();
    }
  }

  async #initAndPaint(): Promise<void> {
    await CodeBlock.define();
    this.#setupStructure();
    this.paintTokenHighlights();
  }

  async #loadLanguageAndRepaint(language: string): Promise<void> {
    const resolvedLang = resolveLanguage(language);
    if (resolvedLang !== 'plaintext') {
      await setup([resolvedLang]);
    }
    this.update();
  }

  #setupStructure(): void {
    const content = this.#originalContent || '';
    const lineCount = content.split('\n').length;

    if (this.lineNumbers) {
      // Create structure: <gutter> + <code>
      if (!this.#codeElement) {
        this.innerHTML = '';

        this.#gutterElement = document.createElement('div');
        this.#gutterElement.className = 'line-numbers-gutter';
        this.#gutterElement.setAttribute('aria-hidden', 'true');

        this.#codeElement = document.createElement('code');
        this.#codeElement.className = 'code-content';
        this.#codeElement.textContent = content;

        this.appendChild(this.#gutterElement);
        this.appendChild(this.#codeElement);
      }

      // Update line numbers
      this.#gutterElement!.innerHTML = Array.from(
        { length: lineCount },
        (_, i) => `<span>${i + 1}</span>`
      ).join('');

      // Set CSS custom property for gutter width calculation
      const digits = String(lineCount).length;
      this.style.setProperty('--line-number-digits', String(digits));
    } else {
      // Simple structure: just text content
      if (this.#codeElement) {
        this.innerHTML = '';
        this.textContent = content;
        this.#codeElement = null;
        this.#gutterElement = null;
        this.style.removeProperty('--line-number-digits');
      }
    }

    // Reset copy button reference since we cleared innerHTML
    this.#copyButtonElement = null;
    this.#updateCopyButton();
  }

  #updateCopyButton(): void {
    if (this.copyButton) {
      if (!this.#copyButtonElement) {
        this.#copyButtonElement = document.createElement('button');
        this.#copyButtonElement.type = 'button';
        this.#copyButtonElement.className = 'copy-button';
        this.#copyButtonElement.setAttribute('aria-label', 'Copy code');
        this.#copyButtonElement.innerHTML = COPY_ICON;
        this.#copyButtonElement.addEventListener('click', this.#handleCopy);
        this.appendChild(this.#copyButtonElement);
      }
    } else {
      if (this.#copyButtonElement) {
        this.#copyButtonElement.removeEventListener('click', this.#handleCopy);
        this.#copyButtonElement.remove();
        this.#copyButtonElement = null;
      }
    }
  }

  #handleCopy = async (): Promise<void> => {
    const content = this.#originalContent || '';

    try {
      await navigator.clipboard.writeText(content);
      this.#showCopiedState();
    } catch (err) {
      // Fallback for older browsers or insecure contexts
      this.#fallbackCopy(content);
    }
  };

  #fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      this.#showCopiedState();
    } catch {
      console.error('Failed to copy code');
    }
    document.body.removeChild(textarea);
  }

  #showCopiedState(): void {
    if (!this.#copyButtonElement) return;

    this.#copyButtonElement.innerHTML = CHECK_ICON;
    this.#copyButtonElement.classList.add('copied');
    this.#copyButtonElement.setAttribute('aria-label', 'Copied!');

    if (this.#copyTimeout) {
      clearTimeout(this.#copyTimeout);
    }

    this.#copyTimeout = setTimeout(() => {
      if (this.#copyButtonElement) {
        this.#copyButtonElement.innerHTML = COPY_ICON;
        this.#copyButtonElement.classList.remove('copied');
        this.#copyButtonElement.setAttribute('aria-label', 'Copy code');
      }
    }, 2000);
  }

  paintTokenHighlights(): void {
    const resolvedLanguage = resolveLanguage(this.language);
    const text = this.#contentElement.textContent || '';
    const tokens: FlatToken[] = tokenize(text, resolvedLanguage) || [];
    const languageTokenTypes = CodeBlock.#config.languageTokens?.[resolvedLanguage] || [];

    const textNode = this.#textNode;
    if (!textNode) {
      this.setAttribute('ready', '');
      return;
    }

    let pos = 0;
    for (const token of tokens) {
      if (token.type) {
        const tokenType = languageTokenTypes.includes(token.type)
          ? `${resolvedLanguage}-${token.type}`
          : token.type;

        try {
          const range = new Range();
          range.setStart(textNode, pos);
          range.setEnd(textNode, pos + token.length);

          CSS.highlights?.get(tokenType)?.add(range);
          this.#highlights.add({ tokenType, range });
        } catch {
          // Range may be invalid if content changed
        }
      }
      pos += token.length;
    }

    // Mark as ready to reveal the element
    this.setAttribute('ready', '');
  }

  clearTokenHighlights(): void {
    for (const highlight of this.#highlights) {
      CSS.highlights?.get(highlight.tokenType)?.delete(highlight.range);
      this.#highlights.delete(highlight);
    }
  }

  update(): void {
    this.clearTokenHighlights();
    this.paintTokenHighlights();
  }

  /** Copy the code content to clipboard programmatically */
  async copy(): Promise<void> {
    await this.#handleCopy();
  }
}

// Auto-register if custom elements are available
if (typeof customElements !== 'undefined') {
  CodeBlock.define();
}

export { tokenTypes } from './tokenizer/prism';
export { isHighlightApiSupported } from './utils';
