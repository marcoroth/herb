import dedent from "dedent"

import { describe, it, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { substringFromByteOffset } from "../src/index.js"

import { RubyReferenceCollector, isProbableLocal, isValidLocalName } from "../src/ruby-reference-collector.js"

import type { RubyReference } from "../src/ruby-reference-collector.js"

describe("RubyReferenceCollector", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function collect(source: string): RubyReferenceCollector {
    const result = Herb.parse(source, { prism_program: true })
    const collector = new RubyReferenceCollector()

    if (result.value.prismNode) {
      collector.visit(result.value.prismNode)
    }

    return collector
  }

  function names(references: RubyReference[]): string[] {
    return references.map(reference => reference.name)
  }

  describe("local variables", () => {
    it("collects reads and the assignment that binds them", () => {
      const collector = collect(`<% total = 1 %><%= total %>`)

      expect(names(collector.localBindings)).toEqual(["total"])
      expect(names(collector.localReads)).toEqual(["total"])
    })

    it("collects block parameters as bindings", () => {
      const collector = collect(dedent`
        <% items.each do |item| %>
          <%= item %>
        <% end %>
      `)

      expect(names(collector.localBindings)).toEqual(["item"])
      expect(names(collector.localReads)).toEqual(["item"])
    })

    it("collects destructured block parameters", () => {
      const collector = collect(`<% pairs.each do |key, value| %><%= key %><%= value %><% end %>`)

      expect(names(collector.localBindings)).toEqual(["key", "value"])
      expect(names(collector.localReads)).toEqual(["key", "value"])
    })

    it("collects optional and keyword parameters", () => {
      const collector = collect(`<% [].each do |a, b = 1, *rest, c:, d: 2, **options, &block| %><% end %>`)

      expect(names(collector.localBindings)).toEqual(["a", "b", "rest", "c", "d", "options", "block"])
    })

    it("collects block local variables", () => {
      const collector = collect(`<% [].each do |item; scratch| %><% end %>`)

      expect(names(collector.localBindings)).toEqual(["item", "scratch"])
    })

    it("collects operator and conditional assignments as bindings", () => {
      const collector = collect(`<% count = 0 %><% count += 1 %><% count ||= 2 %><% count &&= 3 %>`)

      expect(names(collector.localBindings)).toEqual(["count", "count", "count", "count"])
    })

    it("collects multiple assignment targets", () => {
      const collector = collect(`<% first, second = pair %><%= first %>`)

      expect(names(collector.localBindings)).toEqual(["first", "second"])
      expect(names(collector.localReads)).toEqual(["first"])
    })
  })

  describe("instance variables", () => {
    it("collects reads with the sigil", () => {
      const collector = collect(`<%= @user.name %>`)

      expect(names(collector.instanceVariableReads)).toEqual(["@user"])
      expect(collector.instanceVariableWrites).toHaveLength(0)
    })

    it("collects every write form", () => {
      const collector = collect(`<% @a = 1 %><% @b += 1 %><% @c ||= 1 %><% @d &&= 1 %>`)

      expect(names(collector.instanceVariableWrites)).toEqual(["@a", "@b", "@c", "@d"])
    })

    it("collects instance variables in multiple assignment targets", () => {
      const collector = collect(`<% @first, @second = pair %>`)

      expect(names(collector.instanceVariableWrites)).toEqual(["@first", "@second"])
    })

    it("collects reads nested in interpolation and attributes", () => {
      const collector = collect(`<div class="<%= @variant %>"><%= "Hi #{@user.name}" %></div>`)

      expect(names(collector.instanceVariableReads)).toEqual(["@variant", "@user"])
    })
  })

  describe("bare calls", () => {
    it("collects a receiverless call without arguments or a block", () => {
      const collector = collect(`<%= current_user %>`)

      expect(names(collector.bareCalls)).toEqual(["current_user"])
    })

    it("collects the receiver of a chained call, but not the messages", () => {
      const collector = collect(`<%= user.profile.name %>`)

      expect(names(collector.bareCalls)).toEqual(["user"])
    })

    it("ignores calls with arguments", () => {
      const collector = collect(`<%= link_to "Home", root_path %>`)

      expect(names(collector.bareCalls)).toEqual(["root_path"])
    })

    it("ignores calls with a block", () => {
      const collector = collect(`<%= form_with do |form| %><% end %>`)

      expect(collector.bareCalls).toHaveLength(0)
    })

    it("does not collect constants", () => {
      const collector = collect(`<%= Date.today %>`)

      expect(collector.bareCalls).toHaveLength(0)
    })

    it("does not collect a bare constant", () => {
      const collector = collect(`<%= MAX_ITEMS %>`)

      expect(collector.bareCalls).toHaveLength(0)
    })

    it("does not collect constant paths", () => {
      const collector = collect(`<%= User::ROLES.first %><%= ::Account.count %>`)

      expect(collector.bareCalls).toHaveLength(0)
    })

    it("does not collect global or class variables", () => {
      const collector = collect(`<%= $global %><%= @@shared %>`)

      expect(collector.bareCalls).toHaveLength(0)
      expect(collector.localReads).toHaveLength(0)
      expect(collector.instanceVariableReads).toHaveLength(0)
    })

    it("does not collect a local variable read as a bare call", () => {
      const collector = collect(`<% user = nil %><%= user %>`)

      expect(collector.bareCalls).toHaveLength(0)
      expect(names(collector.localReads)).toEqual(["user"])
    })
  })

  describe("locations", () => {
    it("reports offsets into the original template", () => {
      const source = `<div><%= @user.name %></div>`
      const collector = collect(source)
      const reference = collector.instanceVariableReads[0]

      expect(substringFromByteOffset(source, reference.startOffset, reference.length)).toBe("@user")
    })

    it("reports the name location for a write, not the whole assignment", () => {
      const source = `<% @count = 42 %>`
      const collector = collect(source)
      const reference = collector.instanceVariableWrites[0]

      expect(substringFromByteOffset(source, reference.startOffset, reference.length)).toBe("@count")
    })

    it("reports the message location for a bare call", () => {
      const source = `<div><%= current_user %></div>`
      const collector = collect(source)
      const reference = collector.bareCalls[0]

      expect(substringFromByteOffset(source, reference.startOffset, reference.length)).toBe("current_user")
    })

    it("stays accurate after multi-byte characters", () => {
      const source = `<div>Grüße 🌿<%= @user %></div>`
      const collector = collect(source)
      const reference = collector.instanceVariableReads[0]

      expect(substringFromByteOffset(source, reference.startOffset, reference.length)).toBe("@user")
    })
  })
})

