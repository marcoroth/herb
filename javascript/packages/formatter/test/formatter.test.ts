import { describe, test, expect, beforeAll } from "vitest";
import { Herb } from "@herb-tools/node";
import { Formatter } from "../src";

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load();
    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  });

  test("text content", () => {
    const source = 'Hello';
    const result = formatter.format(source);
    expect(result).toEqual('Hello');
  })

  test("HTML comment", () => {
    const source = '<!-- hello -->';
    const result = formatter.format(source);
    expect(result).toEqual('<!-- hello -->');
  })

  test("HTML comment with no surrounding spaces", () => {
    const source = '<!--hello-->';
    const result = formatter.format(source);
    expect(result).toEqual('<!-- hello -->');
  })

  test("HTML tag with attributes", () => {
    const source = `<div id="hello"></div>`;
    const result = formatter.format(source);
    expect(result).toEqual('<div id="hello"></div>');
  })

  test("formats simple HTML with ERB content", () => {
    const source = '<div><%= "Hello" %></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div>
  <%= "Hello" %>
</div>`);
  });

  test("respects indentWidth option", () => {
    const source = '<div><%= "World" %></div>';
    const result = formatter.format(source, { indentWidth: 4 });
    expect(result).toEqual(`<div>
    <%= "World" %>
</div>`);
  });

  test("wraps multiple attributes correctly", () => {
    const source = '<div class="foo" id="bar"></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div
  class="foo"
  id="bar"
></div>`);
  });

  test("does not wrap single attribute", () => {
    const source = '<div class="foo"></div>';
    const result = formatter.format(source);
    expect(result).toEqual('<div class="foo"></div>');
  });

  test("wraps long text content at maxLineLength threshold", () => {
    const formatter = new Formatter(Herb, { maxLineLength: 40 });
    const longText =
      'This is a very long line of text that should be broken into multiple lines by the formatter based on the maxLineLength option.';
    const source = `<p>${longText}</p>`;
    const result = formatter.format(source);
    expect(result).toEqual(`<p>
  This is a very long line of text that
  should be broken into multiple lines
  by the formatter based on the
  maxLineLength option.
</p>`);
  });

  test("formats ERB for/in loops with nested HTML", () => {
    const source =
      '<% for item in list %><li><%= item.name %></li><% end %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% for item in list %>
  <li>
    <%= item.name %>
  </li>
<% end %>`);
  });

  test("formats ERB case/when/else statements", () => {
    const source =
      '<% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% case status %>
  <% when "ok" %>
    GOOD
  <% when "error" %>
    BAD
  <% else %>
    UNKNOWN
<% end %>`);
  });

  test("formats ERB begin/rescue/else/ensure blocks", () => {
    const source =
      '<% begin %>OK<% rescue Error => e %>ERR<% else %>NONE<% ensure %>FIN<% end %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% begin %>
  OK
<% rescue Error => e %>
  ERR
<% else %>
  NONE
<% ensure %>
  FIN
<% end %>`);
  });
  test("formats ERB while loops", () => {
    const source =
      '<% while i < 3 %><b><%= i %></b><% i += 1 %><% end %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% while i < 3 %>
  <b>
    <%= i %>
  </b>
  <% i += 1 %>
<% end %>`);
  });

  test("formats ERB until loops", () => {
    const source =
      '<% until i == 3 %><b><%= i %></b><% i += 1 %><% end %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% until i == 3 %>
  <b>
    <%= i %>
  </b>
  <% i += 1 %>
<% end %>`);
  });

  test("formats standalone ERB", () => {
    const source = '<% title %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% title %>`);
  });

  test("formats HTML comments and ERB comments", () => {
    const source =
      '<!-- HTML Comment --><%# ERB Comment %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<!-- HTML Comment -->
<%# ERB Comment %>`);
  });

  test("formats doctype with ERB inside", () => {
    const source = '<!DoCTyPe <% hello %> hello>';
    const result = formatter.format(source);
    expect(result).toEqual(`<!DoCTyPe <% hello %> hello>`);
  });

  test("formats tags with empty attribute values", () => {
    const source = '<div id=""></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div
  id=""
></div>`);
  });

  test("formats nested blocks with final example", () => {
    const source = [
      '<div id="output">',
      '  <%= tag.div class: "div" do %>',
      '    <% if true %><span>OK</span><% else %><span>NO</span><% end %>',
      '  <% end %>',
      '</div>',
    ].join("\n");
    const result = formatter.format(source);
    expect(result).toEqual(`<div id="output">
  <%= tag.div class: "div" do %>
    <% if true %>
      <span>
        OK
      </span>
    <% else %>
      <span>
        NO
      </span>
    <% end %>
  <% end %>
</div>`);
  });

  test("formats case/when/else statements", () => {
    const source =
      '<div><% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div>
  <% case status %>
  <% when "ok" %>
    GOOD
  <% when "error" %>
    BAD
  <% else %>
    UNKNOWN
  <% end %>
</div>`);
});
});
