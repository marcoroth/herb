# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBTest < Minitest::Spec
    include SnapshotUtils

    test "interpolate on top level" do
      assert_parsed_snapshot(%(<%= hello %>))
    end

    test "interpolate in element body" do
      assert_parsed_snapshot(%(<h1><%= hello %></h1>))
    end

    test "interpolate in element body followed by text content" do
      assert_parsed_snapshot(%(<h1><%= Hello %> World</h1>))
    end

    test "interpolate in element body after text content" do
      assert_parsed_snapshot(%(<h1>Hello <%= World %></h1>))
    end

    test "interpolate in element body surrounded by text content" do
      assert_parsed_snapshot(%(<h1>Hello <%= World %> Hello</h1>))
    end

    test "interpolate inside tag" do
      assert_parsed_snapshot(%(<h1 <%= "id=test" %>></h1>))
    end

    test "interpolate inside attribute value" do
      assert_parsed_snapshot(%(<h1 id="<%= "test" %>"></h1>))
    end

    test "interpolate after attribute name" do
      assert_parsed_snapshot(%(<h1 id=<%= "test" %>></h1>))
    end

    test "attribute name from erb" do
      assert_parsed_snapshot(%(<img <%= key %>="true">))
    end

    test "attribute name with erb interpolation" do
      assert_parsed_snapshot(%(<img data-<%= key %>-name="example">))
    end

    test "attribute name with erb interpolation after" do
      assert_parsed_snapshot(%(<img data-<%= key %>="example">))
    end

    test "attribute name with erb interpolation before" do
      assert_parsed_snapshot(%(<img <%= key %>-value="example">))
    end

    test "interpolate inside attribute value with static content before" do
      assert_parsed_snapshot(%(<h1 class="text-white <%= "bg-black" %>"></h1>))
    end

    test "interpolate inside attribute value with static content after" do
      assert_parsed_snapshot(%(<h1 class="<%= "bg-black" %> text-white"></h1>))
    end

    test "interpolate inside attribute value with static content around" do
      assert_parsed_snapshot(%(<h1 class="text-white <%= "bg-black" %> title"></h1>))
    end

    test "interpolate inside comment" do
      assert_parsed_snapshot(%(<!-- <%= "Comment" %> -->))
    end

    test "conditional tags" do
      assert_parsed_snapshot(%(<div><% if bold? %><b><%= title %></b><% else %><b><%= title %></b><% end %></div>))
    end

    test "conditional attributes" do
      assert_parsed_snapshot(%(<div <% if odd? %> data-odd=true <% else %> data-odd=false <% end %>></div>))
    end

    test "comment" do
      assert_parsed_snapshot(%(<%# comment with a single qutote(') and double quote (") %>))
    end

    test "multi-line comment" do
      assert_parsed_snapshot(<<~HTML)
        <%#
          comment
        %>
      HTML
    end

    test "multi-line comment with Ruby keyword" do
      assert_parsed_snapshot(<<~HTML)
        <%#
          end
        %>
      HTML
    end

    test "erb output wrapped in double quotes" do
      assert_parsed_snapshot(<<~HTML)
        "<%= value %>"
      HTML
    end

    test "erb output wrapped in single quotes" do
      assert_parsed_snapshot(<<~HTML)
        '<%= value %>'
      HTML
    end

    test "erb output wrapped in double quotes inside if" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
          "<%= value %>"
        <% end %>
      HTML
    end

    test "erb output wrapped in single quotes inside if" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
          '<%= value %>'
        <% end %>
      HTML
    end

    test "multi-line erb content" do
      assert_parsed_snapshot(<<~HTML)
        <%=
          hello
        %>
      HTML
    end

    test "multi-line erb content with complex ruby" do
      assert_parsed_snapshot(<<~HTML)
        <%=
          if condition
            "value1"
          else
            "value2"
          end
        %>
      HTML
    end

    test "multi-line erb silent tag" do
      assert_parsed_snapshot(<<~HTML)
        <%
          x = 1
          y = 2
        %>
      HTML
    end

    test "multi-line erb comment" do
      assert_parsed_snapshot(<<~HTML)
        <%#
          This is a comment
          across multiple lines
        %>
      HTML
    end

    test "erb comment with equals sign" do
      assert_parsed_snapshot(%(<%#= link_to "New watch list", new_watch_list_path, class: "btn btn-ghost" %>))
    end

    test "erb comment with equals sign without spaces" do
      assert_parsed_snapshot(%(<%#=link_to "New watch list", new_watch_list_path, class: "btn btn-ghost"%>))
    end

    test "multi-line erb comment with equals sign" do
      assert_parsed_snapshot(<<~HTML)
        <%#=
          link_to "New watch list",
          new_watch_list_path,
          class: "btn btn-ghost"
        %>
      HTML
    end

    test "erb output with =%> close tag" do
      assert_parsed_snapshot(%(<%= "hello" =%>))
    end

    test "erb if with =%> close tag" do
      assert_parsed_snapshot(<<~HTML)
        <% if true =%>
          <p>Content</p>
        <% end =%>
      HTML
    end

    test "erb if-elsif-else with =%> close tag" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition =%>
          <p>True</p>
        <% elsif other =%>
          <p>Other</p>
        <% else =%>
          <p>False</p>
        <% end =%>
      HTML
    end

    test "unterminated erb missing closing %>" do
      assert_parsed_snapshot(%(<% if true))
    end

    test "unterminated erb missing closing >" do
      assert_parsed_snapshot(%(<% if true %))
    end

    test "erb tag followed by literal closing delimiter" do
      assert_parsed_snapshot(%(<% content %> %>))
    end

    test "incomplete erb tag" do
      assert_parsed_snapshot(%(<%= 1 + %>))
    end

    test "if without condition" do
      assert_parsed_snapshot(<<~HTML)
        <% if %>
        <% end %>
      HTML
    end

    test "inline ruby comment on same line" do
      assert_parsed_snapshot(%(<% if true %><% # Comment here %><% end %>))
    end

    test "inline ruby comment with newline" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %><% # Comment here %>
        <% end %>
      HTML
    end

    test "inline ruby comment between code" do
      assert_parsed_snapshot(%(<% if true %><% # Comment here %><%= hello %><% end %>))
    end

    test "inline ruby comment before and between code" do
      assert_parsed_snapshot(%(<% # Comment here %><% if true %><% # Comment here %><%= hello %><% end %>))
    end

    test "inline ruby comment with spaces" do
      assert_parsed_snapshot(%(<%  # Comment %> <% code %>))
    end

    test "inline ruby comment multiline" do
      assert_parsed_snapshot(<<~HTML)
        <% # Comment
        more %> <% code %>
      HTML
    end
  end
end
