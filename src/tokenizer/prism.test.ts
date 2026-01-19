import { describe, it, expect } from 'vitest';
import {
  resolveLanguageDependencies,
  resolveLanguage,
  tokenTypes,
} from './prism';

// ============================================
// tokenTypes constant
// ============================================

describe('tokenTypes', () => {
  it('includes standard Prism token types', () => {
    const expected = [
      'comment',
      'keyword',
      'string',
      'number',
      'function',
      'operator',
      'punctuation',
      'boolean',
      'constant',
      'property',
      'tag',
      'attr-name',
      'attr-value',
      'class-name',
      'regex',
    ];

    for (const type of expected) {
      expect(tokenTypes, `tokenTypes should include "${type}"`).toContain(type);
    }
  });

  it('is a non-empty array', () => {
    expect(Array.isArray(tokenTypes)).toBe(true);
    expect(tokenTypes.length).toBeGreaterThan(0);
  });
});

// ============================================
// resolveLanguage
// ============================================

describe('resolveLanguage', () => {
  it('returns canonical name for known aliases', () => {
    expect(resolveLanguage('js')).toBe('javascript');
    expect(resolveLanguage('ts')).toBe('typescript');
    expect(resolveLanguage('py')).toBe('python');
    expect(resolveLanguage('rb')).toBe('ruby');
    expect(resolveLanguage('sh')).toBe('bash');
    expect(resolveLanguage('shell')).toBe('bash');
    expect(resolveLanguage('yml')).toBe('yaml');
    expect(resolveLanguage('md')).toBe('markdown');
  });

  it('resolves markup aliases', () => {
    expect(resolveLanguage('html')).toBe('markup');
    expect(resolveLanguage('xml')).toBe('markup');
    expect(resolveLanguage('svg')).toBe('markup');
  });

  it('resolves C# aliases', () => {
    expect(resolveLanguage('cs')).toBe('csharp');
    expect(resolveLanguage('dotnet')).toBe('csharp');
  });

  it('returns the same language if no alias exists', () => {
    expect(resolveLanguage('javascript')).toBe('javascript');
    expect(resolveLanguage('python')).toBe('python');
    expect(resolveLanguage('rust')).toBe('rust');
    expect(resolveLanguage('go')).toBe('go');
  });

  it('returns unknown languages as-is', () => {
    expect(resolveLanguage('unknown-lang')).toBe('unknown-lang');
    expect(resolveLanguage('made-up')).toBe('made-up');
  });
});

// ============================================
// resolveLanguageDependencies
// ============================================

describe('resolveLanguageDependencies', () => {
  it('returns the language itself for languages with no dependencies', () => {
    const deps = resolveLanguageDependencies('css');

    expect(deps).toContain('css');
  });

  it('includes clike for C-like languages', () => {
    const jsDeps = resolveLanguageDependencies('javascript');

    expect(jsDeps).toContain('clike');
    expect(jsDeps).toContain('javascript');
    // clike should come before javascript
    expect(jsDeps.indexOf('clike')).toBeLessThan(jsDeps.indexOf('javascript'));
  });

  it('resolves TypeScript dependencies (javascript -> clike)', () => {
    const deps = resolveLanguageDependencies('typescript');

    expect(deps).toContain('clike');
    expect(deps).toContain('javascript');
    expect(deps).toContain('typescript');
    // Order: clike -> javascript -> typescript
    expect(deps.indexOf('clike')).toBeLessThan(deps.indexOf('javascript'));
    expect(deps.indexOf('javascript')).toBeLessThan(deps.indexOf('typescript'));
  });

  it('resolves TSX dependencies (markup, javascript, jsx, typescript, tsx)', () => {
    const deps = resolveLanguageDependencies('tsx');

    expect(deps).toContain('markup');
    expect(deps).toContain('javascript');
    expect(deps).toContain('jsx');
    expect(deps).toContain('typescript');
    expect(deps).toContain('tsx');
  });

  it('resolves JSX dependencies', () => {
    const deps = resolveLanguageDependencies('jsx');

    expect(deps).toContain('markup');
    expect(deps).toContain('javascript');
    expect(deps).toContain('jsx');
  });

  it('resolves C++ dependencies (c -> clike)', () => {
    const deps = resolveLanguageDependencies('cpp');

    expect(deps).toContain('clike');
    expect(deps).toContain('c');
    expect(deps).toContain('cpp');
    expect(deps.indexOf('clike')).toBeLessThan(deps.indexOf('c'));
    expect(deps.indexOf('c')).toBeLessThan(deps.indexOf('cpp'));
  });

  it('resolves CSS preprocessor dependencies', () => {
    const scssDeps = resolveLanguageDependencies('scss');
    const lessDeps = resolveLanguageDependencies('less');

    expect(scssDeps).toContain('css');
    expect(scssDeps).toContain('scss');
    expect(lessDeps).toContain('css');
    expect(lessDeps).toContain('less');
  });

  it('handles aliases when resolving dependencies', () => {
    // 'js' is an alias for 'javascript'
    const deps = resolveLanguageDependencies('js');

    expect(deps).toContain('clike');
    expect(deps).toContain('javascript');
  });

  it('handles array input', () => {
    const deps = resolveLanguageDependencies(['css', 'javascript']);

    expect(deps).toContain('css');
    expect(deps).toContain('clike');
    expect(deps).toContain('javascript');
  });

  it('deduplicates dependencies', () => {
    // Both typescript and javascript depend on clike
    const deps = resolveLanguageDependencies(['typescript', 'javascript']);

    const clikeCount = deps.filter((d) => d === 'clike').length;
    expect(clikeCount).toBe(1);
  });

  it('handles PHP multi-dependencies', () => {
    const deps = resolveLanguageDependencies('php');

    expect(deps).toContain('clike');
    expect(deps).toContain('markup');
    expect(deps).toContain('markup-templating');
    expect(deps).toContain('php');
  });

  it('handles deeply nested dependencies (scala -> java -> clike)', () => {
    const deps = resolveLanguageDependencies('scala');

    expect(deps).toContain('clike');
    expect(deps).toContain('java');
    expect(deps).toContain('scala');
    expect(deps.indexOf('clike')).toBeLessThan(deps.indexOf('java'));
    expect(deps.indexOf('java')).toBeLessThan(deps.indexOf('scala'));
  });

  it('returns unique values only', () => {
    const deps = resolveLanguageDependencies('typescript');
    const uniqueDeps = [...new Set(deps)];

    expect(deps.length).toBe(uniqueDeps.length);
  });
});
