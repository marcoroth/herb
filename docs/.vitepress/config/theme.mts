import { generateRuleWrappers } from "../generate-rules.mjs"

const defaultSidebar = [
  {
    text: "Getting Started",
    collapsed: false,
    items: [
      { text: "Welcome", link: "/overview" },
      { text: "Installation", link: "/installation" },
      { text: "Configuration", link: "/configuration" },
    ],
  },
  {
    text: "Language",
    collapsed: false,
    items: [
      { text: "Overview", link: "/language/" },
      { text: "Templates", link: "/language/templates" },
      { text: "ERB Syntax", link: "/language/erb" },
      { text: "State", link: "/language/state" },
      { text: "Actions", link: "/language/actions" },
      { text: "Keys and Collections", link: "/language/keys" },
      { text: "Slots", link: "/language/slots" },
      { text: "Components", link: "/language/components" },
      { text: "Scoped Styles", link: "/language/scoped-styles" },
      { text: "Strict Locals", link: "/language/strict-locals" },
    ],
  },
  {
    text: "Tools",
    collapsed: false,
    items: [
      { text: "Linter", link: "/projects/linter" },
      { text: "Formatter", link: "/projects/formatter" },
      { text: "Language Server", link: "/projects/language-server" },
      { text: "Dev Server", link: "/projects/dev-server" },
      { text: "Dev Tools", link: "/projects/dev-tools" },
      { text: "CLI", link: "/projects/cli" },
    ],
  },
  {
    text: "Rendering",
    collapsed: false,
    items: [
      { text: "Engine", link: "/projects/engine" },
      {
        text: "Engine Visitors",
        collapsed: true,
        items: [
          { text: "AutoCloseOmittedTags", link: "/projects/engine/visitors/auto-close-omitted-tags" },
          { text: "RemoveComments", link: "/projects/engine/visitors/remove-comments" },
          { text: "ContentFor", link: "/projects/engine/visitors/content-for" },
          { text: "HTMLSafeAssertions", link: "/projects/engine/visitors/html-safe-assertions" },
          { text: "ComponentTags", link: "/projects/engine/visitors/component-tags" },
          { text: "Debug", link: "/projects/engine/visitors/debug" },
          { text: "SourceAttribution", link: "/projects/engine/visitors/source-attribution" },
          { text: "Optimize", link: "/projects/engine/visitors/optimize" },
          { text: "InlineRender", link: "/projects/engine/visitors/inline-render" },
          { text: "ScopedStyle", link: "/projects/engine/visitors/scoped-style" },
          { text: "CSSInliner", link: "/projects/engine/visitors/css-inliner" },
        ],
      },
      { text: "Client Runtime", link: "/projects/client" },
      { text: "ReActionView", link: "https://reactionview.dev" },
    ],
  },
  {
    text: "Editor Integrations",
    collapsed: false,
    items: [
      { text: "Overview", link: "/integrations/editors" },
      { text: "Cursor", link: "/integrations/editors/cursor" },
      { text: "Helix", link: "/integrations/editors/helix" },
      { text: "Neovim", link: "/integrations/editors/neovim" },
      { text: "Nova", link: "/integrations/editors/nova" },
      { text: "RubyMine", link: "/integrations/editors/rubymine" },
      { text: "Sublime Text", link: "/integrations/editors/sublime" },
      { text: "Vim", link: "/integrations/editors/vim" },
      { text: "Visual Studio Code", link: "/integrations/editors/vscode" },
      { text: "Zed", link: "/integrations/editors/zed" },
    ],
  },
  {
    text: "CI Integrations",
    collapsed: false,
    items: [
      { text: "Overview", link: "/integrations/ci" },
      { text: "GitHub Actions", link: "/integrations/ci/github-actions" },
      { text: "GitLab CI", link: "/integrations/ci/gitlab" },
      { text: "Bitbucket Pipelines", link: "/integrations/ci/bitbucket" },
      { text: "Reviewdog", link: "/integrations/ci/reviewdog" },
      { text: "Git Hooks", link: "/integrations/git-hooks" },
    ],
  },
  {
    text: "Building on Herb",
    collapsed: true,
    items: [
      { text: "Projects", link: "/projects" },
      { text: "Parser Options", link: "/parser-options" },
      {
        text: "Language Bindings",
        collapsed: true,
        items: [
          { text: "Installing a Binding", link: "/bindings/installation" },
          { text: "Parsing", link: "/bindings/parsing" },
          { text: "Lexing", link: "/bindings/lexing" },
          { text: "Extracting Ruby and HTML", link: "/bindings/extracting" },
          { text: "Working with the Tree", link: "/bindings/tree" },
          { text: "Versions", link: "/bindings/versions" },
          {
            text: "Languages",
            collapsed: true,
            items: [
              { text: "Ruby", link: "/bindings/ruby/" },
              { text: "JavaScript", link: "/bindings/javascript/" },
              { text: "Java", link: "/bindings/java/" },
              { text: "Rust", link: "/bindings/rust/" },
              { text: "WebAssembly", link: "/projects/webassembly" },
            ],
          },
          {
            text: "C Library (libherb)",
            collapsed: true,
            items: [
              { text: "Overview", link: "/projects/parser" },
              { text: "API Reference", link: "/c-reference/" },
              { text: "Structs", link: "/c-reference/structs" },
              { text: "Tokens", link: "/c-reference/tokens" },
              { text: "AST Nodes", link: "/c-reference/nodes" },
              { text: "Enums", link: "/c-reference/enums" },
              { text: "Enum Values", link: "/c-reference/enum-values" },
            ],
          },
        ],
      },
      { text: "Analysis", link: "/projects/analysis" },
      { text: "Language Service", link: "/projects/language-service" },
      { text: "Highlighter", link: "/projects/highlighter" },
      { text: "Syntax Tree Printer", link: "/projects/printer" },
      { text: "Minifier", link: "/projects/minifier" },
      { text: "Rewriter", link: "/projects/rewriter" },
      { text: "Config", link: "/projects/config" },
      { text: "Core", link: "/projects/core" },
    ],
  },
  {
    text: "Appendices",
    collapsed: false,
    items: [
      { text: "Glossary", link: "/glossary" },
      { text: "Blog", link: "/blog" },
      { text: "About", link: "/about" },
    ],
  },
]

