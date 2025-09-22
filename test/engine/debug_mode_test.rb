# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class DebugModeTest < Minitest::Spec
    include SnapshotUtils

    test "debug mode disabled by default" do
      template = "<h1>Hello <%= @name %>!</h1>"

      engine = Herb::Engine.new(template)
      refute engine.debug
      refute_includes engine.src, "data-herb-debug"
      refute_includes engine.src, "erb-value"
    end

    test "debug mode enabled" do
      template = "<h1>Hello <%= @name %>!</h1>"

      engine = Herb::Engine.new(template, debug: true)
      assert engine.debug
    end

    test "debug mode options" do
      template = "<div>Test</div>"

      engine = Herb::Engine.new(template,
                                debug: true,
                                filename: "app/views/test.html.erb")

      assert engine.debug
      assert_equal "app/views/test.html.erb", engine.filename.to_s
    end

    test "visible erb expression gets debug span" do
      template = "<h1>Welcome <%= @user.name %>!</h1>"

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "multiple visible erb expressions get debug spans" do
      template = "<h1>Hello <%= @name %> on <%= Date.today %>!</h1>"

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "attribute erb expressions do NOT get debug spans" do
      template = '<div class="<%= css_class %>" data-id="<%= @user.id %>">Content</div>'

      engine = Herb::Engine.new(template, debug: true, filename: "test.html.erb")

      refute_includes engine.src, "erb-value"
      refute_includes engine.src, "data-herb-debug-erb"

      assert_includes engine.src, "css_class"
      assert_includes engine.src, "@user.id"
    end

    test "script content erb expressions do NOT get debug spans" do
      template = <<~ERB
        <script>
          var userId = <%= @user.id %>;
          var name = "<%= @user.name %>";
        </script>
      ERB

      engine = Herb::Engine.new(template, debug: true)

      refute_includes engine.src, "erb-value"
      refute_includes engine.src, "data-herb-debug-erb"
    end

    test "style content erb expressions do NOT get debug spans" do
      template = <<~ERB
        <style>
          .user-color { color: <%= @user.color %>; }
          .theme { background: <%= theme_color %>; }
        </style>
      ERB

      engine = Herb::Engine.new(template, debug: true)

      refute_includes engine.src, "erb-value"
      refute_includes engine.src, "data-herb-debug-erb"
    end

    test "render calls get outline boundaries" do
      template = '<%= render "shared/header" %>'

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "partial render calls get partial outline boundaries" do
      template = '<%= render partial: "user_card", locals: { user: @user } %>'

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "top-level element with only ERB output as child" do
      template = "<h1><%= hello %></h1>"

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "top-level element with only ERB output as child for partial" do
      template = "<h1><%= hello %></h1>"

      assert_compiled_snapshot(template, { debug: true, filename: "_test.html.erb" })
    end

    test "collection render calls get outline boundaries" do
      template = "<%= render @posts %>"

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "erb control flow does NOT get debug markup" do
      template = <<~ERB
        <% if @user.present? %>
          <p>User found</p>
        <% else %>
          <p>No user</p>
        <% end %>
      ERB

      engine = Herb::Engine.new(template, debug: true)

      refute_includes engine.src, "erb-value"
      refute_includes engine.src, "data-herb-debug-erb"
    end

    test "erb comments do NOT get debug markup" do
      template = <<~ERB
        <p>Content</p>
        <%# This is a comment %>
        <p>More content</p>
      ERB

      engine = Herb::Engine.new(template, debug: true)

      refute_includes engine.src, "erb-value"
      refute_includes engine.src, "data-herb-debug-erb"
    end

    test "block expressions get debug spans" do
      template = <<~ERB
        <%= content_for :sidebar do %>
          <div>Sidebar content</div>
        <% end %>
      ERB

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "render block expressions get outline boundaries" do
      template = <<~ERB
        <%= render "layout" do %>
          <div>Block content</div>
        <% end %>
      ERB

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "mixed content and attributes" do
      template = <<~ERB
        <div class="<%= container_class %>">
          <h1>Hello <%= @name %>!</h1>
          <p data-id="<%= @user.id %>">Today is <%= Date.today.strftime('%A') %></p>
        </div>
      ERB

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "nested erb expressions with render calls" do
      template = <<~ERB
        <div class="container">
          <h1>Welcome <%= @user.name %>!</h1>
          <%= render "shared/navigation" %>
          <main>
            <%= render partial: "content", locals: { data: @data } %>
          </main>
        </div>
      ERB

      assert_compiled_snapshot(template, { debug: true, filename: "app/views/welcome.html.erb" })
    end

    test "debug mode with escape enabled" do
      template = "<p>User input: <%= user_content %></p>"

      assert_compiled_snapshot(template, { debug: true, escape: true, filename: "test.html.erb" })
    end

    test "debug mode with escape disabled" do
      template = "<p>Safe content: <%= safe_html %></p>"

      assert_compiled_snapshot(template, { debug: true, escape: false, filename: "test.html.erb" })
    end

    test "erb yield expressions get debug spans" do
      template = "<div><%= yield :sidebar %></div>"

      assert_compiled_snapshot(template, { debug: true, filename: "layout.erb" })
    end

    test "complex nested template with all features" do
      template = <<~ERB
        <!DOCTYPE html>
        <html>
          <head>
            <title><%= @page_title %></title>
            <style>
              body { background-color: <%= theme_color %>; }
            </style>
          </head>
          <body class="<%= body_classes %>">
            <%= render "shared/header" %>

            <main>
              <% if @user.present? %>
                <h1>Welcome back, <%= @user.name %>!</h1>
                <%= render partial: "user_dashboard", locals: { user: @user } %>
              <% else %>
                <h1>Welcome, guest!</h1>
                <%= render "auth/login_form" %>
              <% end %>
            </main>

            <script>
              window.userId = <%= @user&.id || 'null' %>;
            </script>
          </body>
        </html>
      ERB

      assert_compiled_snapshot(template, { debug: true, filename: "app/views/layouts/application.html.erb" })
    end

    test "zero overhead when debug disabled" do
      template = "<h1>Hello <%= @name %>!</h1>"

      engine_without_debug = Herb::Engine.new(template)
      engine_with_debug = Herb::Engine.new(template, debug: false)

      assert_equal engine_without_debug.src, engine_with_debug.src
    end

    test "turbo_frame_tag does NOT get erb-output outline type" do
      template = '<%= turbo_frame_tag "posts" do %><p>Content</p><% end %>'

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "content_for with block does NOT get erb-output outline type" do
      template = "<%= content_for :sidebar do %><div>Sidebar content</div><% end %>"

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "content_tag with block does NOT get erb-output outline type" do
      template = '<%= content_tag :div, class: "wrapper" do %>Content<% end %>'

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "link_to with block does NOT get erb-output outline type" do
      template = '<%= link_to "/users" do %>View Users<% end %>'

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "tag helper with block does NOT get erb-output outline type" do
      template = '<%= tag.div class: "container" do %>Content<% end %>'

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "form_with block does NOT get erb-output outline type" do
      template = "<%= form_with model: @user do |f| %>Form content<% end %>"

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "yield expressions get NOT erb-output outline type" do
      template = "<h1><%= yield :title %></h1>"

      assert_compiled_snapshot(template, { debug: true, filename: "layout.html.erb" })
    end

    test "if with elements" do
      template = <<~HTML
        <div class="text-gray-500 text-center flex-grow flex flex-col">
          <% if event.static_metadata && event.static_metadata.location != "Earth" %>
            <%= event.static_metadata.location %>
          <% end %>

          <%= event.formatted_dates %>

          <% if event.static_metadata.last_edition? %>
            <div class="flex items-center justify-center mt-auto -mb-0.5 text-gray-400">
              <%= fa "box-archive", size: :xs, style: :regular, class: "fill-gray-400" %>
              <span class="text-sm mt-0.5 ml-1">Final Edition</span>
            </div>
          <% end %>
        </div>
      HTML

      assert_compiled_snapshot(template, { debug: true, filename: "layout.html.erb" })
    end

    test "gets view and erb output view type for just output tag" do
      assert_compiled_snapshot("<%= hello %>", { debug: true, filename: "test.html.erb" })
    end

    test "puts debug span on parent if HTMLTextContent is only spaces" do
      assert_compiled_snapshot(" <h1>           <%= hello %>              </h1>", { debug: true, filename: "test.html.erb" })
    end

    test "puts debug span on parent if HTMLTextContent is only whitespace" do
      assert_compiled_snapshot(<<~HTML, { debug: true, filename: "test.html.erb" })
        <h1>
          <%= hello %>
        </h1>
      HTML
    end

    test "mulitple top-level elements should be wrapped in type=view div" do
      assert_compiled_snapshot(<<~HTML, { debug: true, filename: "test.html.erb" })
        <h1>Hello</h1>
        <p>World</p>
      HTML
    end

    test "non HTML-element top-level node should be wrapped in type=view div" do
      assert_compiled_snapshot(<<~HTML, { debug: true, filename: "test.html.erb" })
        <%= content_tag :div do %>
          Content
        <% end %>
      HTML
    end

    test "script content erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <script>
          var userId = <%= @user.id %>;
          var name = "<%= @user.name %>";
        </script>
      ERB
    end

    test "style content erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <style>
          .user-color { color: <%= @user.color %>; }
          .theme { background: <%= theme_color %>; }
        </style>
      ERB
    end

    test "head content erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <head>
          <title><%= @page_title %></title>
          <meta name="description" content="<%= @meta_description %>">
        </head>
      ERB
    end

    test "textarea content erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <textarea>
          <%= @user_input %>
          Default text with <%= @placeholder %>
        </textarea>
      ERB
    end

    test "pre content erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <pre>
          Code block:
          <%= @code_sample %>

          More code: <%= @another_sample %>
        </pre>
      ERB
    end

    test "nested excluded contexts do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <div>
          <script>
            var nested = <%= @nested_value %>;
          </script>
          <style>
            .nested { color: <%= @nested_color %>; }
          </style>
        </div>
      ERB
    end

    test "html comment erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <!-- Comment with <%= @dynamic_content %> -->
        <!-- Another comment: <%= @more_content %> -->
      ERB
    end

    test "html doctype erb expressions do NOT get debug spans" do
      assert_compiled_snapshot(<<~ERB, debug: true)
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "<%= @dtd_url %>">
        <!DOCTYPE html <%= @some_attr %>>
      ERB
    end

    test "complex erb with control flow and fa helper calls" do
      template = <<~ERB
        <div class="flex items-center gap-2 font-light">
          <% speakers_count = talk.speakers.size %>
          <% if speakers_count > 1 %>
            <%= fa("users", size: :sm, style: :light, class: "shrink-0 grow-0 my-1") %>
          <% elsif speakers_count == 1 %>
            <%= fa("user", size: :sm, style: :regular, class: "shrink-0 grow-0 my-1") %>
          <% end %>
        </div>
      ERB

      assert_compiled_snapshot(template, { debug: true, filename: "test.html.erb" })
    end

    test "regular div content still gets debug spans after excluded context tests" do
      assert_compiled_snapshot("<div><%= @content %></div>", debug: true)
    end
  end
end
