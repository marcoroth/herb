import { defineConfig } from "vitepress"
import { createMarkdownConfig } from "./config/markdown.mjs"
import { createViteConfig } from "./config/vite.mjs"
import { createThemeConfig } from "./config/theme.mjs"
import { initializeHerb } from "./utils/herb.mjs"

await initializeHerb()

const themeConfig = createThemeConfig()

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
  markdown: createMarkdownConfig(),
  vite: createViteConfig(),
  themeConfig,
})
