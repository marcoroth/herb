# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class AttributesTest < Minitest::Spec
    include SnapshotUtils

    test "attributes" do
      assert_parsed_snapshot(%(<div id="hello" class="container p-3"></div>))
    end

    test "attribute with dashed name" do
      assert_parsed_snapshot(%(<div data-id="1"></div>))
    end

    test "duplicate attributes" do
      assert_parsed_snapshot(%(<div class="hello" class="container p-3"></div>))
    end

    test "attribute with no quotes value and whitespace and self-closing tag" do
      assert_parsed_snapshot("<img value=hello />")
    end

    test "attribute with no quotes value, no whitespace and self-closing tag" do
      assert_parsed_snapshot("<img value=hello/>")
    end

    test "attribute with no quotes value, no whitespace, and non self-closing tag" do
      assert_parsed_snapshot("<div value=hello>")
    end

    test "attribute value with space after equal sign" do
      assert_parsed_snapshot(%(<input value= "value" />))
    end

    test "attribute value with space before equal sign" do
      assert_parsed_snapshot(%(<input value ="value" />))
    end

    test "attribute value with space before and after equal sign" do
      assert_parsed_snapshot(%(<div class    =    "hello">Content</div>))
    end

    test "attribute value with newline before equal sign" do
      assert_parsed_snapshot(%(<input value
="value" />))
    end

    test "attribute value with newline after equal sign" do
      assert_parsed_snapshot(%(<input value=
"value" />))
    end

    test "attribute value with newline before and after equal sign" do
      assert_parsed_snapshot(%(<input value
=
"value" />))
    end

    test "attribute value with mixed whitespace and newlines around equal sign" do
      assert_parsed_snapshot(%(<div class
  =
  "hello">Content</div>))
    end

    test "attribute value with exclamation point" do
      assert_parsed_snapshot(%(<input value="Hello!" />))
    end

    test "style attribute with url" do
      assert_parsed_snapshot(%(<div style="background-image: url('./images/image.png')"></div>))
    end

    test "double quotes inside single quotes" do
      assert_parsed_snapshot(%(<div data-json='{"key": "value"}'></div>))
    end

    test "multiple nested quotes" do
      assert_parsed_snapshot(%(<div title="She said 'Hello' and 'Goodbye'"></div>))
    end

    test "apostrophe inside single quotes" do
      assert_parsed_snapshot(%(<div data-msg='Don't worry'>Text</div>))
    end

    test "escaped apostrophe inside single quotes" do
      assert_parsed_snapshot(%(<div data-msg='Don\\'t worry'>Text</div>))
    end

    test "escaped double quote inside double quotes" do
      assert_parsed_snapshot(%(<div data-msg="She said \\"Hello\\"">Text</div>))
    end

    test "empty quoted attribute values" do
      assert_parsed_snapshot(%(<input value="" placeholder='' />))
    end

    test "mixed quote types in multiple attributes" do
      assert_parsed_snapshot(%(<input value="double quoted" placeholder='single quoted' />))
    end

    test "erb output with quotes" do
      assert_parsed_snapshot(%(<div title="<%= "quoted string" %>"></div>))
    end

    test "attributes with dots in name" do
      assert_parsed_snapshot(%(<div x-transition.duration.500ms x-show="visible" x-cloak></div>))
    end

    test "complex attribute with dots and values" do
      assert_parsed_snapshot(%(<div x-transition.duration.500ms="fast" data-component.option="value"></div>))
    end

    test "attributes starting with @ symbol" do
      assert_parsed_snapshot(%(<div @click="handleClick" @keyup.enter="submit"></div>))
    end

    test "@ attributes with various patterns" do
      assert_parsed_snapshot(%(<div @submit.prevent @change.debounce.100ms="update" @mouseover></div>))
    end

    test "standalone @ symbol in div tag" do
      assert_parsed_snapshot(%(<div @></div>))
    end

    test "standalone @ symbol followed by whitesapce in div tag" do
      assert_parsed_snapshot(%(<div @ ></div>))
    end

    test "standalone @ symbol followed by whitesapce and identifier in div tag" do
      assert_parsed_snapshot(%(<div @ click></div>))
    end

    test "standalone @ symbol in div tag followed by attribute" do
      assert_parsed_snapshot(%(<div @ data-attribute="test"></div>))
    end

    test "atttribute with @ prefix and now value" do
      assert_parsed_snapshot(%(<div @click></div>))
    end

    test "attribute with backtick quotes (invalid)" do
      assert_parsed_snapshot(%(<div class=`hello`></div>))
    end

    test "attribute with backtick quotes and whitespace (invalid)" do
      assert_parsed_snapshot(%(<div class=`hello world`></div>))
    end

    test "multiple attributes with mixed quotes including backticks (invalid)" do
      assert_parsed_snapshot(%(<div class="valid" id=`invalid` data-test='also-valid'></div>))
    end

    test "self-closing tag with backtick attribute (invalid)" do
      assert_parsed_snapshot(%(<img src=`image.jpg` />))
    end

    test "attribute with backtick containing HTML (invalid)" do
      assert_parsed_snapshot(%(<div data-template=`<span>Hello</span>`></div>))
    end

    test "Vue-style directive attribute with value" do
      assert_parsed_snapshot(%(<div :value="something"></div>))
    end

    test "Vue-style directive attributes multiple" do
      assert_parsed_snapshot(%(<input :model="user" :disabled="isDisabled" :class="className"></input>))
    end

    test "Vue-style directive attribute without value" do
      assert_parsed_snapshot(%(<div :disabled></div>))
    end

    test "Mixed Vue directives and regular attributes" do
      assert_parsed_snapshot(%(<div id="app" :class="dynamicClass" data-test="static"></div>))
    end

    test "Standalone colon with space is invalid" do
      assert_parsed_snapshot(%(<div : class="hello"></div>))
    end

    test "Colon immediately followed by attribute name is valid" do
      assert_parsed_snapshot(%(<div :class="hello"></div>))
    end

    test "Double colon is invalid" do
      assert_parsed_snapshot(%(<div ::value="hello"></div>))
    end

    test "Vue directive with namespace-like syntax" do
      assert_parsed_snapshot(%(<div :v-model="user"></div>))
    end

    test "Empty attribute value with closing bracket immediatly following it" do
      assert_parsed_snapshot(%(<div attribute-name=>div-content</div>))
    end

    # https://github.com/marcoroth/herb/issues/856#issuecomment-3525179643
    test "Conditional attribute with ERB control flow and no surrounding spaces" do
      assert_parsed_snapshot(%(<dialog data-controller="dialog" <% if local_assigns[:permanent] %>data-turbo-permanent<% end %>></dialog>))
    end

    test "Conditional attribute with ERB control flow with surrounding spaces" do
      assert_parsed_snapshot(%(<dialog data-controller="dialog" <% if local_assigns[:permanent] %> data-turbo-permanent <% end %>></dialog>))
    end

    test "Conditional attribute with ERB on separate line" do
      assert_parsed_snapshot <<~HTML
        <span
          <% if @replaceable %>data-menu-button<% end %>
          class="css-truncate css-truncate-target"
        ></span>
      HTML
    end

    test "Conditional attribute with value" do
      assert_parsed_snapshot(%(<div <% if enabled? %>data-enabled="true"<% end %>></div>))
    end

    test "Multiple conditional attributes" do
      assert_parsed_snapshot(%(<div <% if a? %>data-a<% end %> <% if b? %>data-b<% end %>></div>))
    end

    test "Conditional attribute with elsif and else" do
      assert_parsed_snapshot(%(<div <% if primary? %>data-primary<% elsif secondary? %>data-secondary<% else %>data-default<% end %>></div>))
    end

    test "Conditional attribute with unless" do
      assert_parsed_snapshot(%(<div <% unless disabled? %>data-enabled<% end %>></div>))
    end

    test "Multiple attributes in one conditional block" do
      assert_parsed_snapshot(%(<div <% if admin? %>data-admin data-role="admin"<% end %>></div>))
    end

    test "Conditional boolean attribute" do
      assert_parsed_snapshot(%(<input <% if should_disable? %>disabled<% end %> type="text">))
    end

    test "Conditional attribute with output tag inside" do
      assert_parsed_snapshot(%(<div <% if user %>data-user="<%= user.id %>"<% end %>></div>))
    end

    test "ERB comment between attributes" do
      assert_parsed_snapshot(%(<div data-foo="bar" <%# This is a comment %> data-baz="qux"></div>))
    end

    test "Conditional attribute with trimming tags" do
      assert_parsed_snapshot(%(<div <%- if condition -%>data-conditional<%- end -%>></div>))
    end

    test "Empty conditional block in attributes" do
      assert_parsed_snapshot(%(<div data-static <% if false %><% end %> data-other="value"></div>))
    end

    test "Nested conditional attributes" do
      assert_parsed_snapshot(%(<div <% if outer? %><% if inner? %>data-inner<% end %><% end %>></div>))
    end

    test "attribute name with non-output ERB" do
      assert_parsed_snapshot(%(<div data-<% key %>-target="value"></div>))
    end

    test "attribute name with ERB trim" do
      assert_parsed_snapshot(%(<div data-<%- key -%>-id="thing"></div>))
    end

    test "attribute name with ERB comment" do
      assert_parsed_snapshot(%(<div data-<%# comment %>-target="value"></div>))
    end

    test "multiple non-ERB outputs in attribute names" do
      assert_parsed_snapshot(%(<div data-<% key %>-target="value" id-<% another %>-suffix="test"></div>))
    end

    test "mixed ERB output types in multiple attribute names" do
      assert_parsed_snapshot(%(
        <div
          data-<%= valid_key %>-target="value"
          prefix-<% invalid_key %>-id="test"
          class="<%= valid_class %>"
        ></div>
      ))
    end

    test "ERB in attribute names within form elements" do
      assert_parsed_snapshot(%(
        <form>
          <input data-<%= user.id %>-field="text">
          <button data-<% collection %>-list="options"></button>
          <select prefix-<%# comment %>-suffix="value"></select>
        </form>
      ))
    end

    test "if/elsif/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%if a?%>data-one<%elsif b?%>data-two<%else%>data-three<%end%>></div>))
    end

    test "if/elsif/elsif/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%if a?%>data-one<%elsif b?%>data-two<%elsif c?%>data-three<%else%>data-four<%end%>></div>))
    end

    test "if/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%if a?%>data-one<%else%>data-two<%end%>></div>))
    end

    test "if/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%if a?%>data-one<%end%>></div>))
    end

    test "unless/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%unless a?%>data-one<%else%>data-two<%end%>></div>))
    end

    test "unless/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%unless a?%>data-one<%end%>></div>))
    end

    test "case/when/when/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%case x%><%when 1%>data-one<%when 2%>data-two<%end%>></div>))
    end

    test "case/when/when/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%case x%><%when 1%>data-one<%when 2%>data-two<%else%>data-default<%end%>></div>))
    end

    test "case/when/when/when/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%case x%><%when 1%>data-one<%when 2%>data-two<%when 3%>data-three<%end%>></div>))
    end

    test "case/in/in/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%case x%><%in 1%>data-one<%in 2%>data-two<%end%>></div>))
    end

    test "case/in/in/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%case x%><%in 1%>data-one<%in 2%>data-two<%else%>data-default<%end%>></div>))
    end

    test "begin/rescue/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%begin%>data-one<%rescue%>data-error<%end%>></div>))
    end

    test "begin/rescue/else/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%begin%>data-one<%rescue%>data-error<%else%>data-success<%end%>></div>))
    end

    test "begin/rescue/ensure/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%begin%>data-one<%rescue%>data-error<%ensure%>data-always<%end%>></div>))
    end

    test "begin/rescue/else/ensure/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%begin%>data-one<%rescue%>data-error<%else%>data-success<%ensure%>data-always<%end%>></div>))
    end

    test "begin/ensure/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%begin%>data-one<%ensure%>data-always<%end%>></div>))
    end

    test "while/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%while cond%>data-item<%end%>></div>))
    end

    test "until/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%until done%>data-item<%end%>></div>))
    end

    test "for/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%for i in items%>data-item<%end%>></div>))
    end

    test "block do/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%items.each do%>data-item<%end%>></div>))
    end

    test "block do with args/end control flow in attributes (no spaces)" do
      assert_parsed_snapshot(%(<div <%items.each do |item|%>data-item<%end%>></div>))
    end

    test "issue #1063: conditional boolean attribute open (no spaces around attribute)" do
      assert_parsed_snapshot(%(<details <% if @doc.registration_id.present? %>open<% end %>></details>))
    end

    test "issue #1063: conditional boolean attribute open (space after attribute)" do
      assert_parsed_snapshot(%(<details <% if @doc.registration_id.present? %>open <% end %>></details>))
    end

    test "issue #1063: conditional boolean attribute open (space before attribute)" do
      assert_parsed_snapshot(%(<details <% if @doc.registration_id.present? %> open<% end %>></details>))
    end

    test "issue #1063: conditional boolean attribute open (spaces around attribute)" do
      assert_parsed_snapshot(%(<details <% if @doc.registration_id.present? %> open <% end %>></details>))
    end

    test "issue #1063: two conditional attributes back-to-back (with spaces)" do
      assert_parsed_snapshot(%(<details <% if a? %> open <% end %> <% if b? %>style='color: red;'<% end %> ></details>))
    end

    test "issue #1063: two conditional attributes back-to-back (no spaces)" do
      assert_parsed_snapshot(%(<details <% if a? %>open<% end %><% if b? %>style='color: red;'<% end %>></details>))
    end

    test "multiple regular attributes before conditional" do
      assert_parsed_snapshot(%(<div id="main" class="container" <% if active? %>data-active<% end %>></div>))
    end

    test "multiple regular attributes after conditional" do
      assert_parsed_snapshot(%(<div <% if active? %>data-active<% end %> id="main" class="container"></div>))
    end

    test "conditional attribute between regular attributes" do
      assert_parsed_snapshot(%(<div id="main" <% if active? %>data-active<% end %> class="container"></div>))
    end

    test "conditional attribute with value between regular attributes" do
      assert_parsed_snapshot(%(<div id="main" <% if active? %>data-active="true"<% end %> class="container"></div>))
    end

    test "nested conditionals in attributes" do
      assert_parsed_snapshot(%(<div <% if outer? %><% if inner? %>data-inner<% else %>data-outer<% end %><% end %>></div>))
    end

    test "conditional with multiple attributes inside" do
      assert_parsed_snapshot(%(<div <% if admin? %>data-admin data-role="admin" data-permissions="all"<% end %>></div>))
    end

    test "conditional with ERB output in attribute value" do
      assert_parsed_snapshot(%(<div <% if user? %>data-user-id="<%= user.id %>" data-user-name="<%= user.name %>"<% end %>></div>))
    end

    test "self-closing tag with conditional attribute" do
      assert_parsed_snapshot(%(<input type="text" <% if required? %>required<% end %> />))
    end

    test "self-closing tag with conditional attribute and value" do
      assert_parsed_snapshot(%(<input type="text" <% if has_value? %>value="<%= default_value %>"<% end %> />))
    end

    test "void element with conditional attribute" do
      assert_parsed_snapshot(%(<img src="image.png" <% if lazy? %>loading="lazy"<% end %>>))
    end

    test "conditional class attribute with ternary in value" do
      assert_parsed_snapshot(%(<div <% if styled? %>class="<%= active ? 'active' : 'inactive' %>"<% end %>></div>))
    end

    test "attribute value with equals sign" do
      assert_parsed_snapshot('<meta content="width=device-width">')
    end

    test "attribute value with multiple equals signs" do
      assert_parsed_snapshot('<meta content="a=b=c=d">')
    end

    test "viewport meta tag with equals in value" do
      assert_parsed_snapshot('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    end

    test "href with query string" do
      assert_parsed_snapshot('<a href="/path?foo=bar&baz=qux">Link</a>')
    end

    test "data attribute with equals in value" do
      assert_parsed_snapshot('<div data-formula="x=y+z">Content</div>')
    end

    test "style attribute with calc and equals" do
      assert_parsed_snapshot('<div style="--custom-prop: calc(100% - 20px)">Content</div>')
    end

    test "attribute value with ERB assignment" do
      assert_parsed_snapshot('<div data-config="<%= value = 5 %>">Content</div>')
    end

    test "attribute with equals but no value" do
      assert_parsed_snapshot("<div data-attribute=></div>")
    end

    test "attribute with equals and space but no value" do
      assert_parsed_snapshot("<div data-attribute= ></div>")
    end

    test "attribute with equals, space, and empty quoted value" do
      assert_parsed_snapshot('<div data-attribute= ""></div>')
    end

    test "attribute with equals followed by new tag start" do
      assert_parsed_snapshot("<div class=<span>test</span></div>")
    end

    test "attribute with equals and space followed by new tag start" do
      assert_parsed_snapshot("<div class= <span>test</span></div>")
    end

    test "attribute with equals at EOF" do
      assert_parsed_snapshot("<div class=")
    end

    test "attribute with equals and space at EOF" do
      assert_parsed_snapshot("<div class= ")
    end

    test "multiple attributes with missing values" do
      assert_parsed_snapshot("<div class= id= ></div>")
    end

    test "attribute with equals followed by closing tag" do
      assert_parsed_snapshot("<div class=</div>")
    end

    test "issue #1211: attribute value with backslash" do
      assert_parsed_snapshot('<button data-shortcut="S,s,\">S \</button>')
    end
  end
end
