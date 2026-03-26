# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class TransformerTest < Minitest::Spec
    private

    def compile(template, visitors: [])
      engine = Herb::Engine.new(template, escape: false, visitors: visitors)
      engine.src
    end

    def assert_transform(from, to, visitors:)
      result = compile(from, visitors: visitors)
      expected = "_buf = ::String.new; _buf << '#{to}'.freeze;\n_buf.to_s\n"
      assert_equal expected, result
    end

    test "transformer base class requires transformer_name" do
      klass = Class.new(Herb::Rewriter)
      assert_raises(NotImplementedError) { klass.transformer_name }
    end

    test "transformer base class defaults matches to empty array" do
      klass = Class.new(Herb::Rewriter)
      assert_equal [], klass.matches
    end

    test "transformer base class defaults transform to nil" do
      klass = Class.new(Herb::Rewriter) do
        def self.transformer_name = "test"
        def self.matches = ["test_helper"]
      end

      assert_nil klass.new.transform(nil, nil)
    end

    test "no transformers produces raw ERB output" do
      result = compile('<%= fa("home") %>')
      assert_equal "_buf = ::String.new; _buf << (fa(\"home\")).to_s;\n_buf.to_s\n", result
    end

    test "multiple transformers compose" do
      fa_transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "fa"
        def self.matches = ["fa"]

        def transform(_erb_node, context)
          icon = context.first_string_argument
          return nil unless icon

          build_element(
            tag_name: "i",
            attributes: [build_attribute("class", "fa fa-#{icon}")]
          )
        end
      end

      badge_transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "badge"
        def self.matches = ["badge"]

        def transform(_erb_node, context)
          label = context.first_string_argument
          return nil unless label

          build_element(
            tag_name: "span",
            attributes: [build_attribute("class", "badge")],
            body: [build_text(label)]
          )
        end
      end

      assert_transform(
        '<%= fa("star") %> <%= badge("new") %>',
        '<i class="fa fa-star"></i> <span class="badge">new</span>',
        visitors: [fa_transformer.new, badge_transformer.new]
      )
    end

    test "block-form transformer" do
      frame_transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "custom-frame"
        def self.matches = ["custom_frame"]

        def transform(_erb_node, context)
          frame_id = context.first_string_argument
          return nil unless frame_id

          build_element(
            tag_name: "custom-frame",
            attributes: [build_attribute("id", frame_id)],
            body: context.body
          )
        end
      end

      result = compile(
        "<%= custom_frame \"main\" do %>\n  <p>Content</p>\n<% end %>",
        visitors: [frame_transformer.new]
      )

      assert_equal(
        "_buf = ::String.new; _buf << '<custom-frame id=\"main\">\n  <p>Content</p>\n</custom-frame>'.freeze;\n_buf.to_s\n",
        result
      )
    end

    test "transformer does not affect unmatched helpers" do
      noop_transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "noop"
        def self.matches = ["noop"]
      end

      result = compile(
        '<%= link_to "About", "/about" %>',
        visitors: [noop_transformer.new]
      )

      assert_equal(
        "_buf = ::String.new; _buf << (link_to \"About\", \"/about\").to_s;\n_buf.to_s\n",
        result
      )
    end

    test "transformer can mutate tag names in place" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "rename-sections"

        def visit_html_open_tag_node(node)
          node.tag_name.value = "div" if node.tag_name&.value == "section"
          super
        end

        def visit_html_close_tag_node(node)
          node.tag_name.value = "div" if node.tag_name&.value == "section"
          super
        end
      end

      assert_transform(
        "<section><p>Hello</p></section>",
        "<div><p>Hello</p></div>",
        visitors: [transformer.new]
      )
    end

    test "transformer can add attributes in place" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-attribute"

        def visit_html_open_tag_node(node)
          node.children << build_attribute("data-turbo", "true") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="container">Content</div>',
        '<div class="container" data-turbo="true">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "rename_tag helper renames open and close tags" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "rename"

        def visit_html_element_node(node)
          rename_tag(node, "div") if node.tag_name&.value == "section"
          super
        end
      end

      assert_transform(
        "<section><p>Hello</p></section>",
        "<div><p>Hello</p></div>",
        visitors: [transformer.new]
      )
    end

    test "add_attribute helper adds to element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-attribute"

        def visit_html_element_node(node)
          add_attribute(node, "data-controller", "hello") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        "<div>Content</div>",
        '<div data-controller="hello">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "remove_attribute helper removes from element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "remove-attribute"

        def visit_html_element_node(node)
          remove_attribute(node, "class") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="foo" id="bar">Content</div>',
        '<div id="bar">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "set_attribute helper updates existing attribute" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "set-attribute"

        def visit_html_element_node(node)
          set_attribute(node, "class", "updated") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="original">Content</div>',
        '<div class="updated">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "set_attribute helper adds attribute when not present" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "set-attribute"

        def visit_html_element_node(node)
          set_attribute(node, "role", "navigation") if node.tag_name&.value == "nav"
          super
        end
      end

      assert_transform(
        "<nav>Links</nav>",
        '<nav role="navigation">Links</nav>',
        visitors: [transformer.new]
      )
    end

    test "wrap_in_element helper wraps node in new parent" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "wrap"

        def visit_html_element_node(node)
          if node.tag_name&.value == "p"
            wrapped = wrap_in_element(node, tag_name: "div", attributes: [build_attribute("class", "wrapper")])
            @replacements[node] = wrapped
          end

          super
        end
      end

      assert_transform(
        "<p>Hello</p>",
        '<div class="wrapper"><p>Hello</p></div>',
        visitors: [transformer.new]
      )
    end

    test "insert_before helper inserts node before reference" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "insert-before"

        def visit_html_element_node(node)
          if node.tag_name&.value == "ul"
            first_child = node.body.first
            insert_before(node.body, first_child, build_text("<!-- list -->")) if first_child
          end

          super
        end
      end

      assert_transform(
        "<ul><li>One</li></ul>",
        "<ul><!-- list --><li>One</li></ul>",
        visitors: [transformer.new]
      )
    end

    test "add_token adds class to element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-token"

        def visit_html_element_node(node)
          add_token(node, "class", "active") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="container">Content</div>',
        '<div class="container active">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "add_token creates class attribute when not present" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-token"

        def visit_html_element_node(node)
          add_token(node, "class", "highlighted") if node.tag_name&.value == "p"
          super
        end
      end

      assert_transform(
        "<p>Text</p>",
        '<p class="highlighted">Text</p>',
        visitors: [transformer.new]
      )
    end

    test "add_token does not duplicate existing token" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-token"

        def visit_html_element_node(node)
          add_token(node, "class", "container") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="container">Content</div>',
        '<div class="container">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "remove_token removes class from element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "remove-token"

        def visit_html_element_node(node)
          remove_token(node, "class", "hidden") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="container hidden">Content</div>',
        '<div class="container">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "remove_token removes class attribute when last token removed" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "remove-token"

        def visit_html_element_node(node)
          remove_token(node, "class", "only") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="only">Content</div>',
        "<div >Content</div>",
        visitors: [transformer.new]
      )
    end

    test "replace_token swaps class on element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "replace-token"

        def visit_html_element_node(node)
          replace_token(node, "class", "btn-primary", "btn-secondary") if node.tag_name&.value == "a"
          super
        end
      end

      assert_transform(
        '<a class="btn btn-primary">Click</a>',
        '<a class="btn btn-secondary">Click</a>',
        visitors: [transformer.new]
      )
    end

    test "includes_token? checks for token presence" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "conditional-token"

        def visit_html_element_node(node)
          if node.tag_name&.value == "div" && includes_token?(node, "class", "card")
            add_token(node, "class", "shadow")
          end

          super
        end
      end

      assert_transform(
        '<div class="card">Content</div>',
        '<div class="card shadow">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "add_class adds class to element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-class"

        def visit_html_element_node(node)
          add_class(node, "active") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="container">Content</div>',
        '<div class="container active">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "add_class creates class attribute when not present" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "add-class"

        def visit_html_element_node(node)
          add_class(node, "highlighted") if node.tag_name&.value == "p"
          super
        end
      end

      assert_transform(
        "<p>Text</p>",
        '<p class="highlighted">Text</p>',
        visitors: [transformer.new]
      )
    end

    test "remove_class removes class from element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "remove-class"

        def visit_html_element_node(node)
          remove_class(node, "hidden") if node.tag_name&.value == "div"
          super
        end
      end

      assert_transform(
        '<div class="container hidden">Content</div>',
        '<div class="container">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "replace_class swaps class on element" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "replace-class"

        def visit_html_element_node(node)
          replace_class(node, "btn-primary", "btn-secondary") if node.tag_name&.value == "a"
          super
        end
      end

      assert_transform(
        '<a class="btn btn-primary">Click</a>',
        '<a class="btn btn-secondary">Click</a>',
        visitors: [transformer.new]
      )
    end

    test "includes_class? conditionally adds class" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "conditional-class"

        def visit_html_element_node(node)
          add_class(node, "shadow") if node.tag_name&.value == "div" && includes_class?(node, "card")
          super
        end
      end

      assert_transform(
        '<div class="card">Content</div>',
        '<div class="card shadow">Content</div>',
        visitors: [transformer.new]
      )
    end

    test "includes_class? returns false when class not present" do
      transformer = Class.new(Herb::Rewriter) do
        def self.transformer_name = "conditional-class"

        def visit_html_element_node(node)
          add_class(node, "shadow") if node.tag_name&.value == "div" && includes_class?(node, "card")
          super
        end
      end

      assert_transform(
        '<div class="container">Content</div>',
        '<div class="container">Content</div>',
        visitors: [transformer.new]
      )
    end
  end
end
