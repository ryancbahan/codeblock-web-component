import type { FlatToken } from './tokenizer/prism';

export interface FoldRegion {
  start: number;      // Character offset of opening brace
  end: number;        // Character offset of closing brace
  startLine: number;  // Line number of opening brace (0-indexed)
  endLine: number;    // Line number of closing brace (0-indexed)
}

export interface FoldState {
  regions: FoldRegion[];
  collapsedSet: Set<number>; // Indices of collapsed regions
}

// Token types that indicate content where braces should be ignored
const SKIP_TOKEN_TYPES = new Set([
  'string',
  'template-string',
  'comment',
  'regex',
  'char',
]);

// Languages that use C-style braces for blocks
const C_LIKE_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'css',
  'scss',
  'less',
  'c',
  'cpp',
  'csharp',
  'java',
  'go',
  'rust',
  'swift',
  'kotlin',
  'php',
  'dart',
  'scala',
  'groovy',
  'json',
  'jsonc',
]);

export function isFoldableLanguage(language: string): boolean {
  return C_LIKE_LANGUAGES.has(language);
}

/**
 * Detect fold regions by matching braces in the code.
 * Uses token information to skip braces inside strings, comments, etc.
 */
export function detectFoldRegions(code: string, tokens: FlatToken[]): FoldRegion[] {
  const regions: FoldRegion[] = [];
  const stack: { pos: number; line: number }[] = [];

  // Build a map of positions to token types for quick lookup
  const positionTokenTypes = new Map<number, string>();
  let pos = 0;
  for (const token of tokens) {
    if (token.type && SKIP_TOKEN_TYPES.has(token.type)) {
      // Mark all positions in this token as skippable
      for (let i = 0; i < token.length; i++) {
        positionTokenTypes.set(pos + i, token.type);
      }
    }
    pos += token.length;
  }

  // Calculate line numbers for each position
  const lineAtPosition: number[] = [];
  let currentLine = 0;
  for (let i = 0; i < code.length; i++) {
    lineAtPosition[i] = currentLine;
    if (code[i] === '\n') {
      currentLine++;
    }
  }

  // Scan through code looking for braces
  for (let i = 0; i < code.length; i++) {
    const char = code[i];

    // Skip if this position is inside a string/comment/etc
    if (positionTokenTypes.has(i)) {
      continue;
    }

    if (char === '{') {
      stack.push({ pos: i, line: lineAtPosition[i] });
    } else if (char === '}') {
      if (stack.length > 0) {
        const open = stack.pop()!;
        const closeLine = lineAtPosition[i];

        // Only create fold region if it spans multiple lines
        if (closeLine > open.line) {
          regions.push({
            start: open.pos,
            end: i,
            startLine: open.line,
            endLine: closeLine,
          });
        }
      }
    }
  }

  // Sort regions by start position
  regions.sort((a, b) => a.start - b.start);

  return regions;
}

/**
 * Create initial fold state with all regions expanded
 */
export function createFoldState(regions: FoldRegion[]): FoldState {
  return {
    regions,
    collapsedSet: new Set(),
  };
}

/**
 * Toggle the collapsed state of a region
 */
export function toggleFoldRegion(state: FoldState, regionIndex: number): FoldState {
  const newCollapsed = new Set(state.collapsedSet);

  if (newCollapsed.has(regionIndex)) {
    newCollapsed.delete(regionIndex);
  } else {
    newCollapsed.add(regionIndex);
  }

  return {
    ...state,
    collapsedSet: newCollapsed,
  };
}

/**
 * Check if a region is collapsed
 */
export function isRegionCollapsed(state: FoldState, regionIndex: number): boolean {
  return state.collapsedSet.has(regionIndex);
}

/**
 * Get the fold region that starts on a given line (if any)
 */
export function getRegionAtLine(state: FoldState, line: number): { region: FoldRegion; index: number } | null {
  for (let i = 0; i < state.regions.length; i++) {
    if (state.regions[i].startLine === line) {
      return { region: state.regions[i], index: i };
    }
  }
  return null;
}

/**
 * Transform code by replacing collapsed regions with placeholders.
 * Returns the transformed code and a mapping for position translation.
 */
export function transformContent(code: string, state: FoldState): {
  transformedCode: string;
  /** Map from original line number to displayed line number (or null if hidden) */
  lineMapping: (number | null)[];
  /** Offsets for mapping positions: array of {original, transformed, delta} */
  positionOffsets: { original: number; transformed: number; length: number }[];
} {
  if (state.collapsedSet.size === 0) {
    // No collapsed regions - return original
    const lineCount = code.split('\n').length;
    return {
      transformedCode: code,
      lineMapping: Array.from({ length: lineCount }, (_, i) => i),
      positionOffsets: [],
    };
  }

  // Sort collapsed regions by start position
  const collapsedRegions = Array.from(state.collapsedSet)
    .map(i => ({ index: i, region: state.regions[i] }))
    .sort((a, b) => a.region.start - b.region.start);

  // Filter out nested regions (if parent is collapsed, don't process children)
  const topLevelCollapsed: typeof collapsedRegions = [];
  for (const item of collapsedRegions) {
    const isNested = topLevelCollapsed.some(
      parent => item.region.start > parent.region.start && item.region.end < parent.region.end
    );
    if (!isNested) {
      topLevelCollapsed.push(item);
    }
  }

  // Build transformed code
  let result = '';
  let lastEnd = 0;
  const positionOffsets: { original: number; transformed: number; length: number }[] = [];

  for (const { region } of topLevelCollapsed) {
    // Add code before this region
    result += code.slice(lastEnd, region.start + 1); // Include the opening brace

    // Add placeholder
    const placeholder = '...}';
    const originalLength = region.end - region.start; // From after { to }

    positionOffsets.push({
      original: region.start + 1,
      transformed: result.length,
      length: originalLength,
    });

    result += placeholder;
    lastEnd = region.end + 1;
  }

  // Add remaining code
  result += code.slice(lastEnd);

  // Build line mapping
  const originalLines = code.split('\n');
  const lineMapping: (number | null)[] = [];
  let displayLine = 0;

  for (let origLine = 0; origLine < originalLines.length; origLine++) {
    // Check if this line is inside a collapsed region (but not the first line)
    const isHidden = topLevelCollapsed.some(
      ({ region }) => origLine > region.startLine && origLine <= region.endLine
    );

    if (isHidden) {
      lineMapping.push(null);
    } else {
      lineMapping.push(displayLine);
      displayLine++;
    }
  }

  return { transformedCode: result, lineMapping, positionOffsets };
}

/**
 * Get the visible line numbers for the fold gutter
 */
export function getVisibleLineNumbers(code: string, state: FoldState): number[] {
  const { lineMapping } = transformContent(code, state);
  const visibleLines: number[] = [];

  for (let i = 0; i < lineMapping.length; i++) {
    if (lineMapping[i] !== null) {
      visibleLines.push(i + 1); // 1-indexed for display
    }
  }

  return visibleLines;
}
