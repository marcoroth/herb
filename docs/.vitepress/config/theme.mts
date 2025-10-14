import { generateRuleWrappers } from "../generate-rules.mjs"

const defaultSidebar = [
  {
    text: "Getting Started",
    collapsed: false,
    items: [
      { text: "Overview", link: "/overview" },
      { text: "Projects", link: "/projects" },
    ],
  },
  {
    text: "Developer Tools",
    collapsed: false,
    items: [
      { text: "Language Server", link: "/projects/language-server" },
      { text: "Formatter", link: "/projects/formatter" },
      { text: "Linter", link: "/projects/linter" },
      { text: "CLI", link: "/projects/cli" },
      { text: "Dev Tools", link: "/projects/dev-tools" },
    ],
  },
  {
    text: "Utility Libraries",
    collapsed: false,
    items: [
      { text: "Language Service", link: "/projects/language-service" },
      { text: "Highlighter", link: "/projects/highlighter" },
      { text: "Syntax Tree Printer", link: "/projects/printer" },
      { text: "Minifier", link: "/projects/minifier" },
      { text: "Core", link: "/projects/core" },
    ],
  },
  {
    text: "HTML+ERB Rendering",
    collapsed: false,
    items: [
      { text: "Engine", link: "/projects/engine" },
      { text: "Compiler", link: "/projects/compiler" },
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
      { text: "RubyMine", link: "/integrations/editors/rubymine" },
      { text: "Sublime Text", link: "/integrations/editors/sublime" },
      { text: "Vim", link: "/integrations/editors/vim" },
      { text: "Visual Studio Code", link: "/integrations/editors/vscode" },
      { text: "Zed", link: "/integrations/editors/zed" },
    ],
  },
  {
    text: "Language Bindings",
    collapsed: false,
    items: [
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
      {
        text: "Ruby",
        collapsed: false,
        items: [
          { text: "Installation", link: "/bindings/ruby/" },
          { text: "Reference", link: "/bindings/ruby/reference" },
        ],
      },
      {
        text: "JavaScript",
        collapsed: false,
        items: [
          { text: "Installation", link: "/bindings/javascript/" },
          { text: "Reference", link: "/bindings/javascript/reference" },
        ],
      },
      { text: "WebAssembly", link: "/projects/webassembly" },
    ],
  },
  {
    text: "About",
    link: "/about",
  },
]

export function createThemeConfig() {
  const ruleItems = generateRuleWrappers()

  const linterSidebar = structuredClone(defaultSidebar)
  linterSidebar[1].items[2] = {
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
      { text: "Documentation", link: "/overview" },
      { text: "Playground", link: "/playground" },
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
      copyright: "Copyright © 2024-2025 Marco Roth and the Herb Contributors.",
    },
    editLink: {
      pattern: "https://github.com/marcoroth/herb/edit/main/docs/docs/:path",
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
            { text: "Overview", link: "/projects/linter/" },
            {
              text: "Rules",
              collapsed: false,
              items: ruleItems
            }
          ]
        }
      ],
      '/projects/linter': linterSidebar,
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
