import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTokenHighlights, isHighlightApiSupported } from './utils';

// ============================================
// isHighlightApiSupported
// ============================================

describe('isHighlightApiSupported', () => {
  const originalCSS = globalThis.CSS;

  afterEach(() => {
    // Restore original CSS
    if (originalCSS) {
      (globalThis as unknown as { CSS: typeof CSS }).CSS = originalCSS;
    } else {
      delete (globalThis as unknown as { CSS?: typeof CSS }).CSS;
    }
  });

  it('returns false when CSS is undefined', () => {
    delete (globalThis as unknown as { CSS?: typeof CSS }).CSS;

    expect(isHighlightApiSupported()).toBe(false);
  });

  it('returns false when CSS.highlights is not available', () => {
    (globalThis as unknown as { CSS: object }).CSS = {};

    expect(isHighlightApiSupported()).toBe(false);
  });

  it('returns true when CSS.highlights is available', () => {
    (globalThis as unknown as { CSS: { highlights: object } }).CSS = {
      highlights: new Map(),
    };

    expect(isHighlightApiSupported()).toBe(true);
  });
});

// ============================================
// setupTokenHighlights
// ============================================

describe('setupTokenHighlights', () => {
  let mockHighlights: Map<string, unknown>;

  beforeEach(() => {
    mockHighlights = new Map();
    (globalThis as unknown as { CSS: { highlights: Map<string, unknown> } }).CSS = {
      highlights: mockHighlights,
    };
    // Mock Highlight constructor
    (globalThis as unknown as { Highlight: new () => object }).Highlight = class {
      constructor() {
        return {};
      }
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { CSS?: object }).CSS;
    delete (globalThis as unknown as { Highlight?: unknown }).Highlight;
  });

  it('creates highlights for provided token types', () => {
    setupTokenHighlights(['comment', 'keyword', 'string']);

    expect(mockHighlights.has('comment')).toBe(true);
    expect(mockHighlights.has('keyword')).toBe(true);
    expect(mockHighlights.has('string')).toBe(true);
  });

  it('does not overwrite existing highlights', () => {
    const existingHighlight = { existing: true };
    mockHighlights.set('comment', existingHighlight);

    setupTokenHighlights(['comment', 'keyword']);

    expect(mockHighlights.get('comment')).toBe(existingHighlight);
    expect(mockHighlights.has('keyword')).toBe(true);
  });

  it('creates language-prefixed highlights when languageTokens provided', () => {
    setupTokenHighlights(['comment'], {
      languageTokens: {
        css: ['selector', 'property'],
        javascript: ['template-string'],
      },
    });

    expect(mockHighlights.has('comment')).toBe(true);
    expect(mockHighlights.has('css-selector')).toBe(true);
    expect(mockHighlights.has('css-property')).toBe(true);
    expect(mockHighlights.has('javascript-template-string')).toBe(true);
  });

  it('handles empty token types array', () => {
    setupTokenHighlights([]);

    expect(mockHighlights.size).toBe(0);
  });

  it('handles empty languageTokens', () => {
    setupTokenHighlights(['comment'], { languageTokens: {} });

    expect(mockHighlights.size).toBe(1);
    expect(mockHighlights.has('comment')).toBe(true);
  });

  it('does nothing when CSS.highlights is not available', () => {
    delete (globalThis as unknown as { CSS?: object }).CSS;

    // Should not throw
    expect(() => setupTokenHighlights(['comment'])).not.toThrow();
  });
});
