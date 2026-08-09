export const FEATURES = {
  parse: true,
  lex: true,
  html: true,
  ruby: true,
  diagnostics: true,
  diff: false,
  full: true,

  format: false,
  printer: false,
  autofix: false,
  rewrite: false,
  linter: false,
}

export const DISABLED_VIEWERS = Object.entries(FEATURES)
  .filter(([, enabled]) => !enabled)
  .map(([name]) => name)

export const UNSUPPORTED_NOTICE =
  "Not available while the parser targets Nunjucks. This tool still assumes HTML+ERB."
