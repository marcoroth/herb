# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class BlockCommentsTest < Minitest::Spec
    include SnapshotUtils

    test "ruby block comments with =begin and =end multiline" do
      template = <<~ERB
        <%
        =begin %>
          This, while unusual, is a legal form of commenting.
        <%
        =end %>
        <div>Hey there</div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "ruby block comments inside erb tags" do
      template = <<~ERB
        <%
        =begin
        This is a comment
        =end
        %>
        <p>Content</p>
      ERB

      assert_compiled_snapshot(template)
    end

    test "ruby block comments with code before and after" do
      template = <<~ERB
        <% x = 1 %>
        <%
        =begin
        Multi-line comment
        spanning multiple lines
        =end
        %>
        <% y = 2 %>
        <div><%= x + y %></div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "evaluation: ruby block comments with =begin and =end mutliline" do
      template = <<~ERB
        <%
        =begin %>
          This, while unusual, is a legal form of commenting.
        <%
        =end %>
        <div>Hey there</div>
      ERB

      assert_evaluated_snapshot(template)
    end

    test "evaluation: ruby block comments inside erb tags" do
      template = <<~ERB
        <%
        =begin
        This is a comment
        =end
        %>
        <p>Content</p>
      ERB

      assert_evaluated_snapshot(template)
    end

    test "evaluation: ruby block comments with code before and after" do
      template = <<~ERB
        <% x = 1 %>
        <%
        =begin
        Multi-line comment
        spanning multiple lines
        =end
        %>
        <% y = 2 %>
        <div><%= x + y %></div>
      ERB

      assert_evaluated_snapshot(template, { x: 1, y: 2 })
    end

    test "ruby block comments with =begin and =end mutliline and no space before ERB closing tag" do
      template = <<~ERB
        <%
        =begin%>
          This, while unusual, is a legal form of commenting.
        <%
        =end%>
        <div>Hey there</div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template)
    end
  end
end
