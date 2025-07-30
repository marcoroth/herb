import type { EnhanceAppContext } from "vitepress"
import Theme from "vitepress/theme"

import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client"

import GitHubContributors from "./components/GitHubContributors.vue"

import "virtual:group-icons.css"
import "./custom.css"
import "@shikijs/vitepress-twoslash/style.css"

export default {
  extends: Theme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(TwoslashFloatingVue)
    app.component("GitHubContributors", GitHubContributors)
  },
  setup() {
    if (typeof window !== 'undefined') {
      const updateThemeState = () => {
        const isDark = document.documentElement.classList.contains('dark')
        localStorage.setItem('vitepress-theme-actual', isDark ? 'dark' : 'light')
      }

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            updateThemeState()
          }
        })
      })

      const startObserving = () => {
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class']
        })

        updateThemeState()
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving)
      } else {
        startObserving()
      }
    }
  }
}
