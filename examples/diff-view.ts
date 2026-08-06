/**
 * Run with:
 *   npx tsx examples/diff-view.ts
 */

import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "@herb-tools/highlighter"

const EXAMPLES: { title: string, note: string, before: string, after: string }[] = [
  {
    title: "Attribute quotes",
    note: "single-line edit, only the two quote characters are marked",
    before: dedent`
      <div id="gems">
        <span class='card'>Hello</span>
      </div>
    `,
    after: dedent`
      <div id="gems">
        <span class="card">Hello</span>
      </div>
    `,
  },
  {
    title: "Missing alt attribute",
    note: "pure insertion, nothing is marked on the removed side",
    before: dedent`
      <div id="gems">
        <img src="a.png">
      </div>
    `,
    after: dedent`
      <div id="gems">
        <img src="a.png" alt="">
      </div>
    `,
  },
  {
    title: "Re-indent a block",
    note: "three lines for three, the inserted indentation is marked on each",
    before: dedent`
      <div>
      <span>one</span>
      <span>two</span>
      <span>three</span>
      </div>
    `,
    after: dedent`
      <div>
        <span>one</span>
        <span>two</span>
        <span>three</span>
      </div>
    `,
  },
  {
    title: "Wrap content in a new element",
    note: "one line removed, three added",
    before: dedent`
      <div>
        <span>content</span>
      </div>
    `,
    after: dedent`
      <div>
        <section>
          <span>content</span>
        </section>
      </div>
    `,
  },
  {
    title: "Collapse a multi-line tag",
    note: "three lines into one, too dissimilar to refine so no inline marks",
    before: dedent`
      <div>
        <span
          class="card"
        >x</span>
      </div>
    `,
    after: dedent`
      <div>
        <span class="card">x</span>
      </div>
    `,
  },
  {
    title: "Two distant changes",
    note: "split into separate hunks, joined by the vertical ellipsis",
    before: dedent`
      <div>
        <span class='a'>one</span>
        <p>filler</p>
        <p>filler</p>
        <p>filler</p>
        <p>filler</p>
        <span class='b'>two</span>
      </div>
    `,
    after: dedent`
      <div>
        <span class="a">one</span>
        <p>filler</p>
        <p>filler</p>
        <p>filler</p>
        <p>filler</p>
        <span class="b">two</span>
      </div>
    `,
  },
  {
    title: "ERB block",
    note: "quoting and spacing inside an ERB expression",
    before: dedent`
      <% @gems.each do |gem| %>
        <%= render partial: 'gem_card', locals: {gem: gem} %>
      <% end %>
    `,
    after: dedent`
      <% @gems.each do |gem| %>
        <%= render partial: "gem_card", locals: { gem: gem } %>
      <% end %>
    `,
  },
]

/**
 * Cases for `singleLineStyle: "inline"`, which collapses a one-for-one line replacement onto a
 * single line instead of giving it a `-` line and a `+` line.
 */
const COLLAPSING: { title: string, note: string, before: string, after: string }[] = [
  {
    title: "Pure insertion",
    note: "the composite is the real new line, nothing synthetic",
    before: dedent`
      <div>
        <img src="a.png">
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div>
        <img src="a.png" alt="">
        <p>untouched</p>
      </div>
    `,
  },
  {
    title: "Replacement",
    note: "the composite carries text that is in neither version, readable only by its tinting",
    before: dedent`
      <div>
        <span class='a'>one</span>
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div>
        <span class="a">one</span>
        <p>untouched</p>
      </div>
    `,
  },
  {
    title: "Two edits on one line",
    note: "declines to collapse, stays split",
    before: dedent`
      <div>
        <span class='a' id='b'>x</span>
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div>
        <span class="a" id="b">x</span>
        <p>untouched</p>
      </div>
    `,
  },
  {
    title: "Long replacement",
    note: "inline collapses it, auto declines: too much text to read apart on one line",
    before: dedent`
      <div>
        <span class='alpha beta gamma delta'>one</span>
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div>
        <span class="totally different set of names here">one</span>
        <p>untouched</p>
      </div>
    `,
  },
  {
    title: "Multi-line restructure",
    note: "declines to collapse, no one-for-one pair exists",
    before: dedent`
      <div>
        <span>x</span>
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div>
        <section>
          <span>x</span>
        </section>
        <p>untouched</p>
      </div>
    `,
  },
]

