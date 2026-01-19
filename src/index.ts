import { setup, tokenize, tokenTypes, resolveLanguage, type FlatToken } from './tokenizer/prism';
import { setupTokenHighlights, isHighlightApiSupported, type LanguageTokens } from './utils';
import {
  detectFoldRegions,
  createFoldState,
  toggleFoldRegion,
  isRegionCollapsed,
  getRegionAtLine,
  transformContent,
  isFoldableLanguage,
  type FoldState,
} from './folding';

// ============================================
// Constants
// ============================================

/** Duration in ms to show the "copied" state before reverting */
const COPY_FEEDBACK_DURATION_MS = 2000;

/** Default language when none specified */
const DEFAULT_LANGUAGE = 'plaintext';

/** CSS class names */
const CSS_CLASSES = {
  foldGutter: 'fold-gutter',
  foldToggle: 'fold-toggle',
  lineNumbersGutter: 'line-numbers-gutter',
  codeContent: 'code-content',
  copyButton: 'copy-button',
  copied: 'copied',
} as const;

/** Attribute names */
const ATTRIBUTES = {
  language: 'language',
  lineNumbers: 'line-numbers',
  copyButton: 'copy-button',
  editable: 'editable',
  foldable: 'foldable',
  ready: 'ready',
  tabindex: 'tabindex',
  ariaHidden: 'aria-hidden',
  ariaLabel: 'aria-label',
  contenteditable: 'contenteditable',
  spellcheck: 'spellcheck',
  autocorrect: 'autocorrect',
  autocapitalize: 'autocapitalize',
} as const;

/** CSS custom property names */
const CSS_PROPERTIES = {
  lineNumberDigits: '--line-number-digits',
} as const;

// ============================================
// Type Definitions
// ============================================

/** Icons configuration for the code block */
export interface CodeBlockIcons {
  /** Icon shown on copy button (HTML string) */
  readonly copy: string;
  /** Icon shown after successful copy (HTML string) */
  readonly copied: string;
  /** Icon for expanded fold region */
  readonly foldExpanded: string;
  /** Icon for collapsed fold region */
  readonly foldCollapsed: string;
}

/** Global configuration for all CodeBlock instances */
export interface CodeBlockConfig {
  /** Languages to preload for syntax highlighting */
  readonly languages: readonly string[];
  /** Token types for CSS Highlight API */
  readonly tokenTypes: readonly string[];
  /** Language-specific token overrides */
  readonly languageTokens: LanguageTokens;
  /** Customizable icons */
  readonly icons: CodeBlockIcons;
}

/** Event detail for the 'copy' event */
export interface CodeBlockCopyEventDetail {
  /** The code content that was copied */
  readonly value: string;
  /** Whether the copy operation succeeded */
  readonly success: boolean;
}

/** Event detail for the 'change' event */
export interface CodeBlockChangeEventDetail {
  /** The current code content */
  readonly value: string;
}

/** Map of custom events emitted by CodeBlock */
export interface CodeBlockEventMap {
  'copy': CustomEvent<CodeBlockCopyEventDetail>;
  'change': CustomEvent<CodeBlockChangeEventDetail>;
}

/** Internal structure for tracking highlight ranges */
interface StoredHighlight {
  readonly tokenType: string;
  readonly range: Range;
}

// ============================================
// Default Icons
// ============================================

const DEFAULT_COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const DEFAULT_COPIED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

const DEFAULT_ICONS: CodeBlockIcons = Object.freeze({
  copy: DEFAULT_COPY_ICON,
  copied: DEFAULT_COPIED_ICON,
  foldExpanded: '\u25BC', // ▼
  foldCollapsed: '\u25B6', // ▶
});

// ============================================
// Default Config
// ============================================

const DEFAULT_CONFIG: CodeBlockConfig = Object.freeze({
  languages: Object.freeze(['markup', 'css', 'javascript', 'typescript']),
  tokenTypes: Object.freeze(tokenTypes),
  languageTokens: Object.freeze({}),
  icons: DEFAULT_ICONS,
});

// ============================================
// CodeBlock Web Component
// ============================================

