import { describe, it, expect } from 'vitest';
import {
  isFoldableLanguage,
  detectFoldRegions,
  createFoldState,
  toggleFoldRegion,
  isRegionCollapsed,
  getRegionAtLine,
  transformContent,
  getVisibleLineNumbers,
} from './folding';
import type { FlatToken } from './tokenizer/prism';

// ============================================
// Test Helpers
// ============================================

/** Create a simple token for testing */
function token(type: string, content: string): FlatToken {
  return { type, content, length: content.length };
}

/** Create a plain text token */
function text(content: string): FlatToken {
  return { type: '', content, length: content.length };
}

// ============================================
// isFoldableLanguage
// ============================================

describe('isFoldableLanguage', () => {
  it('returns true for C-like languages', () => {
    const foldable = [
      'javascript', 'typescript', 'jsx', 'tsx',
      'css', 'scss', 'less',
      'c', 'cpp', 'csharp', 'java',
      'go', 'rust', 'swift', 'kotlin',
      'json',
    ];

    for (const lang of foldable) {
      expect(isFoldableLanguage(lang), `${lang} should be foldable`).toBe(true);
    }
  });

  it('returns false for non-C-like languages', () => {
    const notFoldable = ['python', 'ruby', 'yaml', 'markdown', 'plaintext', 'html'];

    for (const lang of notFoldable) {
      expect(isFoldableLanguage(lang), `${lang} should not be foldable`).toBe(false);
    }
  });
});

// ============================================
// detectFoldRegions
// ============================================

describe('detectFoldRegions', () => {
  it('detects a single fold region', () => {
    const code = `function foo() {
  return 1;
}`;
    const tokens: FlatToken[] = [
      token('keyword', 'function'),
      text(' '),
      token('function', 'foo'),
      token('punctuation', '('),
      token('punctuation', ')'),
      text(' '),
      token('punctuation', '{'),
      text('\n  '),
      token('keyword', 'return'),
      text(' '),
      token('number', '1'),
      token('punctuation', ';'),
      text('\n'),
      token('punctuation', '}'),
    ];

    const regions = detectFoldRegions(code, tokens);

    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({
      start: 15, // position of {
      end: 29,   // position of }
      startLine: 0,
      endLine: 2,
    });
  });

  it('detects nested fold regions', () => {
    const code = `class Foo {
  method() {
    return 1;
  }
}`;
    // Simplified tokens - we just need punctuation positions
    const tokens: FlatToken[] = [text(code)];

    const regions = detectFoldRegions(code, tokens);

    expect(regions).toHaveLength(2);
    // Regions are sorted by start position
    expect(regions[0].startLine).toBe(0); // class {
    expect(regions[1].startLine).toBe(1); // method() {
  });

  it('ignores braces inside strings', () => {
    const code = `const x = "{not a fold}";
const y = 1;`;
    const tokens: FlatToken[] = [
      token('keyword', 'const'),
      text(' x = '),
      token('string', '"{not a fold}"'),
      token('punctuation', ';'),
      text('\n'),
      token('keyword', 'const'),
      text(' y = '),
      token('number', '1'),
      token('punctuation', ';'),
    ];

    const regions = detectFoldRegions(code, tokens);

    expect(regions).toHaveLength(0);
  });

  it('ignores braces inside comments', () => {
    const code = `// { this is a comment }
const x = 1;`;
    const tokens: FlatToken[] = [
      token('comment', '// { this is a comment }'),
      text('\n'),
      token('keyword', 'const'),
      text(' x = '),
      token('number', '1'),
      token('punctuation', ';'),
    ];

    const regions = detectFoldRegions(code, tokens);

    expect(regions).toHaveLength(0);
  });

  it('ignores single-line braces', () => {
    const code = `const obj = { a: 1, b: 2 };`;
    const tokens: FlatToken[] = [text(code)];

    const regions = detectFoldRegions(code, tokens);

    expect(regions).toHaveLength(0);
  });

  it('handles empty code', () => {
    const regions = detectFoldRegions('', []);
    expect(regions).toHaveLength(0);
  });

  it('handles unmatched braces gracefully', () => {
    const code = `function foo() {
  if (true) {
    // missing closing brace`;
    const tokens: FlatToken[] = [text(code)];

    // Should not throw
    const regions = detectFoldRegions(code, tokens);

    // May detect partial regions depending on implementation
    expect(Array.isArray(regions)).toBe(true);
  });
});

// ============================================
// createFoldState
// ============================================

describe('createFoldState', () => {
  it('creates state with empty collapsed set', () => {
    const regions = [
      { start: 0, end: 10, startLine: 0, endLine: 2 },
      { start: 20, end: 30, startLine: 4, endLine: 6 },
    ];

    const state = createFoldState(regions);

    expect(state.regions).toBe(regions);
    expect(state.collapsedSet.size).toBe(0);
  });

  it('creates state with empty regions array', () => {
    const state = createFoldState([]);

    expect(state.regions).toHaveLength(0);
    expect(state.collapsedSet.size).toBe(0);
  });
});

// ============================================
// toggleFoldRegion
// ============================================