function findItem(sidebar, link) {
  for (const group of sidebar) {
    const index = (group.items ?? []).findIndex((item) => item.link === link)

    if (index !== -1) {
      return { items: group.items, index }
    }
  }

  throw new Error(`No sidebar item links to ${link}`)
}

export function createThemeConfig() {
  const ruleItems = generateRuleWrappers()

  const linterSidebar = structuredClone(defaultSidebar)
  const linter = findItem(linterSidebar, "/projects/linter")

  linter.items[linter.index] = {
    text: "Linter",
    collapsed: false,
    items: [
      { text: "Overview", link: "/projects/linter" },
      { text: "Rules", link: "/linter/rules/" }
    ]
  }

  return {
    logo: "/herb.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Blog", link: "/blog" },
      { text: "Documentation", link: "/overview" },
      {
        text: "Playground",
        items: [
          { text: "Herb Playground", link: "/playground/" },
          { text: "Prism Playground", link: "/playground/prism" },
        ],
      },
    ],
    outline: [2, 4],
    search: {
      provider: "local",
    },
    lastUpdated: {
      text: "Last updated",
      formatOptions: {
        dateStyle: "long",
      },
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-2026 Marco Roth and the Herb Contributors.",
    },
    editLink: {
      pattern: ({ filePath }) => {
        if (filePath.startsWith('linter/rules/')) {
          let fileName = filePath.replace('linter/rules/', '')

          if (fileName === 'index.md') {
            fileName = 'README.md'
          }

          return `https://github.com/marcoroth/herb/edit/main/javascript/packages/linter/docs/rules/${fileName}`
        }

        return `https://github.com/marcoroth/herb/edit/main/docs/docs/${filePath}`
      },
      text: "Edit this page on GitHub",
    },
    sidebar: {
      '/linter/rules/': [
        {
          text: "← Back to Linter",
          link: "/projects/linter"
        },
        {
          text: "Linter",
          items: [
            { text: "Overview", link: "/projects/linter" },
            {
              text: "Rules",
              collapsed: false,
              items: ruleItems
            }
          ]
        }
      ],
      '/projects/linter': linterSidebar,
      '/blog': [],
      '/': defaultSidebar
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/marcoroth/herb" },
      { icon: "twitter", link: "https://twitter.com/marcoroth_" },
      { icon: "mastodon", link: "https://ruby.social/@marcoroth" },
      { icon: "bluesky", link: "https://bsky.app/profile/marcoroth.dev" },
    ],
  }
}
