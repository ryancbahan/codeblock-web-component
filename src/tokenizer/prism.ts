declare global {
  interface Window {
    Prism?: {
      tokenize: (text: string, grammar: unknown) => PrismToken[];
      languages: Record<string, unknown>;
    };
  }
}

export interface PrismToken {
  type: string;
  content: string | PrismToken | (PrismToken | string)[];
  length: number;
}

export interface FlatToken {
  type: string;
  content: string;
  length: number;
}

const PRISM_BASE_URL = 'https://cdn.jsdelivr.net/npm/prismjs@1.30.0';

/**
 * Standard tokens
 * https://prismjs.com/tokens.html#standard-tokens
 */
export const tokenTypes = [
  'atrule',
  'attr-name',
  'attr-value',
  'bold',
  'boolean',
  'builtin',
  'cdata',
  'char',
  'class-name',
  'comment',
  'constant',
  'deleted',
  'doctype',
  'entity',
  'function',
  'important',
  'inserted',
  'italic',
  'keyword',
  'namespace',
  'number',
  'operator',
  'prolog',
  'property',
  'punctuation',
  'regex',
  'rule',
  'selector',
  'string',
  'symbol',
  'tag',
  'url',
];

const langDependencies: Record<string, string | string[]> = {
  javascript: 'clike',
  actionscript: 'javascript',
  arduino: 'cpp',
  aspnet: ['markup', 'csharp'],
  bison: 'c',
  c: 'clike',
  csharp: 'clike',
  cpp: 'c',
  coffeescript: 'javascript',
  crystal: 'ruby',
  'css-extras': 'css',
  d: 'clike',
  dart: 'clike',
  django: 'markup',
  erb: ['ruby', 'markup-templating'],
  fsharp: 'clike',
  flow: 'javascript',
  glsl: 'clike',
  go: 'clike',
  groovy: 'clike',
  haml: 'ruby',
  handlebars: 'markup-templating',
  haxe: 'clike',
  java: 'clike',
  jolie: 'clike',
  kotlin: 'clike',
  less: 'css',
  markdown: 'markup',
  'markup-templating': 'markup',
  n4js: 'javascript',
  nginx: 'clike',
  objectivec: 'c',
  opencl: 'cpp',
  parser: 'markup',
  php: ['clike', 'markup-templating'],
  'php-extras': 'php',
  plsql: 'sql',
  processing: 'clike',
  protobuf: 'clike',
  pug: 'javascript',
  qore: 'clike',
  jsx: ['markup', 'javascript'],
  tsx: ['jsx', 'typescript'],
  reason: 'clike',
  ruby: 'clike',
  sass: 'css',
  scss: 'css',
  scala: 'java',
  smarty: 'markup-templating',
  soy: 'markup-templating',
  swift: 'clike',
  tap: 'yaml',
  textile: 'markup',
  tt2: ['clike', 'markup-templating'],
  twig: 'markup',
  typescript: 'javascript',
  vbnet: 'basic',
  velocity: 'markup',
  wiki: 'markup',
  xeora: 'markup',
  xquery: 'markup',
};

