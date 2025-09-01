# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class SecureCompilerTest < Minitest::Spec
    include SnapshotUtils

    def setup
      @compiler_options = {
        escape: false,
        bufvar: "_buf",
        escapefunc: "::Herb::Engine.h",
      }
    end

    def compile_template(template, options = {})
      engine_options = @compiler_options.merge(options)
      engine = Herb::Engine.new(template, engine_options)
      engine.src
    end

    def evaluate_template(template, context = {}, options = {})
      engine_options = @compiler_options.merge(options)
      engine = Herb::Engine.new(template, engine_options)

      _buf = String.new
      context.each { |key, value| instance_variable_set("@#{key}", value) }

      eval(engine.src)
      _buf
    end

    test "basic html content" do
      template = "<div>Hello <%= @name %></div>"
      result = evaluate_template(template, name: "Alice")
      assert_equal "<div>Hello Alice</div>", result
    end

    test "multiple erb expressions" do
      template = "<h1><%= @title %></h1><p><%= @description %></p>"
      result = evaluate_template(template, title: "Test", description: "Content")
      assert_equal "<h1>Test</h1><p>Content</p>", result
    end

    test "attribute value escaping" do
      template = '<div class="<%= @css_class %>">Content</div>'
      result = evaluate_template(template, css_class: "user-input")
      assert_equal '<div class="user-input">Content</div>', result
    end

    test "attribute value xss prevention" do
      template = '<div onclick="<%= @malicious %>">Click me</div>'
      malicious_input = '" onclick="alert(1)"'
      result = evaluate_template(template, malicious: malicious_input)

      expected = '<div onclick="&quot; onclick=&quot;alert(1)&quot;">Click me</div>'
      assert_equal expected, result
    end

    test "multiple attribute values" do
      template = '<div class="<%= @css_class %>" data-value="<%= @user_input %>">Content</div>'
      result = evaluate_template(template, css_class: "test", user_input: "safe")
      expected = '<div class="test" data-value="safe">Content</div>'

      assert_equal expected, result
    end

    test "script context escaping" do
      template = '<script>var name = "<%= @malicious %>";</script>'
      malicious_input = '" onclick="alert(1)"'
      result = evaluate_template(template, malicious: malicious_input)

      expected = '<script>var name = "\\x22 onclick=\\x22alert(1)\\x22";</script>'
      assert_equal expected, result
    end

    test "erb control flow in attributes" do
      template = '<div <% if true %>class="active"<% end %>>Content</div>'
      result = evaluate_template(template)

      assert_equal '<div class="active">Content</div>', result
    end

    test "conditional attributes" do
      template1 = '<button type="submit"<% if false %> disabled<% end %><% if false %> aria-busy="true"<% end %> class="btn">Submit</button>'
      result1 = evaluate_template(template1)
      assert_equal '<button type="submit" class="btn">Submit</button>', result1

      template2 = '<button type="submit"<% if true %> disabled<% end %><% if true %> aria-busy="true"<% end %> class="btn">Submit</button>'
      result2 = evaluate_template(template2)

      assert_includes result2, "disabled"
      assert_includes result2, "aria-busy"
    end

    test "erb output in attribute position blocked" do
      template = "<div <%= @malicious %>>Content</div>"

      error = assert_raises(Herb::Engine::SecurityError) do
        compile_template(template)
      end

      assert_includes error.message, "ERB output tags (<%= %>) are not allowed in attribute position"
      assert_includes error.suggestion, "Use control flow (<% %>) with static attributes instead"
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test "erb output in attribute names blocked" do
      template = '<div data-<%= @name %>="value">Content</div>'

      error = assert_raises(Herb::Engine::SecurityError) do
        compile_template(template)
      end

      assert_includes error.message, "ERB output in attribute names is not allowed for security reasons"
      assert_includes error.suggestion, "Use static attribute names with dynamic values instead"
    end

    test "erb control flow in attribute position allowed" do
      template = '<div <% if active? %>class="active"<% else %>class="inactive"<% end %>>Content</div>'

      result = compile_template(template)
      assert result.is_a?(String)
    end

    test "token optimization basic" do
      template = "<div>Hello</div><span>World</span><p><%= @name %></p>"
      compiled = compile_template(template)

      assert_includes compiled, "'<div>Hello</div><span>World</span><p>'"
    end

    test "mixed contexts" do
      template = '<div class="<%= @css_class %>" onclick="alert(\'<%= @name %>\')">Content</div>'
      result = evaluate_template(template, css_class: "test", name: "Alice")

      assert_includes result, 'class="test"'
      assert_includes result, "alert('Alice')"
    end

    test "void elements" do
      template = '<input type="text" value="<%= @value %>"/><br/>'
      result = evaluate_template(template, value: "test")
      assert_equal '<input type="text" value="test"/><br/>', result
    end

    test "html comments with erb" do
      template = '<!-- Generated at <%= Time.now.strftime("%Y-%m-%d") %> -->'
      result = evaluate_template(template)
      assert_includes result, "<!-- Generated at"
      assert_includes result, "-->"
    end

    test "mixed quote types" do
      template = '<div class=\'<%= @class %>\' data-value="<%= @value %>"></div>'
      result = evaluate_template(template, class: "test", value: "data")
      assert_includes result, "class='test'"
      assert_includes result, 'data-value="data"'
    end

    test "user profile card" do
      template = <<~ERB
        <div class="user-card <%= @card_class %>">
          <% if @user_avatar %>
            <img src="<%= @avatar_url %>" alt="<%= @name %>'s avatar">
          <% end %>

          <h3><%= @name %></h3>
          <p class="email"><%= @email %></p>

          <script>
            window.userProfile = {
              name: "<%= @name %>",
              email: "<%= @email %>",
              isActive: <%= @active %>
            };
          </script>
        </div>
      ERB

      context = {
        card_class: "featured",
        user_avatar: true,
        avatar_url: "https://example.com/avatar.jpg",
        name: "Alice Smith",
        email: "alice@example.com",
        active: true,
      }

      result = evaluate_template(template, context)

      assert_includes result, 'class="user-card featured"'
      assert_includes result, 'src="https://example.com/avatar.jpg"'
      assert_includes result, 'alt="Alice Smith\'s avatar"'
      assert_includes result, "<h3>Alice Smith</h3>"
      assert_includes result, 'name: "Alice Smith"'
      assert_includes result, "isActive: true"
    end

    test "security error provides location info" do
      template = <<~ERB
        <div>
          <p>Some content</p>
          <span <%= @bad_attribute %>>Error here</span>
        </div>
      ERB

      error = assert_raises(Herb::Engine::SecurityError) do
        compile_template(template)
      end

      assert_equal 3, error.line
      assert error.column.is_a?(Integer)
    end
  end
end
