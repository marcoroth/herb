import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("Attribute ERB Spacing", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  describe("TOKEN_LIST_ATTRIBUTES (should add spaces around ERB)", () => {
    test("class attribute with ERB if block adds spaces", () => {
      const source = dedent`
        <div class="<% if active? %>active<% else %>inactive<% end %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div class="<% if active? %> active <% else %> inactive <% end %>">Content</div>
      `)
    })

    test("class attribute with ERB expression adds spaces", () => {
      const source = dedent`
        <div class="btn <%= button_class %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div class="btn <%= button_class %>">Content</div>
      `)
    })

    test("data-controller attribute with ERB if block adds spaces", () => {
      const source = dedent`
        <div data-controller="<% if enabled? %>dropdown<% end %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div data-controller="<% if enabled? %> dropdown <% end %>">Content</div>
      `)
    })

    test("data-controller attribute with multiple ERB expressions adds spaces", () => {
      const source = dedent`
        <div data-controller="<%= controller_name %> <%= additional_controller %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div data-controller="<%= controller_name %> <%= additional_controller %>">
          Content
        </div>
      `)
    })

    test("data-action attribute with ERB if block adds spaces", () => {
      const source = dedent`
        <button data-action="<% if clickable? %>click->handler#action<% end %>">Click</button>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <button data-action="<% if clickable? %> click->handler#action <% end %>">
          Click
        </button>
      `)
    })

    test("data-action attribute with ERB expression adds spaces", () => {
      const source = dedent`
        <button data-action="<%= action_name %>">Click</button>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <button data-action="<%= action_name %>">Click</button>
      `)
    })

    test("class attribute with ERB if-elsif-else block adds spaces", () => {
      const source = dedent`
        <div class="<% if primary? %>btn-primary<% elsif secondary? %>btn-secondary<% else %>btn-default<% end %>">Button</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div class="<% if primary? %> btn-primary <% elsif secondary? %> btn-secondary <% else %> btn-default <% end %>">
          Button
        </div>
      `)
    })

    test("data-controller attribute with ERB if-elsif block adds spaces", () => {
      const source = dedent`
        <div data-controller="<% if modal? %>modal<% elsif dropdown? %>dropdown<% end %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div
          data-controller="<% if modal? %> modal <% elsif dropdown? %> dropdown <% end %>"
        >
          Content
        </div>
      `)
    })

    test("data-action attribute with ERB if-elsif-else block adds spaces", () => {
      const source = dedent`
        <button data-action="<% if submit? %>click->form#submit<% elsif reset? %>click->form#reset<% else %>click->form#cancel<% end %>">Action</button>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <button
          data-action="<% if submit? %> click->form#submit <% elsif reset? %> click->form#reset <% else %> click->form#cancel <% end %>"
        >
          Action
        </button>
      `)
    })
  })

  describe("Non-TOKEN_LIST_ATTRIBUTES (should NOT add extra spaces)", () => {
    test("style attribute with ERB expressions preserves no extra spaces", () => {
      const source = dedent`
        <div style="color: <%= color %>; background: <%= bg_color %>;">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div style="color: <%= color %>; background: <%= bg_color %>;">Content</div>
      `)
    })

    test("style attribute with ERB if block preserves no extra spaces", () => {
      const source = dedent`
        <div style="<% if visible? %>display: block;<% else %>display: none;<% end %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div style="<% if visible? %>display: block;<% else %>display: none;<% end %>">
          Content
        </div>
      `)
    })

    test("src attribute with ERB expression preserves no extra spaces", () => {
      const source = dedent`
        <img src="<%= image_url %>" alt="Image">
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <img src="<%= image_url %>" alt="Image">
      `)
    })

    test("href attribute with ERB expression preserves no extra spaces", () => {
      const source = dedent`
        <a href="<%= link_url %>">Link</a>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <a href="<%= link_url %>">Link</a>
      `)
    })

    test("id attribute with ERB expression preserves no extra spaces", () => {
      const source = dedent`
        <div id="<%= element_id %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div id="<%= element_id %>">Content</div>
      `)
    })

    test("data-target attribute with ERB expression preserves no extra spaces", () => {
      const source = dedent`
        <div data-target="<%= target_selector %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div data-target="<%= target_selector %>">Content</div>
      `)
    })

    test("style attribute with ERB if-elsif-else block preserves no extra spaces", () => {
      const source = dedent`
        <div style="<% if primary? %>color: blue;<% elsif secondary? %>color: green;<% else %>color: gray;<% end %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div
          style="<% if primary? %>color: blue;<% elsif secondary? %>color: green;<% else %>color: gray;<% end %>"
        >
          Content
        </div>
      `)
    })

    test("src attribute with ERB if-elsif block preserves no extra spaces", () => {
      const source = dedent`
        <img src="<% if large? %>large.jpg<% elsif medium? %>medium.jpg<% end %>" alt="Image">
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <img
          src="<% if large? %>large.jpg<% elsif medium? %>medium.jpg<% end %>"
          alt="Image"
        >
      `)
    })

    test("href attribute with ERB if-elsif-else block preserves no extra spaces", () => {
      const source = dedent`
        <a href="<% if admin? %>/admin<% elsif user? %>/dashboard<% else %>/login<% end %>">Link</a>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <a
          href="<% if admin? %>/admin<% elsif user? %>/dashboard<% else %>/login<% end %>"
        >
          Link
        </a>
      `)
    })
  })

  describe("Mixed attributes", () => {
    test("element with both token-list and non-token-list attributes", () => {
      const source = dedent`
        <div class="<% if active? %>active<% end %>" style="color: <%= text_color %>;" id="<%= element_id %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div
          class="<% if active? %> active <% end %>"
          style="color: <%= text_color %>;"
          id="<%= element_id %>"
        >
          Content
        </div>
      `)
    })

    test("element with multiple token-list attributes", () => {
      const source = dedent`
        <div class="<% if active? %>active<% end %>" data-controller="<% if enabled? %>dropdown<% end %>" data-action="<% if clickable? %>click->handler#action<% end %>">Content</div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div
          class="<% if active? %> active <% end %>"
          data-controller="<% if enabled? %> dropdown <% end %>"
          data-action="<% if clickable? %> click->handler#action <% end %>"
        >
          Content
        </div>
      `)
    })
  })
})
