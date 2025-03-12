import type { EnhanceAppContext } from "vitepress"
import Theme from "vitepress/theme"

import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client"

import "virtual:group-icons.css"
import "./custom.css"
import "@shikijs/vitepress-twoslash/style.css"

export default {
  extends: Theme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(TwoslashFloatingVue)
  },
}
