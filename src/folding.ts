/**
 * Code folding utilities for bracket-matched languages.
 * @module folding
 */

import type { FlatToken } from './tokenizer/prism';

// ============================================
// Constants
// ============================================

/** Token types that indicate content where braces should be ignored */
const SKIP_TOKEN_TYPES: ReadonlySet<string> = new Set([
  'string',
  'template-string',
  'comment',
  'regex',
  'char',
]);

/** Languages that use C-style braces for blocks */
const C_LIKE_LANGUAGES: ReadonlySet<string> = new Set([
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

/** Placeholder text shown for collapsed regions */
const FOLD_PLACEHOLDER = '...}';

// ============================================
// Type Definitions
// ============================================

/** Represents a foldable region in the code */
export interface FoldRegion {
  /** Character offset of opening brace */
  readonly start: number;
  /** Character offset of closing brace */
  readonly end: number;
  /** Line number of opening brace (0-indexed) */
  readonly startLine: number;
  /** Line number of closing brace (0-indexed) */
  readonly endLine: number;
}

/** State of fold regions for a code block */
export interface FoldState {
  /** All detected fold regions */
  readonly regions: readonly FoldRegion[];
  /** Set of indices for collapsed regions */
  readonly collapsedSet: ReadonlySet<number>;
}

/** Result of content transformation */
export interface TransformResult {
  /** The transformed code with collapsed regions replaced */
  readonly transformedCode: string;
  /** Map from original line number to displayed line number (null if hidden) */
  readonly lineMapping: readonly (number | null)[];
  /** Position offset information for mapping */
  readonly positionOffsets: readonly PositionOffset[];
}

/** Offset information for a collapsed region */
interface PositionOffset {
  readonly original: number;
  readonly transformed: number;
  readonly length: number;
}

/** Internal stack entry for brace matching */
interface BraceStackEntry {
  readonly pos: number;
  readonly line: number;
}

/** Collapsed region with its index */
interface IndexedRegion {
  readonly index: number;
  readonly region: FoldRegion;
}

// ============================================
// Public Functions
// ============================================

/**
 * Check if a language supports code folding.
 *
 * @param language - The resolved language identifier
 * @returns True if the language uses C-style braces
 */
export function isFoldableLanguage(language: string): boolean {
  return C_LIKE_LANGUAGES.has(language);
}

/**
 * Detect fold regions by matching braces in the code.
 * Uses token information to skip braces inside strings, comments, etc.
 *
 * @param code - The source code to analyze
 * @param tokens - Tokens from the syntax highlighter
 * @returns Array of detected fold regions, sorted by start position
 */
export function detectFoldRegions(code: string, tokens: FlatToken[]): FoldRegion[] {
  const positionTokenTypes = buildPositionTokenMap(tokens);
  const lineAtPosition = buildLinePositionMap(code);
  const regions = findMatchingBraces(code, positionTokenTypes, lineAtPosition);

  // Sort regions by start position for consistent ordering
  return regions.sort((a, b) => a.start - b.start);
}

/**
 * Create initial fold state with all regions expanded.
 *
 * @param regions - The detected fold regions
 * @returns A new fold state with no collapsed regions
 */
export function createFoldState(regions: readonly FoldRegion[]): FoldState {
  return {
    regions,
    collapsedSet: new Set(),
  };
}

/**
 * Toggle the collapsed state of a region.
 *
 * @param state - The current fold state
 * @param regionIndex - Index of the region to toggle
 * @returns A new fold state with the region toggled
 */
export function toggleFoldRegion(state: FoldState, regionIndex: number): FoldState {
  const newCollapsed = new Set(state.collapsedSet);

  if (newCollapsed.has(regionIndex)) {
    newCollapsed.delete(regionIndex);
  } else {
    newCollapsed.add(regionIndex);
  }

  return {
    regions: state.regions,
    collapsedSet: newCollapsed,
  };
}

/**
 * Check if a region is collapsed.
 *
 * @param state - The current fold state
 * @param regionIndex - Index of the region to check
 * @returns True if the region is collapsed
 */
export function isRegionCollapsed(state: FoldState, regionIndex: number): boolean {
  return state.collapsedSet.has(regionIndex);
}

/**
 * Get the fold region that starts on a given line (if any).
 *
 * @param state - The current fold state
 * @param line - The line number to check (0-indexed)
 * @returns The region and its index, or null if no region starts on this line
 */
export function getRegionAtLine(
  state: FoldState,
  line: number
): { region: FoldRegion; index: number } | null {
  for (let i = 0; i < state.regions.length; i++) {
    if (state.regions[i].startLine === line) {
      return { region: state.regions[i], index: i };
    }
  }
  return null;
}

/**
 * Transform code by replacing collapsed regions with placeholders.
 *
 * @param code - The original source code
 * @param state - The current fold state
 * @returns The transformation result with code, line mapping, and offsets
 */
export function transformContent(code: string, state: FoldState): TransformResult {
  if (state.collapsedSet.size === 0) {
    return createUnfoldedResult(code);
  }

  const topLevelCollapsed = getTopLevelCollapsedRegions(state);
  const { result, positionOffsets } = buildTransformedCode(code, topLevelCollapsed);
  const lineMapping = buildLineMapping(code, topLevelCollapsed);

  return {
    transformedCode: result,
    lineMapping,
    positionOffsets,
  };
}

/**
 * Get the visible line numbers for display.
 *
 * @param code - The original source code
 * @param state - The current fold state
 * @returns Array of 1-indexed line numbers that are visible
 */
export function getVisibleLineNumbers(code: string, state: FoldState): number[] {
  const { lineMapping } = transformContent(code, state);

  return lineMapping
    .map((mapped, i) => (mapped !== null ? i + 1 : null))
    .filter((n): n is number => n !== null);
}

// ============================================
// Private Helper Functions
// ============================================

/**
 * Build a map of character positions to their token types.
 * Only includes positions inside tokens that should be skipped.
 */
function buildPositionTokenMap(tokens: FlatToken[]): Map<number, string> {
  const positionTokenTypes = new Map<number, string>();
  let pos = 0;

  for (const token of tokens) {
    if (token.type && SKIP_TOKEN_TYPES.has(token.type)) {
      for (let i = 0; i < token.length; i++) {
        positionTokenTypes.set(pos + i, token.type);
      }
    }
    pos += token.length;
  }

  return positionTokenTypes;
}

/**
 * Build an array mapping character positions to line numbers.
 */
function buildLinePositionMap(code: string): number[] {
  const lineAtPosition: number[] = new Array(code.length);
  let currentLine = 0;

  for (let i = 0; i < code.length; i++) {
    lineAtPosition[i] = currentLine;
    if (code[i] === '\n') {
      currentLine++;
    }
  }

  return lineAtPosition;
}

/**
 * Find all matching brace pairs that span multiple lines.
 */
function findMatchingBraces(
  code: string,
  positionTokenTypes: Map<number, string>,
  lineAtPosition: number[]
): FoldRegion[] {
  const regions: FoldRegion[] = [];
  const stack: BraceStackEntry[] = [];

  for (let i = 0; i < code.length; i++) {
    // Skip if this position is inside a string/comment/etc
    if (positionTokenTypes.has(i)) {
      continue;
    }

    const char = code[i];

    if (char === '{') {
      stack.push({ pos: i, line: lineAtPosition[i] });
    } else if (char === '}' && stack.length > 0) {
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

  return regions;
}

/**
 * Create a transform result for unfolded code (no transformations needed).
 */
function createUnfoldedResult(code: string): TransformResult {
  const lineCount = code.split('\n').length;

  return {
    transformedCode: code,
    lineMapping: Array.from({ length: lineCount }, (_, i) => i),
    positionOffsets: [],
  };
}

/**
 * Get collapsed regions, filtering out nested ones.
 */
function getTopLevelCollapsedRegions(state: FoldState): IndexedRegion[] {
  const collapsedRegions: IndexedRegion[] = Array.from(state.collapsedSet)
    .map(i => ({ index: i, region: state.regions[i] }))
    .sort((a, b) => a.region.start - b.region.start);

  // Filter out nested regions
  const topLevel: IndexedRegion[] = [];

  for (const item of collapsedRegions) {
    const isNested = topLevel.some(
      parent =>
        item.region.start > parent.region.start &&
        item.region.end < parent.region.end
    );

    if (!isNested) {
      topLevel.push(item);
    }
  }

  return topLevel;
}

/**
 * Build the transformed code with collapsed regions replaced.
 */
function buildTransformedCode(
  code: string,
  topLevelCollapsed: IndexedRegion[]
): { result: string; positionOffsets: PositionOffset[] } {
  let result = '';
  let lastEnd = 0;
  const positionOffsets: PositionOffset[] = [];

  for (const { region } of topLevelCollapsed) {
    // Add code before this region (including opening brace)
    result += code.slice(lastEnd, region.start + 1);

    // Track offset for position mapping
    const originalLength = region.end - region.start;
    positionOffsets.push({
      original: region.start + 1,
      transformed: result.length,
      length: originalLength,
    });

    // Add placeholder
    result += FOLD_PLACEHOLDER;
    lastEnd = region.end + 1;
  }

  // Add remaining code after last collapsed region
  result += code.slice(lastEnd);

  return { result, positionOffsets };
}

/**
 * Build the line mapping from original to display lines.
 */
function buildLineMapping(
  code: string,
  topLevelCollapsed: IndexedRegion[]
): (number | null)[] {
  const originalLines = code.split('\n');
  const lineMapping: (number | null)[] = [];
  let displayLine = 0;

  for (let origLine = 0; origLine < originalLines.length; origLine++) {
    // Check if this line is hidden (inside a collapsed region, but not the first line)
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

  return lineMapping;
}