/**
 * A web component for displaying code with syntax highlighting.
 *
 * @example
 * ```html
 * <code-block language="javascript" line-numbers copy-button>
 * function hello() {
 *   console.log('Hello, world!');
 * }
 * </code-block>
 * ```
 *
 * @fires copy - When code is copied to clipboard
 * @fires change - When code content changes (in editable mode)
 */
export class CodeBlock extends HTMLElement {
  // ----------------------------------------
  // Static Members
  // ----------------------------------------

  static readonly observedAttributes = [
    ATTRIBUTES.language,
    ATTRIBUTES.lineNumbers,
    ATTRIBUTES.copyButton,
    ATTRIBUTES.editable,
    ATTRIBUTES.foldable,
  ] as const;

  static #config: CodeBlockConfig = { ...DEFAULT_CONFIG, icons: { ...DEFAULT_ICONS } };
  static #initialized = false;

  /** Get the current global configuration */
  static get config(): CodeBlockConfig {
    return CodeBlock.#config;
  }

  /** Set global configuration (merged with existing config) */
  static set config(value: Partial<CodeBlockConfig>) {
    CodeBlock.#config = {
      ...CodeBlock.#config,
      ...value,
      icons: { ...CodeBlock.#config.icons, ...value.icons },
    };
  }

  /**
   * Define and register the custom element.
   *
   * @param tagName - The tag name to register (default: 'code-block')
   * @param registry - The custom elements registry to use
   * @returns The CodeBlock class if registration succeeded, undefined otherwise
   */
  static async define(
    tagName = 'code-block',
    registry: CustomElementRegistry = customElements
  ): Promise<typeof CodeBlock | undefined> {
    if (!isHighlightApiSupported()) {
      console.info('The CSS Custom Highlight API is not supported in this browser.');
      return;
    }

    if (registry.get(tagName)) {
      return;
    }

    await setup([...CodeBlock.#config.languages]);
    setupTokenHighlights([...CodeBlock.#config.tokenTypes], {
      languageTokens: CodeBlock.#config.languageTokens,
    });
    CodeBlock.#initialized = true;
    registry.define(tagName, CodeBlock);
    return CodeBlock;
  }

  // ----------------------------------------
  // Instance Members
  // ----------------------------------------

  readonly #highlights = new Set<StoredHighlight>();
  readonly #internals: ElementInternals;

  #codeElement: HTMLElement | null = null;
  #gutterElement: HTMLElement | null = null;
  #copyButtonElement: HTMLButtonElement | null = null;
  #foldGutterElement: HTMLElement | null = null;
  #originalContent: string | null = null;
  #copyTimeout: ReturnType<typeof setTimeout> | null = null;
  #inputRAF: number | null = null;
  #foldState: FoldState | null = null;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = 'code';
  }

  // ----------------------------------------
  // Public Properties
  // ----------------------------------------

  /** The programming language for syntax highlighting */
  get language(): string {
    return this.getAttribute(ATTRIBUTES.language) ?? DEFAULT_LANGUAGE;
  }

  set language(value: string) {
    this.setAttribute(ATTRIBUTES.language, value);
  }

  /** Whether to show line numbers */
  get lineNumbers(): boolean {
    return this.hasAttribute(ATTRIBUTES.lineNumbers);
  }

  set lineNumbers(value: boolean) {
    this.toggleAttribute(ATTRIBUTES.lineNumbers, value);
  }

  /** Whether to show the copy button */
  get copyButton(): boolean {
    return this.hasAttribute(ATTRIBUTES.copyButton);
  }

  set copyButton(value: boolean) {
    this.toggleAttribute(ATTRIBUTES.copyButton, value);
  }

  /** Whether the code is editable */
  get editable(): boolean {
    return this.hasAttribute(ATTRIBUTES.editable);
  }

  set editable(value: boolean) {
    this.toggleAttribute(ATTRIBUTES.editable, value);
  }

  /** Whether code folding is enabled */
  get foldable(): boolean {
    return this.hasAttribute(ATTRIBUTES.foldable);
  }

  set foldable(value: boolean) {
    this.toggleAttribute(ATTRIBUTES.foldable, value);
  }

  /** Get the current code content (always returns full, unfolded content) */
  get value(): string {
    return this.#originalContent ?? '';
  }

  /** Set the code content */
  set value(content: string) {
    this.#originalContent = content;
    this.#foldState = null;
    this.clearTokenHighlights();
    this.#setupStructure();
    this.paintTokenHighlights();
  }

  /** Get the current highlight ranges (readonly) */
  get highlights(): ReadonlySet<StoredHighlight> {
    return this.#highlights;
  }

  // ----------------------------------------
  // Private Getters
  // ----------------------------------------

  get #contentElement(): HTMLElement {
    return this.#codeElement ?? this;
  }

