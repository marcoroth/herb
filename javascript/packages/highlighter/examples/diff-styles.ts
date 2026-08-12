/**
 * Run with:
 *   npx tsx examples/diff-styles.ts
 */

import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter, THEME_NAMES } from "@herb-tools/highlighter"

import type { DiffRenderOptions } from "@herb-tools/highlighter"

const BEFORE = dedent`
  <div id="gems">
    <span class='a'>one</span>
    <%= render partial: 'gem_card', locals: {gem: gem} %>
    <img src="a.png">
  </div>
`

const AFTER = dedent`
  <div id="gems">
    <span class="a">one</span>
    <%= render partial: "gem_card", locals: { gem: gem } %>
    <img src="a.png" alt="">
  </div>
`

const STYLES: { style: DiffRenderOptions["removedLineStyle"], label: string }[] = [
  { style: "tint", label: "tint  — removed line washed in the theme's removed background (default)" },
  { style: "dim", label: "dim   — removed line faded, the way context lines are faded" },
  { style: "none", label: "none  — no treatment, the - marker carries it alone" },
]

const heading = (text: string) => `\x1b[1m${text}\x1b[0m`
const subtle = (text: string) => `\x1b[90m${text}\x1b[0m`

const main = async () => {
  await Herb.load()

  console.log(`\n${heading("Removed-line treatments")} ${subtle("(onedark)")}\n`)

  const highlighter = new Highlighter("onedark", Herb)
  await highlighter.initialize()

  for (const { style, label } of STYLES) {
    console.log(`${subtle(label)}\n`)

    console.log(highlighter.highlightDiff("", BEFORE, AFTER, {
      contextLines: 1,
      wrapLines: false,
      removedLineStyle: style,
    }))

    console.log()
  }

  console.log(`\n${heading("Themes")} ${subtle("(default tint treatment)")}\n`)

  for (const theme of THEME_NAMES) {
    const themed = new Highlighter(theme, Herb)
    await themed.initialize()

    const note = theme === "simple" ? " — no diff colors, markers only" : ""

    console.log(`${subtle(`${theme}${note}`)}\n`)

    console.log(themed.highlightDiff("", BEFORE, AFTER, {
      contextLines: 0,
      wrapLines: false,
    }))

    console.log()
  }
}

main()
