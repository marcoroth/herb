# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class EngineBlockTest < Minitest::Spec
    test "erb block expressions generate correct code without parentheses" do
      template = '<%= link_to "/path", class: "btn" do %>Click me<% end %>'
      engine = Herb::Engine.new(template)

      refute_includes engine.src, '(link_to "/path", class: "btn" do'
      assert_includes engine.src, '<< link_to "/path", class: "btn" do'
    end

    test "erb block expressions with escaping" do
      template = "<%== form_for @user do %>Form content<% end %>"
      engine = Herb::Engine.new(template, escape: false)

      assert_includes engine.src, "::Herb::Engine.h(form_for @user do)"
      refute_includes engine.src, "::Herb::Engine.h((form_for @user do"
    end

    test "regular erb expressions have parentheses" do
      template = "<%= user.name %>"
      engine = Herb::Engine.new(template)

      assert_includes engine.src, "(user.name).to_s"
    end

    test "escaped expressions use correct escape function" do
      template = '<%== "<script>alert(1)</script>" %>'
      engine = Herb::Engine.new(template, escape: false)

      assert_includes engine.src, '::Herb::Engine.h(("<script>alert(1)</script>"))'
    end

    test "escape function reference uses Herb::Engine" do
      template = "<%== content %>"
      engine = Herb::Engine.new(template, escape: false)
      assert_includes engine.src, "::Herb::Engine.h"

      template = "<%= content %>"
      engine = Herb::Engine.new(template, escape: true)
      assert_includes engine.src, "__herb = ::Herb::Engine"
      assert_includes engine.src, "__herb.h"
    end

    test "context-aware escaping for attributes" do
      template = '<div class="<%= css_class %>">Content</div>'
      engine = Herb::Engine.new(template)

      assert_includes engine.src, "::Herb::Engine.attr"
    end

    test "script context escaping" do
      template = "<script>var data = <%= json_data %>;</script>"
      engine = Herb::Engine.new(template)

      assert_includes engine.src, "::Herb::Engine.js"
    end

    test "style context escaping" do
      template = "<style>.class { color: <%= color %>; }</style>"
      engine = Herb::Engine.new(template)

      assert_includes engine.src, "::Herb::Engine.css"
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
      engine = Herb::Engine.new(template)

      assert_equal 1, engine.src.scan("<< '").count
    end

    test "doctype is optimized to single text token" do
      template = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN">'
      engine = Herb::Engine.new(template)

      assert_equal 1, engine.src.scan("<< '").count
    end

    test "erb control structures work correctly" do
      template = <<~ERB
        <% 5.times do |i| %>
          <div><%= i %></div>
        <% end %>
      ERB

      engine = Herb::Engine.new(template)
      assert_includes engine.src, "5.times do |i|"
      assert_includes engine.src, "end;"
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

      engine = Herb::Engine.new(template)
      assert_includes engine.src, "case status"
      assert_includes engine.src, "when :active"
      assert_includes engine.src, "when :pending"
      assert_includes engine.src, "else"
    end
  end
end
