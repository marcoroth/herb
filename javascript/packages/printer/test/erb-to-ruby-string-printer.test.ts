import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { ERBToRubyStringPrinter } from "../src/erb-to-ruby-string-printer.js"

describe("ERBToRubyStringPrinter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("converts simple text to Ruby string", () => {
    const erb = `hello world`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"hello world"`)
  })

  test("converts single ERB output tag to raw Ruby code", () => {
    const erb = `<%= hello %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`hello`)
  })

  test("converts single ERB silent tag", () => {
    const erb = `<% hello %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`""`)
  })

  test("converts ERB output tag to interpolation", () => {
    const erb = `hello world <%= hello %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"hello world #{hello}"`)
  })

  test("converts simple if/else to ternary without quotes", () => {
    const erb = `<% if true %> hello <% else %> world <% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`true ? " hello " : " world "`)
  })

  test("ignores ERB silent tags", () => {
    const erb = `hello world <% hello %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"hello world "`)
  })

  test("handles mixed ERB output and silent tags", () => {
    const erb = `Welcome <%= user.name %><% puts "debug" %>!`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Welcome #{user.name}!"`)
  })

  test("handles multiple ERB output tags", () => {
    const erb = `Hello <%= first_name %> <%= last_name %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Hello #{first_name} #{last_name}"`)
  })

  test("handles complex ERB expressions", () => {
    const erb = `Price: $<%= product.price.round(2) %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Price: $#{product.price.round(2)}"`)
  })

  test("handles ERB with HTML", () => {
    const erb = `<p>Welcome <%= user.name %>!</p>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"<p>Welcome #{user.name}!</p>"`)
  })

  test("handles empty ERB tags", () => {
    const erb = `text <%= %> more text`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"text #{} more text"`)
  })

  test("handles ERB with special characters", () => {
    const erb = `Quote: "<%= message %>"`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Quote: \\"#{message}\\""`)
  })

  test("handles only ERB output tag", () => {
    const erb = `<%= user.name %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`user.name`)
  })

  test("handles only ERB silent tag", () => {
    const erb = `<% puts "hello" %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`""`)
  })

  test("handles ERB with whitespace", () => {
    const erb = `Start <%= value %> End`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Start #{value} End"`)
  })

  test("converts simple if/else to ternary operator", () => {
    const erb = `<% if user.logged_in? %>Welcome<% else %>Please login<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`user.logged_in? ? "Welcome" : "Please login"`)
  })

  test("converts if/else with mixed content to ternary", () => {
    const erb = `Hello <% if premium? %>Premium User<% else %>Guest<% end %>!`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Hello #{premium? ? "Premium User" : "Guest"}!"`)
  })

  test("ignores if without else", () => {
    const erb = `<% if admin? %>Admin Panel<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`admin? ? "Admin Panel" : ""`)
  })

  test("handles if/else with special characters", () => {
    const erb = `<% if active? %>Status: "active"<% else %>Status: "inactive"<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`active? ? "Status: \\"active\\"" : "Status: \\"inactive\\""`)
  })

  test("handles empty if/else branches", () => {
    const erb = `<% if condition? %><% else %>Empty<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`condition? ? "" : "Empty"`)
  })

  test("adds parentheses for complex conditions with spaces", () => {
    const erb = `<% if user && user.active? %>Active<% else %>Inactive<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`(user && user.active?) ? "Active" : "Inactive"`)
  })

  test("adds parentheses for complex conditions with spaces", () => {
    const erb = `<% if user && user.active? %>Active<% else %>Inactive<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value, { forceQuotes: true})

    expect(result).toBe(`"#{(user && user.active?) ? "Active" : "Inactive"}"`)
  })

  test("no parentheses for simple method calls", () => {
    const erb = `<% if logged_in? %>Welcome<% else %>Login<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`logged_in? ? "Welcome" : "Login"`)
  })

  test("no parentheses for simple method calls with force", () => {
    const erb = `<% if logged_in? %>Welcome<% else %>Login<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value, { forceQuotes: true})

    expect(result).toBe(`"#{logged_in? ? "Welcome" : "Login"}"`)
  })

  test("does not convert if/elsif/else to ternary", () => {
    const erb = `<% if admin? %>Admin<% elsif user? %>User<% else %>Guest<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`""`)
  })

  test("erb, static, erb with string", () => {
    const erb = `<%= root_path %>/assets/<%= "icon.png" %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"#{root_path}/assets/#{"icon.png"}"`)
  })

  test("handles HTML attribute value node without double quotes", () => {
    const erb = `<img src="<%= root_url %>/banner.jpg" />`
    const parseResult = Herb.parse(erb)

    const imgElement = parseResult.value.children[0]
    const srcAttr = imgElement.open_tag.children.find(child =>
      child.type === "AST_HTML_ATTRIBUTE_NODE"
    )

    const result = ERBToRubyStringPrinter.print(srcAttr.value)
    expect(result).toBe(`"#{root_url}/banner.jpg"`)
  })

  test("converts simple unless to ternary without quotes", () => {
    const erb = `<% unless logged_in? %>Please login<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`!(logged_in?) ? "Please login" : ""`)
  })

  test("converts unless without else to ternary", () => {
    const erb = `<% unless admin? %>Restricted Access<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`!(admin?) ? "Restricted Access" : ""`)
  })

  test("converts unless with mixed content to ternary", () => {
    const erb = `Status: <% unless active? %>Inactive<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`"Status: #{!(active?) ? "Inactive" : ""}"`)
  })

  test("adds parentheses for complex unless conditions", () => {
    const erb = `<% unless user && user.active? %>Please activate<% end %>`
    const parseResult = Herb.parse(erb)
    const result = ERBToRubyStringPrinter.print(parseResult.value)

    expect(result).toBe(`!((user && user.active?)) ? "Please activate" : ""`)
  })
})
