import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("formats ERB case/when/else statements", () => {
    const source = dedent`
      <% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case status %>
      <% when "ok" %>
        GOOD
      <% when "error" %>
        BAD
      <% else %>
        UNKNOWN
      <% end %>
    `)
  })

  test("formats ERB case/when/else statements inside element", () => {
    const source = dedent`
      <div><% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <% case status %>
        <% when "ok" %>
          GOOD
        <% when "error" %>
          BAD
        <% else %>
          UNKNOWN
        <% end %>
      </div>
    `)
  })

  test("formats ERB case/in statements", () => {
    const source = dedent`
      <% case { hash: { nested: '4' } } %>
            <% in { hash: { nested: } } %>
      <span>there</span>
              <% in { another: } %>
      <span>there</span>
      <% in { yet_another: { nested: } } %>
             <span>hi</span>
            <% else %>
      <span>there</span>
        <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case { hash: { nested: '4' } } %>
      <% in { hash: { nested: } } %>
        <span>there</span>
      <% in { another: } %>
        <span>there</span>
      <% in { yet_another: { nested: } } %>
        <span>hi</span>
      <% else %>
        <span>there</span>
      <% end %>
    `)
  })

  test("formats ERB case/in/else statements", () => {
    const source = dedent`
      <% case { hash: { nested: '4' } } %>
            <% in { hash: { nested: } } %>
            2
              <% else %>
              3

      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case { hash: { nested: '4' } } %>
      <% in { hash: { nested: } } %>
        2
      <% else %>
        3
      <% end %>
    `)
  })

  test("formats ERB case with when and no else", () => {
    const input = dedent`
      <% case user_type %>
      <% when :admin %>
      <p>Admin Panel</p>
      <% when :user %>
      <p>User Dashboard</p>
      <% end %>
    `

    const expected = dedent`
      <% case user_type %>
      <% when :admin %>
        <p>Admin Panel</p>
      <% when :user %>
        <p>User Dashboard</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("case without surrounding spaces", () => {
    const input = dedent`
      <%case status%>
      <%when "ok"%>
      <%else%>
      <%end%>
    `

    const expected = dedent`
      <% case status %>
      <% when "ok" %>
      <% else %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("case/when with children", () => {
    const input = dedent`
      <% case variable %>
        <h1>Children</h1>
      <% when Integer %>
        <h1>Integer</h1>
      <% when String %>
        <h1>String</h1>
      <% else %>
        <h1>else</h1>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("case/in with children", () => {
    const input = dedent`
      <% case { hash: { nested: '4' } } %>
        <span>children</span>
      <% in { hash: { nested: } } %>
        <span>nested</span>
      <% else %>
        <span>else</span>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("case/when with long outputs inside inline element - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <span>
          <% case status %>
          <% when 'pending' %>
            <%= render partial: 'status_badge', locals: { text: 'Pending Review', color: 'yellow' } %>
          <% when 'approved' %>
            <%= render partial: 'status_badge', locals: { text: 'Approved', color: 'green' } %>
          <% when 'rejected' %>
            <%= render partial: 'status_badge', locals: { text: 'Rejected', color: 'red' } %>
          <% end %>
        </span>
      </div>
    `
    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("case/when with method calls and long paths - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <span>
          <% case user.subscription_tier %>
          <% when :premium %>
            <%= link_to "Premium Dashboard", premium_dashboard_path(user_id: user.id, features: :all) %>
          <% when :basic %>
            <%= link_to "Basic Dashboard", basic_dashboard_path(user_id: user.id, features: :limited) %>
          <% else %>
            <%= link_to "Free Dashboard", free_dashboard_path(user_id: user.id, features: :minimal) %>
          <% end %>
        </span>
      </div>
    `
    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("case/in with complex patterns and long outputs - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <span>
          <% case user_data %>
          <% in { role: 'admin', permissions: { level: level } } if level > 5 %>
            <%= link_to "Super Admin Panel", super_admin_path(user: user_data, access: :full) %>
          <% in { role: 'moderator', permissions: } %>
            <%= link_to "Moderator Tools", moderator_path(user: user_data, access: :limited) %>
          <% else %>
            <%= link_to "User Profile", profile_path(user: user_data, access: :basic) %>
          <% end %>
        </span>
      </div>
    `
    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  describe("no whitespace introduction on single-line case statements", () => {
    test("short case/when stays on one line without whitespace", () => {
      const input = `<span><% case x %><% when 1 %>One<% when 2 %>Two<% else %>Other<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short case/when with ERB output stays on one line - no whitespace", () => {
      const input = `<span><% case type %><% when :ok %><%= msg %><% else %>Error<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short case/when with only text stays on one line - no whitespace", () => {
      const input = `<span><% case status %><% when 'ok' %>OK<% else %>Fail<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short case/in stays on one line - no whitespace", () => {
      const input = `<span><% case val %><% in 1 %>A<% in 2 %>B<% else %>C<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short case with symbols stays on one line - no whitespace", () => {
      const input = `<span><% case role %><% when :admin %>Admin<% when :user %>User<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short case with ERB output stays on one line - no whitespace", () => {
      const input = `<span><% case a %><% when 1 %><%= x %><% when 2 %><%= y %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })
  })
  test("splits a case and its first when condition into separate ERB tags", () => {
    const source = dedent`
      <% case variable when "a" %>
        A
      <% when "b" %>
        B
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case variable %>
      <% when "a" %>
        A
      <% when "b" %>
        B
      <% end %>
    `)
  })

  test("splits a case and its first when condition written on a second line", () => {
    const source = dedent`
      <% case variable
         when "a" %>
        A
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case variable %>
      <% when "a" %>
        A
      <% end %>
    `)
  })

  test("keeps a then keyword when splitting a case and its first when condition", () => {
    const source = dedent`
      <% case variable when "a" then %>
        A
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case variable %>
      <% when "a" then %>
        A
      <% end %>
    `)
  })

  test("splits a case and its first in pattern written on a second line", () => {
    const source = dedent`
      <% case value
         in 1 %>
        One
      <% in 2 %>
        Two
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case value %>
      <% in 1 %>
        One
      <% in 2 %>
        Two
      <% end %>
    `)
  })

  test("leaves a case and its first in pattern sharing a line alone", () => {
    const source = dedent`
      <% case value in 1 %>
        One
      <% in 2 %>
        Two
      <% end %>
    `
    expect(formatter.format(source)).toEqual(source)
  })

  test("leaves a template alone when an error other than the shared tag remains", () => {
    const source = dedent`
      <% case variable when "a" %>
        <div><span></div>
      <% end %>
    `
    expect(formatter.format(source)).toEqual(source)
  })

  test("leaves a template with an omitted closing tag alone", () => {
    const source = dedent`
      <ul>
        <li>a
        <li>b
      </ul>
    `
    expect(formatter.format(source)).toEqual(source)
  })

  test("leaves a case and its conditions alone when they are already separate tags", () => {
    const source = dedent`
      <% case variable %>
      <% when "a" %>
        A
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })
})
