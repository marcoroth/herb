# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class ERBTest < Minitest::Spec
    include SnapshotUtils

    test "erb <% %>" do
      assert_lexed_snapshot(%(<% 'hello world' %>))
    end

    test "erb <%= %>" do
      assert_lexed_snapshot(%(<%= "hello world" %>))
    end

    test "erb <%- %>" do
      assert_lexed_snapshot(%(<%- "Test" %>))
    end

    test "erb <%- -%>" do
      assert_lexed_snapshot(%(<%- "Test" -%>))
    end

    test "erb <%# %>" do
      assert_lexed_snapshot(%(<%# "Test" %>))
    end

    test "erb <%% %%>" do
      assert_lexed_snapshot(%(<%% "Test" %%>))
    end

    test "erb <%%= %%>" do
      assert_lexed_snapshot(%(<%%= "Test" %%>))
    end

    test "erb output inside HTML attribute value" do
      assert_lexed_snapshot(%(<article id="<%= dom_id(article) %>"></article>))
    end

    test "erb output inside HTML attribute value with value before" do
      assert_lexed_snapshot(%(<div class="bg-black <%= "text-white" %>"></div>))
    end

    test "erb output inside HTML attribute value with value before and after" do
      assert_lexed_snapshot(%(<div class="bg-black <%= "text-white" %> cursor-pointer"></div>))
    end

    test "erb output inside HTML attribute value with value and after" do
      assert_lexed_snapshot(%(<div class="<%= "text-white" %> bg-black"></div>))
    end

    test "multi-line erb content" do
      assert_lexed_snapshot(<<~HTML)
        <%=
          hello
        %>
      HTML
    end

    test "multi-line erb content with complex ruby" do
      assert_lexed_snapshot(<<~HTML)
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
      assert_lexed_snapshot(<<~HTML)
        <%
          x = 1
          y = 2
        %>
      HTML
    end
  end
end
