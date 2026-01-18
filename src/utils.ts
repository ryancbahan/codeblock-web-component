export interface LanguageTokens {
  [language: string]: string[];
}

export function setupTokenHighlights(
  tokenTypes: string[],
  options: { languageTokens?: LanguageTokens } = {}
): void {
  const { languageTokens = {} } = options;

  const languageTokenTypes = Object.entries(languageTokens).flatMap(([lang, types]) =>
    types.map((tokenType) => `${lang}-${tokenType}`)
  );

  const allTokenTypes = [...tokenTypes, ...languageTokenTypes];

  for (const tokenType of allTokenTypes) {
    if (CSS.highlights && !CSS.highlights.has(tokenType)) {
      CSS.highlights.set(tokenType, new Highlight());
    }
  }
}

export function isHighlightApiSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS;
}
