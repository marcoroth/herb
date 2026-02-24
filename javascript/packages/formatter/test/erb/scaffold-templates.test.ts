import { describe, test, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("ERB scaffold templates", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("preserves entire document with escaped ERB output tags", () => {
    expectFormattedToMatch('<%%=content%%>')
  })

  test("preserves entire document with escaped ERB logic tags", () => {
    expectFormattedToMatch('<%%if condition%%>')
  })

  test("preserves entire document with escaped ERB tags and spaces", () => {
    expectFormattedToMatch('<%%=  content  %%>')
  })

  test("preserves mixed escaped and regular ERB tags", () => {
    expectFormattedToMatch(dedent`
      <div>
        <%%=   spaced_escaped  %%>
        <%=normal%>
      </div>
    `)
  })

  test("preserves scaffold template from issue #673 exactly as-is", () => {
    expectFormattedToMatch(dedent`
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
    `)
  })
})
