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
  end
end
