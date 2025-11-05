import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("ERB scaffold templates", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves entire document with escaped ERB output tags", () => {
    const source = '<%%=content%%>'
    const result = formatter.format(source)

    expect(result).toEqual(source)
  })

  test("preserves entire document with escaped ERB logic tags", () => {
    const source = '<%%if condition%%>'
    const result = formatter.format(source)

    expect(result).toEqual(source)
  })

  test("preserves entire document with escaped ERB tags and spaces", () => {
    const source = '<%%=  content  %%>'
    const result = formatter.format(source)

    expect(result).toEqual(source)
  })

  test("preserves mixed escaped and regular ERB tags", () => {
    const source = dedent`
      <div>
        <%%=   spaced_escaped  %%>
        <%=normal%>
      </div>
    `
    const result = formatter.format(source)

    expect(result).toEqual(source)
  })

  test("preserves scaffold template from issue #673 exactly as-is", () => {
    const source = dedent`
      <%# frozen_string_literal: true %>
      <%%= simple_form_for(@<%= singular_table_name %>) do |f| %>
        <%%= f.error_notification %>
        <%%= f.error_notification message: f.object.errors[:base].to_sentence if f.object.errors[:base].present? %>

        <div class="form-inputs">
        <%- attributes.each do |attribute| -%>
          <%%= f.<%= attribute.reference? ? :association : :input %> :<%= attribute.name %> %>
        <%- end -%>
        </div>

        <div class="form-actions">
          <%%= f.button :submit %>
        </div>
      <%% end %>
    `
    const result = formatter.format(source)

    expect(result).toBe(source)
  })
})
