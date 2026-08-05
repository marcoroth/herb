# frozen_string_literal: true

require_relative "test_helper"
require_relative "snapshot_utils"
require_relative "../lib/herb/engine/component_visitor"

module Engine
  class ComponentVisitorTest < Minitest::Spec
    include SnapshotUtils

    class IconResolver < Herb::Engine::ComponentVisitor::Resolver
      def handles?(tag_name)
        tag_name.start_with?("Icon")
      end

      def render_code(tag_name, attributes, block: false) # rubocop:disable Lint/UnusedMethodArgument
        %(icon_tag("#{tag_name.delete_prefix("Icon").downcase}"))
      end
    end

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

      assert_erb_output(result, "<%= render UserCard.new(user: @current_user, show_avatar: true) %>")
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
      assert_includes erb_content, "active: true"
    end

    test "component visitor transforms Vue components to ERB" do
      html = '<MyComponent :prop="@value" />'

      component_visitor = Herb::Engine::ComponentVisitor.new

      visitors = [component_visitor]

      engine = Herb::Engine.new(html, visitors: visitors)

      expected = "_buf = ::String.new; _buf << (render MyComponent.new(prop: @value)).to_s;\n_buf.to_s\n"
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

      expected = "_buf = ::String.new; _buf << (render TestComponent.new(name: \"test\")).to_s;\n_buf.to_s\n"
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

      expected = "_buf = ::String.new; _buf << (render SomethingComponent.new(name: \"hello\", count: @count)).to_s; _buf << '<div>Regular HTML</div>'.freeze;\n_buf.to_s\n"
      assert_equal expected, engine.src
    end

    test "escapes double quotes in attribute values" do
      assert_compiled_snapshot(%(<MyComponent name='He said "hi"' />), component_options)
    end

    test "escapes backslashes in attribute values" do
      assert_compiled_snapshot(%(<MyComponent path="C:\\temp" />), component_options)
    end

    test "does not interpolate Ruby from a regular attribute value" do
      assert_compiled_snapshot("<MyComponent name=\"\#{1 + 1}\" />", component_options)
    end

    test "an attribute without a value becomes true" do
      assert_compiled_snapshot("<MyComponent disabled />", component_options)
    end

    test "an empty attribute value becomes an empty string" do
      assert_compiled_snapshot('<MyComponent name="" />', component_options)
    end

    test "an ERB expression in an attribute value is interpolated into the string" do
      assert_compiled_snapshot('<MyComponent name="<%= @user.name %>" />', component_options)
    end

    test "an ERB expression mixed with text in an attribute value keeps both" do
      assert_compiled_snapshot('<MyComponent name="Hi <%= @user.name %>!" />', component_options)
    end

    test "a directive attribute is used as Ruby code" do
      assert_compiled_snapshot('<MyComponent :count="@count" />', component_options)
    end

    test "the first of a duplicated attribute wins" do
      assert_compiled_snapshot('<MyComponent name="a" name="b" />', component_options)
    end

    test "kebab-case attributes become snake_case keywords" do
      assert_compiled_snapshot('<MyComponent item-id="7" />', component_options)
    end

    test "an attribute name that is not a valid keyword is skipped" do
      assert_compiled_snapshot('<MyComponent @click="go" name="x" />', component_options)
    end

    test "an all-caps tag is left as HTML" do
      assert_compiled_snapshot("<DIV>hello</DIV>", component_options)
    end

    test "an all-caps void tag is left as HTML" do
      assert_compiled_snapshot("<BR>", component_options)
    end

    test "a single letter tag is left as HTML" do
      assert_compiled_snapshot("<A>x</A>", component_options)
    end

    test "a tag name that is not a valid constant is left as HTML" do
      assert_compiled_snapshot("<My-Component />", component_options)
    end

    test "a namespaced tag becomes a namespaced constant" do
      assert_compiled_snapshot("<Users::Card />", component_options)
    end

    test "a component with an HTML body compiles the body inside the block" do
      assert_compiled_snapshot("<Card><div>x</div></Card>", component_options)
    end

    test "a component with an ERB body compiles the body inside the block" do
      assert_compiled_snapshot("<Card><%= @thing %></Card>", component_options)
    end

    test "a component with a mixed body compiles the body inside the block" do
      assert_compiled_snapshot("<Card><div>x</div><%= @thing %></Card>", component_options)
    end

    test "nested components compile as nested render blocks" do
      assert_compiled_snapshot("<Card><Button>Go</Button></Card>", component_options)
    end

    test "a component inside an ERB block is transformed" do
      assert_compiled_snapshot("<% items.each do |item| %><Item /><% end %>", component_options)
    end

    test "a dot notation tag becomes a partial" do
      assert_compiled_snapshot("<Users.Card />", dot_notation_options)
    end

    test "a dot notation tag keeps CamelCase segments as snake_case path segments" do
      assert_compiled_snapshot("<Users.ProfileCard />", dot_notation_options)
    end

    test "a nested dot notation tag becomes a nested partial path" do
      assert_compiled_snapshot("<Admin.Users.Card />", dot_notation_options)
    end

    test "attributes of a partial become locals" do
      assert_compiled_snapshot('<Users.Card name="hello" :count="@count" />', dot_notation_options)
    end

    test "a partial with a body is rendered as a layout" do
      assert_compiled_snapshot("<Shared.Card>Body</Shared.Card>", dot_notation_options)
    end

    test "a partial with a body and attributes passes locals to the layout" do
      assert_compiled_snapshot('<Users.Card title="x"><div>y</div></Users.Card>', dot_notation_options)
    end

    test "a component nested inside a partial is still transformed" do
      assert_compiled_snapshot("<Users.Card><Button>Go</Button></Users.Card>", dot_notation_options)
    end

    test "a double colon tag stays a component" do
      assert_compiled_snapshot("<Users::Card />", dot_notation_options)
    end

    test "a custom resolver decides what a tag renders to" do
      assert_compiled_snapshot("<IconStar />", custom_resolver_options)
    end

    test "a tag no resolver claims is left as HTML" do
      assert_compiled_snapshot("<Card />", custom_resolver_options)
    end

    private

    def component_options
      { visitors: [Herb::Engine::ComponentVisitor.new] }
    end

    def dot_notation_options
      {
        parser_options: { dot_notation_tags: true },
        visitors: [Herb::Engine::ComponentVisitor.new],
      }
    end

    def custom_resolver_options
      { visitors: [Herb::Engine::ComponentVisitor.new(resolvers: [IconResolver.new])] }
    end

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

    def child_nodes_for(node)
      return node.children if node.respond_to?(:children) && node.children
      return node.body if node.respond_to?(:body) && node.body

      nil
    end

    def extract_erb_from_ast(node)
      case node
      when Herb::AST::ERBContentNode
        "#{node.tag_opening.value}#{node.content.value}#{node.tag_closing.value}"
      when Herb::AST::DocumentNode, Herb::AST::HTMLElementNode
        children = child_nodes_for(node)

        return nil unless children

        erb_parts = children.filter_map { |child| extract_erb_from_ast(child) }

        return erb_parts.first if erb_parts.length == 1

        erb_parts.join("\n") if erb_parts.any?
      end
    end

    def extract_all_text(node)
      case node
      when Herb::AST::HTMLTextNode
        node.content
      when Herb::AST::ERBContentNode
        "#{node.tag_opening.value}#{node.content.value}#{node.tag_closing.value}"
      else
        children = child_nodes_for(node)

        children ? children.map { |child| extract_all_text(child) }.join : ""
      end
    end
  end
end
