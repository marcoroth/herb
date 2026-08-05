# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class EngineTest < Minitest::Spec
    include SnapshotUtils

    test "basic compilation" do
      template = "<div>Hello <%= name %>!</div>"

      assert_compiled_snapshot(template)
    end

    test "compilation with escaping" do
      template = "<div><%= user_input %></div>"

      assert_compiled_snapshot(template, escape: true)
    end

    test "compilation without escaping" do
      template = "<div><%= user_input %></div>"

      assert_compiled_snapshot(template, escape: false)
    end

    test "compilation with freeze" do
      template = <<~ERB
        <div>Static content</div>
      ERB

      assert_compiled_snapshot(template, freeze: true)
    end

    test "erb control flow" do
      template = <<~ERB
        <% if active? %>
          <span>Active</span>
        <% else %>
          <span>Inactive</span>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "erb loops" do
      template = <<~ERB
        <% items.each do |item| %>
          <li><%= item %></li>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "html attributes" do
      template = <<~ERB
        <div class="container" id="main">Content</div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "erb in attributes" do
      template = <<~ERB
        <div class="<%= css_class %>" data-id="<%= item.id %>">Content</div>
      ERB

      assert_compiled_snapshot(template, escape: false)
    end

    test "engine properties" do
      template = "<div>Test</div>"

      engine = Herb::Engine.new(template, filename: "test.erb", bufvar: "output")

      assert_equal "test.erb", engine.filename.to_s
      assert_equal "output", engine.bufvar
    end

    test "compilation with custom bufvar" do
      template = "<div>Test</div>"

      assert_compiled_snapshot(template, bufvar: "output")
    end

    test "void elements" do
      template = <<~ERB
        <img src="photo.jpg" alt="Photo">
        <br>
        <input type="text" name="email">
      ERB

      assert_compiled_snapshot(template)
    end

    test "comments" do
      template = <<~ERB
        <!-- HTML comment -->
        <div>
          <%# ERB comment %>
          Content
        </div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "doctype" do
      template = <<~ERB
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
        </html>
      ERB

      assert_compiled_snapshot(template)
    end

    test "nested structures" do
      template = <<~ERB
        <div>
          <% if logged_in? %>
            <ul>
              <% items.each do |item| %>
                <li>
                  <% if item.featured? %>
                    <strong><%= item.name %></strong>
                  <% else %>
                    <%= item.name %>
                  <% end %>
                </li>
              <% end %>
            </ul>
          <% else %>
            <p>Please log in</p>
          <% end %>
        </div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "void element" do
      template = <<~ERB
        <input type="text" name="name" value="<%= @name %>" />
        <input type="text" name="name" value="<%= @name %>"/>
      ERB

      assert_compiled_snapshot(template)
    end

    test "if elsif else compilation" do
      template = File.read(File.expand_path("../../examples/if_else.html.erb", __dir__))

      assert_compiled_snapshot(template, escape: false)
    end

    test "conditional html element compilation" do
      template = File.read(File.expand_path("../../examples/conditional_html_element.html.erb", __dir__))

      assert_compiled_snapshot(template, escape: false)
    end

    test "heredoc with trailing arguments compiles to valid Ruby" do
      template = <<~ERB
        <%= method_call <<~GRAPHQL, variables
          query {
            field
          }
        GRAPHQL
        %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "heredoc in code tag compiles to valid Ruby" do
      template = <<~ERB
        <%
          text = <<~TEXT
            Hello, world!
          TEXT
        %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "heredoc in code tag inline compiles to valid Ruby" do
      template = <<~ERB
        <div><% text = <<~TEXT
            Hello, world!
          TEXT
        %></div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "heredoc with dash syntax in code tag compiles to valid Ruby" do
      template = <<~ERB
        <%
          text = <<-TEXT
            Hello, world!
          TEXT
        %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "heredoc with quoted identifier in code tag compiles to valid Ruby" do
      template = <<~ERB
        <%
          text = <<~'TEXT'
            Hello, world!
          TEXT
        %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "heredoc in escaped expression tag compiles to valid Ruby" do
      template = <<~ERB
        <%== method_call <<~GRAPHQL, variables
          query {
            field
          }
        GRAPHQL
        %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "validate_ruby passes for valid Ruby" do
      template = <<~ERB
        <% if true %>
          <div>Hello</div>
        <% end %>
      ERB

      engine = Herb::Engine.new(template, validate_ruby: true)
      assert engine.src
    end

    test "validate_ruby raises InvalidRubyError for invalid compiled Ruby" do
      engine = Herb::Engine.allocate
      engine.instance_variable_set(:@src, "def foo(")

      error = assert_raises(Herb::Engine::InvalidRubyError) do
        engine.send(:ensure_valid_ruby!, "def foo(")
      end

      assert_match(/Compiled template produced invalid Ruby/, error.message)
      assert error.compiled_source
    end

    test "validate_ruby does not raise for valid compiled Ruby" do
      engine = Herb::Engine.allocate
      engine.instance_variable_set(:@src, "def foo; end")

      engine.send(:ensure_valid_ruby!, "def foo; end")
    end

    test "CDATA section compiles correctly" do
      assert_compiled_snapshot("<![CDATA[ content ]]>", enforce_erubi_equality: true)
      assert_evaluated_snapshot("<![CDATA[ content ]]>")
    end

    test "CDATA section inside script compiles correctly" do
      assert_compiled_snapshot("<script><![CDATA[ alert(1) ]]></script>", enforce_erubi_equality: true)
      assert_evaluated_snapshot("<script><![CDATA[ alert(1) ]]></script>")
    end

    test "compilation with optimize for tag helper" do
      assert_compiled_snapshot('<%= tag.div class: "container" do %>Content<% end %>', optimize: true)
    end

    test "compilation with optimize for void element" do
      assert_compiled_snapshot("<%= tag.br %>", optimize: true)
    end

    test "compilation with optimize for tag with data attributes" do
      assert_compiled_snapshot('<%= tag.div data: { controller: "content", count: 42 } %>', optimize: true)
    end

    test "compilation with optimize for nested tag helpers" do
      assert_compiled_snapshot(<<~ERB, optimize: true)
        <%= tag.div class: "outer" do %>
          <%= tag.span "Inner" %>
        <% end %>
      ERB
    end

    test "compilation with optimize for link_to" do
      assert_compiled_snapshot('<%= link_to "Home", "/" %>', optimize: true)
    end

    test "compilation with optimize for image_tag" do
      assert_compiled_snapshot('<%= image_tag "photo.jpg", alt: "Photo" %>', optimize: true)
    end

    test "compilation with optimize for content_tag" do
      assert_compiled_snapshot('<%= content_tag :div, "Content", class: "box" %>', optimize: true)
    end

    test "compilation with optimize preserves non-helper ERB" do
      assert_compiled_snapshot(<<~ERB, optimize: true)
        <h1><%= title %></h1>
        <%= tag.div class: "content" do %>
          <p><%= body %></p>
        <% end %>
      ERB
    end

    test "compilation with optimize for tag with dynamic attribute" do
      assert_compiled_snapshot("<%= tag.div class: css_class %>", optimize: true)
    end

    test "compilation without optimize leaves tag helpers as Ruby calls" do
      template = '<%= tag.div class: "container" do %>Content<% end %>'

      without_optimize = Herb::Engine.new(template).src
      with_optimize = Herb::Engine.new(template, optimize: true).src

      refute_equal without_optimize, with_optimize
      assert_includes without_optimize, "tag.div"
      refute_includes with_optimize, "tag.div"
    end

    test "compilation with parser_options strict false" do
      assert_compiled_snapshot("<div>Hello</div>", parser_options: { strict: false })
    end
  end
end