/**
 * Cases for `layout: "split"`, which puts the original in a left column and the modified in a
 * right one.
 */
const SPLIT: { title: string, note: string, before: string, after: string }[] = [
  {
    title: "Line-for-line replacement",
    note: "the two columns stay in step",
    before: dedent`
      <div id="gems">
        <span class='a'>one</span>
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div id="gems">
        <span class="a">one</span>
        <p>untouched</p>
      </div>
    `,
  },
  {
    title: "Restructure that adds lines",
    note: "the shorter side is left blank, and the numbering drifts apart below the change",
    before: dedent`
      <div>
        <SPAN>restructured</SPAN>
        <p>untouched</p>
      </div>
    `,
    after: dedent`
      <div>
        <section>
          <span>restructured</span>
        </section>
        <p>untouched</p>
      </div>
    `,
  },
]

const heading = (text: string) => `\x1b[1m${text}\x1b[0m`
const subtle = (text: string) => `\x1b[90m${text}\x1b[0m`

const main = async () => {
  await Herb.load()

  const highlighter = new Highlighter("onedark", Herb)
  await highlighter.initialize()

  for (const { title, note, before, after } of EXAMPLES) {
    console.log(`\n${heading(title)} ${subtle(`— ${note}`)}\n`)

    console.log(highlighter.highlightDiff("app/views/gems/index.html.erb", before, after, {
      contextLines: 1,
      wrapLines: false,
    }))
  }

  console.log(`\n\n${heading("Single-line collapsing")} ${subtle("(singleLineStyle)")}`)
  console.log(subtle("  auto collapses a pair only when the composite reads better than two lines: always for a pure"))
  console.log(subtle("  insertion or deletion, and for a replacement only while the change stays short, stays a"))
  console.log(subtle("  minority of the line, and still fits the width."))
  console.log(subtle("  Needs color: without it every style falls back to split, since only the tinting tells old from new.\n"))

  for (const { title, note, before, after } of COLLAPSING) {
    console.log(`\n${heading(title)} ${subtle(`— ${note}`)}\n`)

    for (const style of ["split", "inline", "auto"] as const) {
      console.log(subtle(`  ${style}`))

      console.log(highlighter.highlightDiff("", before, after, {
        contextLines: 1,
        wrapLines: false,
        singleLineStyle: style,
        indent: "  ",
      }))

      console.log()
    }
  }

  console.log(`\n${heading("Split layout")} ${subtle("(layout: \"split\", original on the left, modified on the right)")}`)
  console.log(subtle("  Each column is numbered from its own version of the file, so the two drift apart after a"))
  console.log(subtle("  change in line count. Falls back to the unified layout when the terminal is too narrow.\n"))

  for (const { title, note, before, after } of SPLIT) {
    console.log(`\n${heading(title)} ${subtle(`— ${note}`)}\n`)

    console.log(highlighter.highlightDiff("", before, after, {
      contextLines: 1,
      layout: "split",
      maxWidth: 140,
      indent: "  ",
    }))
  }

  console.log(`\n${heading("Split layout, narrow terminal")} ${subtle("— 70 columns, falls back to unified")}\n`)

  console.log(highlighter.highlightDiff("", SPLIT[0].before, SPLIT[0].after, {
    contextLines: 1,
    layout: "split",
    maxWidth: 70,
    indent: "  ",
  }))

  console.log()
}

main()