describe("isValidLocalName", () => {
  test("accepts ordinary local names", () => {
    expect(isValidLocalName("title")).toBe(true)
    expect(isValidLocalName("_leading")).toBe(true)
    expect(isValidLocalName("post_id2")).toBe(true)
  })

  test("rejects Ruby keywords, local_assigns and malformed names", () => {
    expect(isValidLocalName("class")).toBe(false)
    expect(isValidLocalName("local_assigns")).toBe(false)
    expect(isValidLocalName("Title")).toBe(false)
    expect(isValidLocalName("has?")).toBe(false)
  })
})

describe("isProbableLocal", () => {
  test("treats an ordinary bare name as a probable local", () => {
    expect(isProbableLocal("title")).toBe(true)
    expect(isProbableLocal("class_name")).toBe(true)
  })

  test("rejects predicates, bang methods and route helpers", () => {
    expect(isProbableLocal("admin?")).toBe(false)
    expect(isProbableLocal("save!")).toBe(false)
    expect(isProbableLocal("posts_path")).toBe(false)
    expect(isProbableLocal("post_url")).toBe(false)
  })

  test("rejects known Action View helpers", () => {
    expect(isProbableLocal("link_to")).toBe(false)
    expect(isProbableLocal("image_tag")).toBe(false)
  })

  test("treats form builder only helpers as probable locals", () => {
    expect(isProbableLocal("button")).toBe(true)
    expect(isProbableLocal("submit")).toBe(true)
  })

  test("still rejects the top level counterparts of form builder helpers", () => {
    expect(isProbableLocal("button_tag")).toBe(false)
    expect(isProbableLocal("button_to")).toBe(false)
    expect(isProbableLocal("submit_tag")).toBe(false)
  })
})
