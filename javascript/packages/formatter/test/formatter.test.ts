import { describe, test, expect, beforeAll } from "vitest";
import { Herb } from "@herb-tools/node";
import { HerbFormatter } from "../src";

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load();
  });

  test("formats simple HTML with ERB content", () => {
    const formatter = new HerbFormatter(Herb);
    const source = '<div><%= "Hello" %></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div>
  <%= "Hello" %>
</div>`);
  });

  test("respects indentWidth option", () => {
    const formatter = new HerbFormatter(Herb);
    const source = '<div><%= "World" %></div>';
    const result = formatter.format(source, { indentWidth: 4 });
    expect(result).toEqual(`<div>
    <%= "World" %>
</div>`);
  });

  test("wraps multiple attributes correctly", () => {
    const formatter = new HerbFormatter(Herb);
    const source = '<div class="foo" id="bar"></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div
  class="foo"
  id="bar"
></div>`);
  });

  test("does not wrap single attribute", () => {
    const formatter = new HerbFormatter(Herb);
    const source = '<div class="foo"></div>';
    const result = formatter.format(source);
    expect(result).toEqual('<div class="foo"></div>');
  });

  test("wraps long text content at maxLineLength threshold", () => {
    const formatter = new HerbFormatter(Herb);
    const longText =
      'This is a very long line of text that should be broken into multiple lines by the formatter based on the maxLineLength option.';
    const source = `<p>${longText}</p>`;
    const result = formatter.format(source, { maxLineLength: 40 });
    expect(result).toEqual(`<p>
  This is a very long line of text that
  should be broken into multiple lines
  by the formatter based on the
  maxLineLength option.
</p>`);
  });

  test("formats ERB for/in loops with nested HTML", () => {
    const formatter = new HerbFormatter(Herb);
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
    const formatter = new HerbFormatter(Herb);
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
    const formatter = new HerbFormatter(Herb);
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
    const formatter = new HerbFormatter(Herb);
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
    const formatter = new HerbFormatter(Herb);
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
    const formatter = new HerbFormatter(Herb);
    const source = '<% title %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<% title %>`);
  });

  test("formats HTML comments and ERB comments", () => {
    const formatter = new HerbFormatter(Herb);
    const source =
      '<!-- HTML Comment --><%# ERB Comment %>';
    const result = formatter.format(source);
    expect(result).toEqual(`<!-- HTML Comment -->
<%# ERB Comment %>`);
  });

  test("formats doctype with ERB inside", () => {
    const formatter = new HerbFormatter(Herb);
    const source = '<!DoCTyPe <% hello %> hello>';
    const result = formatter.format(source);
    expect(result).toEqual(`<!DoCTyPe <% hello %> hello>`);
  });

  test("formats tags with empty attribute values", () => {
    const formatter = new HerbFormatter(Herb);
    const source = '<div id=""></div>';
    const result = formatter.format(source);
    expect(result).toEqual(`<div
  id=""
></div>`);
  });

  test("formats nested blocks with final example", () => {
    const formatter = new HerbFormatter(Herb);
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
});