describe('toggleFoldRegion', () => {
  const regions = [
    { start: 0, end: 10, startLine: 0, endLine: 2 },
    { start: 20, end: 30, startLine: 4, endLine: 6 },
  ];

  it('collapses an expanded region', () => {
    const state = createFoldState(regions);

    const newState = toggleFoldRegion(state, 0);

    expect(newState.collapsedSet.has(0)).toBe(true);
    expect(newState.collapsedSet.has(1)).toBe(false);
  });

  it('expands a collapsed region', () => {
    let state = createFoldState(regions);
    state = toggleFoldRegion(state, 0);

    const newState = toggleFoldRegion(state, 0);

    expect(newState.collapsedSet.has(0)).toBe(false);
  });

  it('returns a new state object (immutable)', () => {
    const state = createFoldState(regions);

    const newState = toggleFoldRegion(state, 0);

    expect(newState).not.toBe(state);
    expect(newState.collapsedSet).not.toBe(state.collapsedSet);
  });

  it('preserves regions reference', () => {
    const state = createFoldState(regions);

    const newState = toggleFoldRegion(state, 0);

    expect(newState.regions).toBe(state.regions);
  });
});

// ============================================
// isRegionCollapsed
// ============================================

describe('isRegionCollapsed', () => {
  const regions = [
    { start: 0, end: 10, startLine: 0, endLine: 2 },
  ];

  it('returns false for expanded region', () => {
    const state = createFoldState(regions);

    expect(isRegionCollapsed(state, 0)).toBe(false);
  });

  it('returns true for collapsed region', () => {
    let state = createFoldState(regions);
    state = toggleFoldRegion(state, 0);

    expect(isRegionCollapsed(state, 0)).toBe(true);
  });
});

// ============================================
// getRegionAtLine
// ============================================

describe('getRegionAtLine', () => {
  const regions = [
    { start: 0, end: 50, startLine: 0, endLine: 5 },
    { start: 10, end: 40, startLine: 1, endLine: 4 },
    { start: 60, end: 80, startLine: 7, endLine: 9 },
  ];

  it('returns region starting at the given line', () => {
    const state = createFoldState(regions);

    const result = getRegionAtLine(state, 1);

    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
    expect(result!.region.startLine).toBe(1);
  });

  it('returns null for line without region start', () => {
    const state = createFoldState(regions);

    const result = getRegionAtLine(state, 3);

    expect(result).toBeNull();
  });

  it('returns first matching region (by array order)', () => {
    const state = createFoldState(regions);

    const result = getRegionAtLine(state, 0);

    expect(result!.index).toBe(0);
  });
});

// ============================================
// transformContent
// ============================================

describe('transformContent', () => {
  const code = `line 0 {
  line 1
  line 2
}
line 4`;

  const regions = [
    { start: 7, end: 27, startLine: 0, endLine: 3 },
  ];

  it('returns original code when nothing is collapsed', () => {
    const state = createFoldState(regions);

    const result = transformContent(code, state);

    expect(result.transformedCode).toBe(code);
    expect(result.lineMapping).toEqual([0, 1, 2, 3, 4]);
    expect(result.positionOffsets).toHaveLength(0);
  });

  it('replaces collapsed region with placeholder', () => {
    let state = createFoldState(regions);
    state = toggleFoldRegion(state, 0);

    const result = transformContent(code, state);

    expect(result.transformedCode).toBe('line 0 {...}\nline 4');
  });

  it('marks hidden lines as null in lineMapping', () => {
    let state = createFoldState(regions);
    state = toggleFoldRegion(state, 0);

    const result = transformContent(code, state);

    expect(result.lineMapping[0]).toBe(0);     // line 0 - visible
    expect(result.lineMapping[1]).toBeNull();  // line 1 - hidden
    expect(result.lineMapping[2]).toBeNull();  // line 2 - hidden
    expect(result.lineMapping[3]).toBeNull();  // line 3 (}) - hidden
    expect(result.lineMapping[4]).toBe(1);     // line 4 - visible (display line 1)
  });

  it('handles nested collapsed regions', () => {
    const nestedCode = `outer {
  inner {
    content
  }
}
after`;
    const nestedRegions = [
      { start: 6, end: 34, startLine: 0, endLine: 4 },  // outer
      { start: 16, end: 32, startLine: 1, endLine: 3 }, // inner
    ];

    let state = createFoldState(nestedRegions);
    // Collapse both - inner should be ignored since outer contains it
    state = toggleFoldRegion(state, 0);
    state = toggleFoldRegion(state, 1);

    const result = transformContent(nestedCode, state);

    // Only outer collapse should apply
    expect(result.transformedCode).toBe('outer {...}\nafter');
  });

  it('handles multiple non-nested collapsed regions', () => {
    const multiCode = `first {
  a
}
second {
  b
}`;
    const multiRegions = [
      { start: 6, end: 12, startLine: 0, endLine: 2 },
      { start: 21, end: 27, startLine: 3, endLine: 5 },
    ];

    let state = createFoldState(multiRegions);
    state = toggleFoldRegion(state, 0);
    state = toggleFoldRegion(state, 1);

    const result = transformContent(multiCode, state);

    expect(result.transformedCode).toBe('first {...}\nsecond {...}');
  });
});

// ============================================
// getVisibleLineNumbers
// ============================================

describe('getVisibleLineNumbers', () => {
  const code = `line 0 {
  line 1
  line 2
}
line 4`;

  const regions = [
    { start: 7, end: 27, startLine: 0, endLine: 3 },
  ];

  it('returns all lines when nothing collapsed', () => {
    const state = createFoldState(regions);

    const visible = getVisibleLineNumbers(code, state);

    expect(visible).toEqual([1, 2, 3, 4, 5]); // 1-indexed
  });

  it('excludes hidden lines when collapsed', () => {
    let state = createFoldState(regions);
    state = toggleFoldRegion(state, 0);

    const visible = getVisibleLineNumbers(code, state);

    expect(visible).toEqual([1, 5]); // lines 2, 3, 4 are hidden
  });
});
