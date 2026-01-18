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

export class CodeBlock extends HTMLElement {
  static observedAttributes = ['language'];

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

  get highlights(): Set<StoredHighlight> {
    return this.#highlights;
  }

  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }

    if (CodeBlock.#initialized) {
      this.paintTokenHighlights();
    } else {
      this.#initAndPaint();
    }
  }

  disconnectedCallback(): void {
    this.clearTokenHighlights();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'language' && oldValue !== newValue && CodeBlock.#initialized) {
      this.#loadLanguageAndRepaint(newValue || 'plaintext');
    }
  }

  async #initAndPaint(): Promise<void> {
    await CodeBlock.define();
    this.paintTokenHighlights();
  }

  async #loadLanguageAndRepaint(language: string): Promise<void> {
    const resolvedLang = resolveLanguage(language);
    if (resolvedLang !== 'plaintext') {
      await setup([resolvedLang]);
    }
    this.update();
  }

  paintTokenHighlights(): void {
    const resolvedLanguage = resolveLanguage(this.language);
    const text = this.textContent || '';
    const tokens: FlatToken[] = tokenize(text, resolvedLanguage) || [];
    const languageTokenTypes = CodeBlock.#config.languageTokens?.[resolvedLanguage] || [];

    const firstChild = this.firstChild;
    if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) {
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
          range.setStart(firstChild, pos);
          range.setEnd(firstChild, pos + token.length);

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
}

// Auto-register if custom elements are available
if (typeof customElements !== 'undefined') {
  CodeBlock.define();
}

export { tokenTypes } from './tokenizer/prism';
export { isHighlightApiSupported } from './utils';
