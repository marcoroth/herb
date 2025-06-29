import { defineConfig } from "vitepress"
import { transformerTwoslash } from "@shikijs/vitepress-twoslash"
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
  localIconLoader,
} from "vitepress-plugin-group-icons"

const markdown = {
  config(md) {
    md.use(groupIconMdPlugin)
  },
  codeTransformers: [transformerTwoslash()],
  // Explicitly load these languages for types hightlighting
  languages: ["js", "jsx", "ts", "tsx", "bash", "shell", "ruby", "html", "erb"],
}

// https://vp.yuy1n.io/features.html
// https://github.com/vscode-icons/vscode-icons/wiki/ListOfFiles
const groupIconPlugin = groupIconVitePlugin({
  customIcon: {
    ruby: "vscode-icons:file-type-ruby",
    ".rb": "vscode-icons:file-type-ruby",
    ".gemspec": "vscode-icons:file-type-ruby",
    gemfile: "vscode-icons:file-type-bundler",
    browser: "vscode-icons:file-type-js",
    "Node.js": "vscode-icons:file-type-js",
    ".js": "vscode-icons:file-type-js",
    javascript: "vscode-icons:file-type-js",
    shell: "vscode-icons:file-type-shell",
    ".erb": localIconLoader(import.meta.url, "./assets/herb.svg"),
    ".html.erb": localIconLoader(import.meta.url, "./assets/herb.svg"),
    ".herb": localIconLoader(import.meta.url, "./assets/herb.svg"),
  },
})

const vite = {
  plugins: [groupIconPlugin],
}

const themeConfig = {
  logo: "/herb.svg",
  // https://vitepress.dev/reference/default-theme-config
  nav: [
    { text: "Home", link: "/" },
    { text: "Documentation", link: "/bindings/ruby/" },
    { text: "Playground", link: "/playground" },
  ],

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
    pattern: "https://github.com/marcoroth/herb/edit/main/docs/:path",
    text: "Edit this page on GitHub",
  },

  sidebar: [
    {
      text: "Specification",
      items: [
        { text: "General", link: "/specification" },
        { text: "HTML", link: "/specification/html" },
        { text: "ERB", link: "/specification/erb" },
        // { text: "Blade", link: "/specification/blade" },
        // { text: "EJS", link: "/specification/ejs" },
        // { text: "Handlebars", link: "/specification/handlebars" },
        // { text: "Jinja", link: "/specification/jinja" },
        // { text: "Liquid", link: "/specification/liquid" },
      ],
    },
    {
      text: "Language Bindings",
      items: [
        {
          text: "Ruby",
          collapsed: false,
          items: [
            { text: "Installation", link: "/bindings/ruby/" },
            { text: "Reference", link: "/bindings/ruby/reference" },
          ],
        },
        {
          text: "JavaScript/Node.js",
          collapsed: false,
          items: [
            { text: "Installation", link: "/bindings/javascript/" },
            { text: "Reference", link: "/bindings/javascript/reference" },
          ],
        },
      ],
    },
    {
      text: "C-Reference",
      collapsed: false,
      items: [
        { text: "Index", link: "/c-reference/" },
        { text: "Structs", link: "/c-reference/structs" },
        { text: "Tokens", link: "/c-reference/tokens" },
        { text: "AST-Nodes", link: "/c-reference/nodes" },
        { text: "Enums", link: "/c-reference/enums" },
        { text: "Enum-Values", link: "/c-reference/enum-values" },
      ],
    },
    {
      text: "About",
      link: "/about",
    },
  ],

  socialLinks: [
    { icon: "github", link: "https://github.com/marcoroth/herb" },
    { icon: "twitter", link: "https://twitter.com/marcoroth_" },
    { icon: "mastodon", link: "https://ruby.social/@marcoroth" },
    { icon: "bluesky", link: "https://bsky.app/profile/marcoroth.dev" },
  ],
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Herb",
  titleTemplate: "HTML-aware ERB parsing",
  description: "Powerful and seamless HTML-aware ERB parsing and tooling.",
  srcDir: "./docs",
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'icon', href: '/favicon-16x16.png', sizes: '16x16' }],
    ['link', { rel: 'icon', href: '/favicon-32x32.png', sizes: '32x32' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { property: 'og:image', content: '/social.png' }],
    ['meta', { property: 'og:title', content: 'Herb Tools' }],
    ['meta', { property: 'og:description', content: 'Powerful and seamless HTML-aware ERB parsing and tooling.' }],
    ['meta', { property: 'og:url', content: 'https://herb-tools.dev' }],
    ['meta', { property: 'og:type', content: 'website' }],
  ],
  cleanUrls: true,
  // base: "/herb/",
  markdown,
  vite,
  themeConfig,
})
