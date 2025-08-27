import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("<wbr>", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("wbr elements allow text flow processing", () => {
    const source = dedent`
      <p>Very<wbr>long<wbr>word <span>with inline</span> elements</p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>Very<wbr>long<wbr>word <span>with inline</span> elements</p>
    `
    expect(result).toEqual(expected)
  })

  test.fails("wbr in long URLs", () => {
    const source = dedent`
      <p>
        Visit <a href="https://example.com">https://<wbr>example.<wbr>com/<wbr>very/<wbr>long/<wbr>path</a> for more info.
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Visit <a href="https://example.com">https://<wbr>example.<wbr>com/<wbr>very/<wbr>long/<wbr>path</a> for more info.
      </p>
    `
    expect(result).toEqual(expected)
  })

  test.fails("wbr with mixed inline elements stays in text flow", () => {
    const source = dedent`
      <p>
        Super<wbr>long<wbr>compound<wbr>word with <strong>emphasis</strong> and <em>italic</em> text.
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Super<wbr>long<wbr>compound<wbr>word with <strong>emphasis</strong> and <em>italic</em> text.
      </p>
    `
    expect(result).toEqual(expected)
  })

  test.fails("multiple wbr elements in technical terms", () => {
    const source = dedent`
      <code>super<wbr>long<wbr>function<wbr>name<wbr>with<wbr>many<wbr>parameters</code>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <code>super<wbr>long<wbr>function<wbr>name<wbr>with<wbr>many<wbr>parameters</code>
    `
    expect(result).toEqual(expected)
  })

  test.fails("wbr elements in different contexts", () => {
    const source = dedent`
      <div>
        <p>Domain: <span class="url">www.<wbr>very<wbr>long<wbr>domain<wbr>name.<wbr>example.<wbr>com</span></p>
        <p>File: <code>really<wbr>long<wbr>filename<wbr>with<wbr>no<wbr>extensions.txt</code></p>
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        <p>Domain: <span class="url">www.<wbr>very<wbr>long<wbr>domain<wbr>name.<wbr>example.<wbr>com</span></p>
        <p>File: <code>really<wbr>long<wbr>filename<wbr>with<wbr>no<wbr>extensions.txt</code></p>
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("wbr at word boundaries", () => {
    const source = dedent`
      <p>Word<wbr> <wbr>boundary<wbr> <wbr>test</p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>Word<wbr> <wbr>boundary<wbr> <wbr>test</p>
    `
    expect(result).toEqual(expected)
  })

  test.fails("wbr with ERB content", () => {
    const source = dedent`
      <p>
        Dynamic<wbr>content: <%= long<wbr>variable<wbr>name %>
        <% if condition %>
          More<wbr>dynamic<wbr>text
        <% end %>
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Dynamic<wbr>content: <%= long<wbr>variable<wbr>name %>
        <% if condition %>
          More<wbr>dynamic<wbr>text
        <% end %>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test.fails("wbr in long chemical names", () => {
    const source = dedent`
      <p class="chemistry">
        Methyl<wbr>enedioxy<wbr>methamphet<wbr>amine is a <em>very</em> long chemical name.
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p class="chemistry">
        Methyl<wbr>enedioxy<wbr>methamphet<wbr>amine is a <em>very</em> long chemical name.
      </p>
    `
    expect(result).toEqual(expected)
  })

  test.fails("dense wbr usage", () => {
    const source = dedent`
      <span>A<wbr>B<wbr>C<wbr>D<wbr>E<wbr>F<wbr>G<wbr>H<wbr>I<wbr>J</span>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <span>A<wbr>B<wbr>C<wbr>D<wbr>E<wbr>F<wbr>G<wbr>H<wbr>I<wbr>J</span>
    `
    expect(result).toEqual(expected)
  })

  test.fails("wbr with complex content that would exceed line length", () => {
    const source = dedent`
      <p>
        This<wbr>is<wbr>a<wbr>very<wbr>long<wbr>word<wbr>that<wbr>might<wbr>need<wbr>to<wbr>break and it has <a href="/link" style="color: blue; text-decoration: underline;">complex inline elements</a> mixed in.
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        This<wbr>is<wbr>a<wbr>very<wbr>long<wbr>word<wbr>that<wbr>might<wbr>need<wbr>to<wbr>break
        and it has
        <a href="/link" style="color: blue; text-decoration: underline;">complex inline elements</a>
        mixed in.
      </p>
    `
    expect(result).toEqual(expected)
  })
})
