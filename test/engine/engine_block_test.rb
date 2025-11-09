# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class EngineBlockTest < Minitest::Spec
    include SnapshotUtils

    test "erb block expressions generate correct code without parentheses" do
      template = '<%= link_to "/path", class: "btn" do %>Click me<% end %>'

      assert_compiled_snapshot(template)
    end

    test "erb block expressions with escaping" do
      template = "<%== form_for @user do %>Form content<% end %>"

      assert_compiled_snapshot(template, escape: false)
    end

    test "regular erb expressions have parentheses" do
      template = "<%= user.name %>"

      assert_compiled_snapshot(template)
    end

    test "escaped expressions use correct escape function" do
      template = '<%== "<script>alert(1)</script>" %>'

      assert_compiled_snapshot(template, escape: false)
    end

    test "escape function reference uses Herb::Engine" do
      template = "<%== content %>"
      assert_compiled_snapshot(template, escape: false)

      template = "<%= content %>"
      assert_compiled_snapshot(template, escape: true)
    end

    test "context-aware escaping for attributes" do
      template = '<div class="<%= css_class %>">Content</div>'

      assert_compiled_snapshot(template)
    end

    test "script context escaping" do
      template = "<script>var data = <%= json_data %>;</script>"

      assert_compiled_snapshot(template)
    end

    test "style context escaping" do
      template = "<style>.class { color: <%= color %>; }</style>"

      assert_compiled_snapshot(template)
    end

    test "security error includes file location" do
      template = '<div <%= "class=btn" %>>Test</div>'

      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(template, filename: "app/views/test.erb")
      end

      assert_includes error.message, "app/views/test.erb"
      assert_includes error.message, "ERB output tags"
      assert_equal "app/views/test.erb", error.filename.to_s
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test "html comments are optimized to single text token" do
      template = "<!-- This is a comment with multiple words -->"

      assert_compiled_snapshot(template)
    end

    test "doctype is optimized to single text token" do
      template = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN">'

      assert_compiled_snapshot(template)
    end

    test "erb control structures work correctly" do
      template = <<~ERB
        <% 5.times do |i| %>
          <div><%= i %></div>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "erb case statements compile correctly" do
      template = <<~ERB
        <% case status %>
        <% when :active %>
          <span>Active</span>
        <% when :pending %>
          <span>Pending</span>
        <% else %>
          <span>Unknown</span>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
    end
  end
end