  get #textNode(): Text | null {
    const firstChild = this.#contentElement.firstChild;
    return firstChild?.nodeType === Node.TEXT_NODE ? (firstChild as Text) : null;
  }

  // ----------------------------------------
  // Lifecycle Callbacks
  // ----------------------------------------

  connectedCallback(): void {
    if (!this.hasAttribute(ATTRIBUTES.tabindex)) {
      this.setAttribute(ATTRIBUTES.tabindex, '0');
    }

    // Store original content before any DOM manipulation
    this.#originalContent ??= this.textContent ?? '';

    if (CodeBlock.#initialized) {
      this.#setupStructure();
      this.paintTokenHighlights();
    } else {
      this.#initAndPaint();
    }
  }

  disconnectedCallback(): void {
    this.clearTokenHighlights();
    this.#clearCopyTimeout();
    this.#clearInputRAF();
    this.#contentElement.removeEventListener('input', this.#handleInput);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    // Don't process changes until we've captured the original content
    // (attributeChangedCallback fires BEFORE connectedCallback during upgrade)
    if (this.#originalContent === null) return;

    if (!CodeBlock.#initialized) return;

    switch (name) {
      case ATTRIBUTES.language:
        this.#loadLanguageAndRepaint(newValue ?? DEFAULT_LANGUAGE);
        break;
      case ATTRIBUTES.lineNumbers:
      case ATTRIBUTES.foldable:
        this.clearTokenHighlights();
        this.#setupStructure();
        this.paintTokenHighlights();
        break;
      case ATTRIBUTES.copyButton:
        this.#updateCopyButton();
        break;
      case ATTRIBUTES.editable:
        this.#updateEditable();
        break;
    }
  }

  // ----------------------------------------
  // Public Methods
  // ----------------------------------------

  /**
   * Repaint syntax highlighting.
   * Call this after programmatically modifying content.
   */
  update(): void {
    this.paintTokenHighlights();
  }

  /**
   * Copy the code content to clipboard programmatically.
   * Dispatches a 'copy' event with success status.
   */
  async copy(): Promise<void> {
    await this.#handleCopy();
  }

  /**
   * Paint token highlights using the CSS Custom Highlight API.
   * This is called automatically but can be invoked manually if needed.
   */
  paintTokenHighlights(): void {
    const resolvedLanguage = resolveLanguage(this.language);
    const text = this.#contentElement.textContent ?? '';
    const tokens: FlatToken[] = tokenize(text, resolvedLanguage);
    const languageTokenTypes = CodeBlock.#config.languageTokens[resolvedLanguage] ?? [];

    const textNode = this.#textNode;
    if (!textNode) {
      this.setAttribute(ATTRIBUTES.ready, '');
      return;
    }

    // Store old highlights to clear after painting new ones (prevents FOUC)
    const oldHighlights = new Set(this.#highlights);
    this.#highlights.clear();

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
          // Range may be invalid if content changed during painting
        }
      }
      pos += token.length;
    }

    // Clear old highlights after new ones are painted
    for (const highlight of oldHighlights) {
      CSS.highlights?.get(highlight.tokenType)?.delete(highlight.range);
    }

    this.setAttribute(ATTRIBUTES.ready, '');
  }

  /**
   * Clear all token highlights from this element.
   */
  clearTokenHighlights(): void {
    for (const highlight of this.#highlights) {
      CSS.highlights?.get(highlight.tokenType)?.delete(highlight.range);
    }
    this.#highlights.clear();
  }

  // ----------------------------------------
  // Event Listener Overloads (Type Safety)
  // ----------------------------------------

  addEventListener<K extends keyof CodeBlockEventMap>(
    type: K,
    listener: (this: CodeBlock, ev: CodeBlockEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof CodeBlockEventMap>(
    type: K,
    listener: (this: CodeBlock, ev: CodeBlockEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener, options);
  }

  // ----------------------------------------
  // Private Methods: Initialization
  // ----------------------------------------

  async #initAndPaint(): Promise<void> {
    await CodeBlock.define();
    this.#setupStructure();
    this.paintTokenHighlights();
  }

  async #loadLanguageAndRepaint(language: string): Promise<void> {
    const resolvedLang = resolveLanguage(language);
    if (resolvedLang !== DEFAULT_LANGUAGE) {
      await setup([resolvedLang]);
    }
    this.update();
  }

  // ----------------------------------------
  // Private Methods: Structure Management
  // ----------------------------------------

  #setupStructure(): void {
    const content = this.#originalContent ?? '';
    const resolvedLanguage = resolveLanguage(this.language);

    // Initialize fold state if foldable and language supports it
    const shouldFold = this.foldable && !this.editable && isFoldableLanguage(resolvedLanguage);
    if (shouldFold && !this.#foldState) {
      const tokens = tokenize(content, resolvedLanguage);
      const regions = detectFoldRegions(content, tokens);
      this.#foldState = createFoldState(regions);
    } else if (!shouldFold) {
      this.#foldState = null;
    }

    // Get transformed content and line mapping for display
    const { transformedCode, lineMapping } = this.#foldState
      ? transformContent(content, this.#foldState)
      : { transformedCode: content, lineMapping: content.split('\n').map((_, i) => i) };

    const originalLineCount = content.split('\n').length;

    if (this.lineNumbers) {
      this.#setupLineNumbersStructure(transformedCode, shouldFold, originalLineCount);
    } else {
      this.#setupSimpleStructure(transformedCode);
    }

    // Reset copy button reference since we cleared innerHTML
    this.#copyButtonElement = null;
    this.#updateCopyButton();
    this.#updateEditable();
  }

  #setupLineNumbersStructure(transformedCode: string, shouldFold: boolean, originalLineCount: number): void {
    this.innerHTML = '';

    // Add fold gutter if foldable
    if (shouldFold && this.#foldState && this.#foldState.regions.length > 0) {
      this.#foldGutterElement = document.createElement('div');
      this.#foldGutterElement.className = CSS_CLASSES.foldGutter;
      this.#foldGutterElement.setAttribute(ATTRIBUTES.ariaHidden, 'true');
      this.appendChild(this.#foldGutterElement);
      this.#updateFoldGutter();
    } else {
      this.#foldGutterElement = null;
    }

    this.#gutterElement = document.createElement('div');
    this.#gutterElement.className = CSS_CLASSES.lineNumbersGutter;
    this.#gutterElement.setAttribute(ATTRIBUTES.ariaHidden, 'true');

    this.#codeElement = document.createElement('code');
    this.#codeElement.className = CSS_CLASSES.codeContent;
    this.#codeElement.textContent = transformedCode;

    this.appendChild(this.#gutterElement);
    this.appendChild(this.#codeElement);

    this.#updateLineNumbers();

    const digits = String(originalLineCount).length;
    this.style.setProperty(CSS_PROPERTIES.lineNumberDigits, String(digits));
  }

  #setupSimpleStructure(transformedCode: string): void {
    this.innerHTML = '';
    this.textContent = transformedCode;
    this.#codeElement = null;
    this.#gutterElement = null;
    this.#foldGutterElement = null;
    this.style.removeProperty(CSS_PROPERTIES.lineNumberDigits);
  }

  // ----------------------------------------
  // Private Methods: Line Numbers
  // ----------------------------------------

  #updateLineNumbers(): void {
    if (!this.#gutterElement) return;

    const content = this.#originalContent ?? '';

    if (this.#foldState) {
      const { lineMapping } = transformContent(content, this.#foldState);
      const visibleLineNumbers = lineMapping
        .map((mapped, i) => (mapped !== null ? i + 1 : null))
        .filter((n): n is number => n !== null);

      this.#gutterElement.innerHTML = visibleLineNumbers
        .map(n => `<span>${n}</span>`)
        .join('');
    } else {
      const lineCount = content.split('\n').length;
      this.#gutterElement.innerHTML = Array.from(
        { length: lineCount },
        (_, i) => `<span>${i + 1}</span>`
      ).join('');
    }
  }

  // ----------------------------------------
  // Private Methods: Code Folding
  // ----------------------------------------

  #updateFoldGutter(): void {
    if (!this.#foldGutterElement || !this.#foldState) return;

    const content = this.#originalContent ?? '';
    const { lineMapping } = transformContent(content, this.#foldState);
    const { foldExpanded, foldCollapsed } = CodeBlock.#config.icons;

    // Build fold gutter content - one span per visible line
    const items: string[] = [];
    for (let origLine = 0; origLine < lineMapping.length; origLine++) {
      if (lineMapping[origLine] === null) continue;

      const regionInfo = getRegionAtLine(this.#foldState, origLine);
      if (regionInfo) {
        const isCollapsed = isRegionCollapsed(this.#foldState, regionInfo.index);
        const icon = isCollapsed ? foldCollapsed : foldExpanded;
        const title = isCollapsed ? 'Expand' : 'Collapse';
        items.push(
          `<span class="${CSS_CLASSES.foldToggle}" data-region="${regionInfo.index}" title="${title}">${icon}</span>`
        );
      } else {
        // Empty line - use nbsp to maintain line height
        items.push(`<span class="${CSS_CLASSES.foldToggle}">\u00A0</span>`);
      }
    }

    this.#foldGutterElement.innerHTML = items.join('');

    // Add click handlers
    const toggles = this.#foldGutterElement.querySelectorAll(`.${CSS_CLASSES.foldToggle}[data-region]`);
    toggles.forEach(el => el.addEventListener('click', this.#handleFoldToggle));
  }

  #handleFoldToggle = (e: Event): void => {
    const target = e.target as HTMLElement;
    const regionIndexStr = target.dataset.region;
    if (!regionIndexStr || !this.#foldState) return;

    const regionIndex = parseInt(regionIndexStr, 10);
    if (Number.isNaN(regionIndex)) return;

    this.#foldState = toggleFoldRegion(this.#foldState, regionIndex);
    this.#applyFoldState();
  };

  #applyFoldState(): void {
    if (!this.#foldState) return;

    const content = this.#originalContent ?? '';
    const { transformedCode } = transformContent(content, this.#foldState);

    this.#contentElement.textContent = transformedCode;
    this.#updateLineNumbers();
    this.#updateFoldGutter();
    this.paintTokenHighlights();
  }

  // ----------------------------------------
  // Private Methods: Copy Button
  // ----------------------------------------

  #updateCopyButton(): void {
    if (this.copyButton) {
      if (!this.#copyButtonElement) {
        this.#copyButtonElement = document.createElement('button');
        this.#copyButtonElement.type = 'button';
        this.#copyButtonElement.className = CSS_CLASSES.copyButton;
        this.#copyButtonElement.setAttribute(ATTRIBUTES.ariaLabel, 'Copy code');
        this.#copyButtonElement.innerHTML = CodeBlock.#config.icons.copy;
        this.#copyButtonElement.addEventListener('click', this.#handleCopy);
        this.appendChild(this.#copyButtonElement);
      }
    } else if (this.#copyButtonElement) {
      this.#copyButtonElement.removeEventListener('click', this.#handleCopy);
      this.#copyButtonElement.remove();
      this.#copyButtonElement = null;
    }
  }

  #handleCopy = async (): Promise<void> => {
    const content = this.#originalContent ?? '';
    let success = false;

    try {
      await navigator.clipboard.writeText(content);
      success = true;
      this.#showCopiedState();
    } catch {
      success = this.#fallbackCopy(content);
    }

    this.#dispatchCopyEvent(content, success);
  };

  #fallbackCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    textarea.select();

    let success = false;
    try {
      document.execCommand('copy');
      success = true;
      this.#showCopiedState();
    } catch {
      console.error('CodeBlock: Failed to copy code');
    }

    document.body.removeChild(textarea);
    return success;
  }

  #showCopiedState(): void {
    if (!this.#copyButtonElement) return;

    const { copy, copied } = CodeBlock.#config.icons;
    this.#copyButtonElement.innerHTML = copied;
    this.#copyButtonElement.classList.add(CSS_CLASSES.copied);
    this.#copyButtonElement.setAttribute(ATTRIBUTES.ariaLabel, 'Copied!');

    this.#clearCopyTimeout();

    this.#copyTimeout = setTimeout(() => {
      if (this.#copyButtonElement) {
        this.#copyButtonElement.innerHTML = copy;
        this.#copyButtonElement.classList.remove(CSS_CLASSES.copied);
        this.#copyButtonElement.setAttribute(ATTRIBUTES.ariaLabel, 'Copy code');
      }
    }, COPY_FEEDBACK_DURATION_MS);
  }

  #clearCopyTimeout(): void {
    if (this.#copyTimeout) {
      clearTimeout(this.#copyTimeout);
      this.#copyTimeout = null;
    }
  }

  // ----------------------------------------
  // Private Methods: Editable Mode
  // ----------------------------------------

  #updateEditable(): void {
    const contentEl = this.#contentElement;

    if (this.editable) {
      contentEl.setAttribute(ATTRIBUTES.contenteditable, 'plaintext-only');
      contentEl.setAttribute(ATTRIBUTES.spellcheck, 'false');
      contentEl.setAttribute(ATTRIBUTES.autocorrect, 'off');
      contentEl.setAttribute(ATTRIBUTES.autocapitalize, 'off');
      contentEl.addEventListener('input', this.#handleInput);
    } else {
      contentEl.removeAttribute(ATTRIBUTES.contenteditable);
      contentEl.removeAttribute(ATTRIBUTES.spellcheck);
      contentEl.removeAttribute(ATTRIBUTES.autocorrect);
      contentEl.removeAttribute(ATTRIBUTES.autocapitalize);
      contentEl.removeEventListener('input', this.#handleInput);
    }
  }

  #handleInput = (): void => {
    this.#clearInputRAF();
    this.#inputRAF = requestAnimationFrame(() => {
      this.#onContentChange();
    });
  };

  #clearInputRAF(): void {
    if (this.#inputRAF) {
      cancelAnimationFrame(this.#inputRAF);
      this.#inputRAF = null;
    }
  }

  #onContentChange(): void {
    const contentEl = this.#contentElement;

    // Merge text nodes - pressing Enter creates multiple text nodes,
    // but CSS Highlight API needs a single text node for ranges
    contentEl.normalize();

    this.#originalContent = contentEl.textContent ?? '';

    if (this.lineNumbers && this.#gutterElement) {
      const lineCount = this.#originalContent.split('\n').length;
      this.#gutterElement.innerHTML = Array.from(
        { length: lineCount },
        (_, i) => `<span>${i + 1}</span>`
      ).join('');
      this.style.setProperty(CSS_PROPERTIES.lineNumberDigits, String(String(lineCount).length));
    }

    this.update();
    this.#dispatchChangeEvent(this.#originalContent);
  }

  // ----------------------------------------
  // Private Methods: Event Dispatching
  // ----------------------------------------

  #dispatchCopyEvent(value: string, success: boolean): void {
    this.dispatchEvent(
      new CustomEvent<CodeBlockCopyEventDetail>('copy', {
        bubbles: true,
        detail: { value, success },
      })
    );
  }

  #dispatchChangeEvent(value: string): void {
    this.dispatchEvent(
      new CustomEvent<CodeBlockChangeEventDetail>('change', {
        bubbles: true,
        detail: { value },
      })
    );
  }
}

// ============================================
// Auto-Registration
// ============================================

if (typeof customElements !== 'undefined') {
  CodeBlock.define();
}

// ============================================
// Exports
// ============================================

export { tokenTypes } from './tokenizer/prism';
export { isHighlightApiSupported } from './utils';
export type { FoldRegion, FoldState } from './folding';
export type { LanguageTokens } from './utils';
