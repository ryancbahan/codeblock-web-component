export class CodeBlock extends HTMLElement {
  static observedAttributes = ['language'];

  private _code: string = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(_name: string, _oldValue: string, _newValue: string) {
    this.render();
  }

  get language(): string {
    return this.getAttribute('language') || '';
  }

  set language(value: string) {
    this.setAttribute('language', value);
  }

  get code(): string {
    return this._code || this.textContent || '';
  }

  set code(value: string) {
    this._code = value;
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    const language = this.language;
    const code = this.code;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        pre {
          margin: 0;
          padding: 1rem;
          background: #1e1e1e;
          border-radius: 4px;
          overflow-x: auto;
        }
        code {
          font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
          font-size: 14px;
          line-height: 1.5;
          color: #d4d4d4;
        }
        .language-label {
          font-size: 12px;
          color: #888;
          margin-bottom: 0.5rem;
        }
      </style>
      ${language ? `<div class="language-label">${language}</div>` : ''}
      <pre><code>${this.escapeHtml(code)}</code></pre>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('code-block', CodeBlock);