const langAliases: Record<string, string> = {
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  mathml: 'markup',
  ssml: 'markup',
  atom: 'markup',
  rss: 'markup',
  js: 'javascript',
  g4: 'antlr4',
  ino: 'arduino',
  'arm-asm': 'armasm',
  art: 'arturo',
  adoc: 'asciidoc',
  avs: 'avisynth',
  avdl: 'avro-idl',
  gawk: 'awk',
  sh: 'bash',
  shell: 'bash',
  shortcode: 'bbcode',
  rbnf: 'bnf',
  oscript: 'bsl',
  cs: 'csharp',
  dotnet: 'csharp',
  cfc: 'cfscript',
  'cilk-c': 'cilkc',
  'cilk-cpp': 'cilkcpp',
  cilk: 'cilkcpp',
  coffee: 'coffeescript',
  conc: 'concurnas',
  jinja2: 'django',
  'dns-zone': 'dns-zone-file',
  dockerfile: 'docker',
  gv: 'dot',
  eta: 'ejs',
  xlsx: 'excel-formula',
  xls: 'excel-formula',
  gamemakerlanguage: 'gml',
  po: 'gettext',
  gni: 'gn',
  ld: 'linker-script',
  'go-mod': 'go-module',
  hbs: 'handlebars',
  mustache: 'handlebars',
  hs: 'haskell',
  idr: 'idris',
  gitignore: 'ignore',
  hgignore: 'ignore',
  npmignore: 'ignore',
  webmanifest: 'json',
  kt: 'kotlin',
  kts: 'kotlin',
  kum: 'kumir',
  tex: 'latex',
  context: 'latex',
  ly: 'lilypond',
  emacs: 'lisp',
  elisp: 'lisp',
  'emacs-lisp': 'lisp',
  md: 'markdown',
  moon: 'moonscript',
  n4jsd: 'n4js',
  nani: 'naniscript',
  objc: 'objectivec',
  qasm: 'openqasm',
  objectpascal: 'pascal',
  px: 'pcaxis',
  pcode: 'peoplecode',
  plantuml: 'plant-uml',
  pq: 'powerquery',
  mscript: 'powerquery',
  pbfasm: 'purebasic',
  purs: 'purescript',
  py: 'python',
  qs: 'qsharp',
  rkt: 'racket',
  razor: 'cshtml',
  rpy: 'renpy',
  res: 'rescript',
  robot: 'robotframework',
  rb: 'ruby',
  'sh-session': 'shell-session',
  shellsession: 'shell-session',
  smlnj: 'sml',
  sol: 'solidity',
  sln: 'solution-file',
  rq: 'sparql',
  sclang: 'supercollider',
  t4: 't4-cs',
  trickle: 'tremor',
  troy: 'tremor',
  trig: 'turtle',
  ts: 'typescript',
  tsconfig: 'typoscript',
  uscript: 'unrealscript',
  uc: 'unrealscript',
  url: 'uri',
  vb: 'visual-basic',
  vba: 'visual-basic',
  webidl: 'web-idl',
  mathematica: 'wolfram',
  nb: 'wolfram',
  wl: 'wolfram',
  xeoracube: 'xeora',
  yml: 'yaml',
};

const loadedLanguages = new Set<string>();

function resolveAliases(aliases: string[]): string[] {
  return aliases.map((alias) => langAliases[alias] || alias);
}

export function resolveLanguageDependencies(language: string | string[]): string[] {
  const langs = Array.isArray(language) ? language : [language];
  const resolvedDependencies = resolveAliases(langs).reduce<string[]>((acc, lang) => {
    const deps = langDependencies[lang];
    const depsArray = deps ? (Array.isArray(deps) ? deps : [deps]) : [];
    acc.push(...resolveLanguageDependencies(depsArray), lang);
    return acc;
  }, []);

  return Array.from(new Set(resolvedDependencies));
}

export async function loadPrismLanguage(languages: string | string[]): Promise<Set<string>> {
  const resolvedLanguages = resolveLanguageDependencies(languages);

  for (const lang of resolvedLanguages) {
    await new Promise<void>((resolve, reject) => {
      if (loadedLanguages.has(lang)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `${PRISM_BASE_URL}/components/prism-${lang}.min.js`;
      script.async = true;
      script.onload = () => {
        document.head.removeChild(script);
        loadedLanguages.add(lang);
        resolve();
      };
      script.onerror = (error) => {
        document.head.removeChild(script);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  return loadedLanguages;
}

export function loadPrismCore(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Prism) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `${PRISM_BASE_URL}/components/prism-core.min.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getFlatToken(token: PrismToken | string): FlatToken | FlatToken[] {
  if (typeof token === 'string') {
    return { type: '', content: token, length: token.length };
  }

  if (typeof token.content === 'string') {
    return { type: token.type, content: token.content, length: token.content.length };
  }

  if (Array.isArray(token.content)) {
    const insideTokens: (PrismToken | string)[] = token.content.flatMap((x): (PrismToken | string)[] =>
      typeof x === 'string'
        ? [{ type: token.type, content: x, length: x.length }]
        : [x]
    );
    return insideTokens.flatMap(getFlatToken);
  }

  // token.content is a single PrismToken
  return getFlatToken(token.content) as FlatToken | FlatToken[];
}

export async function setup(languages: string[]): Promise<void> {
  try {
    await loadPrismCore();
    await loadPrismLanguage(languages);
  } catch (error) {
    console.error('Failed to load Prism:', error);
  }
}

export function tokenize(text: string, language: string): FlatToken[] {
  const lang = window.Prism?.languages[language];
  if (!lang) {
    console.warn(`Prism language "${language}" is not loaded.`);
    return [];
  }
  const tokens = window.Prism!.tokenize(text, lang);
  return tokens.flatMap(getFlatToken) as FlatToken[];
}

export function resolveLanguage(language: string): string {
  return langAliases[language] || language;
}
