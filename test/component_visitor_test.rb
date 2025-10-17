# frozen_string_literal: true

require_relative "test_helper"
require_relative "../lib/herb/engine/component_visitor"

module Engine
  class ComponentVisitorTest < Minitest::Spec
    def setup
      # skip

      @visitor = Herb::Engine::ComponentVisitor.new
    end

    test "transforms simple Vue component to ERB render call" do
      html = '<SomethingComponent name="hello" :count="@count" />'
      result = parse_and_transform(html)

      assert_erb_output(result, '<%= render SomethingComponent.new(name: "hello", count: @count) %>')
    end

    test "handles components with only regular attributes" do
      html = '<MyComponent title="Hello World" />'
      result = parse_and_transform(html)

      assert_erb_output(result, '<%= render MyComponent.new(title: "Hello World") %>')
    end

    test "handles components with only Vue directive attributes" do
      html = '<UserCard :user="@current_user" :show_avatar="true" />'
      result = parse_and_transform(html)

      assert_erb_output(result, '<%= render UserCard.new(user: @current_user, show_avatar: true) %>')
    end

    test "handles components without attributes" do
      html = "<EmptyComponent />"
      result = parse_and_transform(html)

      assert_erb_output(result, "<%= render EmptyComponent.new %>")
    end

    test "converts kebab-case attributes to snake_case" do
      html = '<MyComponent :data-value="@value" some-prop="test" />'
      result = parse_and_transform(html)

      assert_erb_output(result, '<%= render MyComponent.new(data_value: @value, some_prop: "test") %>')
    end

    test "does not transform regular HTML elements" do
      html = '<div class="container">Regular HTML</div>'
      result = parse_and_transform(html)

      refute_includes(extract_all_text(result.value), "render")
      refute_includes(extract_all_text(result.value), "<%=")
    end

    test "transforms only components in mixed HTML" do
      html = '<div class="container"><SomethingComponent name="test" /></div>'
      result = parse_and_transform(html)

      erb_content = extract_erb_from_ast(result.value)
      assert_equal '<%= render SomethingComponent.new(name: "test") %>', erb_content
    end

    test "handles multiple Vue directive attributes" do
      html = '<ComplexComponent :user="@user" :settings="@settings" :active="true" />'
      result = parse_and_transform(html)

      erb_content = extract_erb_from_ast(result.value)
      assert_includes erb_content, "user: @user"
      assert_includes erb_content, "settings: @settings"
      assert_includes erb_content, 'active: true'
    end

    test "component visitor transforms Vue components to ERB" do
      html = '<MyComponent :prop="@value" />'

      component_visitor = Herb::Engine::ComponentVisitor.new

      visitors = [component_visitor]

      engine = Herb::Engine.new(html, visitors: visitors)

      expected = "_buf = ::String.new;\n _buf << (render MyComponent.new(prop: @value)).to_s;\n_buf.to_s\n"
      assert_equal expected, engine.src
    end

    test "multiple visitors can work together" do
      html = '<TestComponent name="test" />'

      component_visitor = Herb::Engine::ComponentVisitor.new
      debug_visitor = Herb::Engine::DebugVisitor.new(
        file_path: "test.html.erb",
        project_path: "/project"
      )

      visitors = [component_visitor, debug_visitor]

      engine = Herb::Engine.new(html, visitors: visitors)

      expected = "_buf = ::String.new;\n _buf << (render TestComponent.new(name: \"test\")).to_s;\n_buf.to_s\n"
      assert_equal expected, engine.src
    end

    test "engine accepts and runs multiple visitors" do
      html = '<SomethingComponent name="hello" :count="@count" /><div>Regular HTML</div>'

      test_visitor = Class.new(Herb::Visitor) do
        attr_reader :called

        def initialize
          super
          @called = false
        end

        def visit_document_node(node)
          @called = true
          super
        end
      end.new

      component_visitor = Herb::Engine::ComponentVisitor.new

      visitors = [test_visitor, component_visitor]

      engine = Herb::Engine.new(html, visitors: visitors)

      assert test_visitor.called, "Test visitor should have been called"

      expected = "_buf = ::String.new;\n _buf << (render SomethingComponent.new(name: \"hello\", count: @count)).to_s; _buf << '<div>Regular HTML</div>'.freeze;\n_buf.to_s\n"
      assert_equal expected, engine.src
    end

    private

    def parse_and_transform(html)
      result = Herb.parse(html)
      assert result.success?, "Parse failed: #{result.errors.map(&:message).join(", ")}"

      @visitor.visit(result.value)
      result
    end

    def assert_erb_output(result, expected_erb)
      erb_content = extract_erb_from_ast(result.value)
      assert_equal expected_erb, erb_content
    end

    def extract_erb_from_ast(node)
      case node
      when Herb::AST::ERBContentNode
        "#{node.tag_opening.value}#{node.content.value}#{node.tag_closing.value}"
      when Herb::AST::DocumentNode, Herb::AST::HTMLElementNode
        if node.respond_to?(:children) && node.children
          erb_parts = node.children.filter_map { |child| extract_erb_from_ast(child) }
          return erb_parts.first if erb_parts.length == 1

          erb_parts.join("\n") if erb_parts.any?
        elsif node.respond_to?(:body) && node.body
          erb_parts = node.body.filter_map { |child| extract_erb_from_ast(child) }
          return erb_parts.first if erb_parts.length == 1

          erb_parts.join("\n") if erb_parts.any?
        end
      end
    end

    def extract_all_text(node)
      case node
      when Herb::AST::HTMLTextNode
        node.content
      when Herb::AST::ERBContentNode
        "#{node.tag_opening.value}#{node.content.value}#{node.tag_closing.value}"
      else
        if node.respond_to?(:children) && node.children
          node.children.map { |child| extract_all_text(child) }.join
        elsif node.respond_to?(:body) && node.body
          node.body.map { |child| extract_all_text(child) }.join
        else
          ""
        end
      end
    end
  end
end
