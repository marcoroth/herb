# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/auto_close_omitted_tags_visitor"
require_relative "../../lib/herb/engine/content_for_visitor"

module Engine
  class ContentForVisitorTest < Minitest::Spec
    include SnapshotUtils

    CONTENT = "<p>Appended</p>"

    def content_for_options(tag_name:, attributes: {}, content: CONTENT)
      {
        escape: false,
        parser_options: { strict: false },
        visitors: [Herb::Engine::ContentForVisitor.new(content, tag_name: tag_name, attributes: attributes)],
      }
    end

    def two_visitor_options
      {
        escape: false,
        parser_options: { strict: false },
        visitors: [
          Herb::Engine::ContentForVisitor.new(%(<meta name="first" content="1">), tag_name: "head"),
          Herb::Engine::ContentForVisitor.new(%(<meta name="second" content="2">), tag_name: "head")
        ],
      }
    end

    test "visitor is not loaded when only requiring herb" do
      load_path = $LOAD_PATH.map { |path| "-I#{path}" }.join(" ")
      output = `#{Gem.ruby} #{load_path} -e 'require "herb"; print defined?(Herb::Engine::ContentForVisitor).inspect' 2>&1`

      assert_equal "nil", output
    end

    test "content is appended to an arbitrary tag - compilation" do
      template = "<body><h1>Title</h1></body>"

      assert_compiled_snapshot(template, content_for_options(tag_name: "body"))
    end

    test "content is appended to an arbitrary tag - render" do
      template = "<body><h1>Title</h1></body>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "body"))
    end

    test "every matching element gets the content - render" do
      template = "<section>One</section><section>Two</section>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "section"))
    end

    test "nested matching elements each get the content - render" do
      template = "<div><div>Inner</div></div>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "div"))
    end

    test "tag name matching is case insensitive - render" do
      template = "<SECTION>Content</SECTION>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "section"))
    end

    test "a non-matching tag is left alone - render" do
      template = "<article>Content</article>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "section"))
    end

    test "an attribute value condition matches - render" do
      template = %(<main id="content">One</main><main id="other">Two</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "id" => "content" }))
    end

    test "an attribute value condition that does not match leaves the element alone - render" do
      template = %(<main id="other">Content</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "id" => "content" }))
    end

    test "a true condition matches on attribute presence - render" do
      template = %(<main data-role>One</main><main>Two</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "data-role" => true }))
    end

    test "a false condition matches on attribute absence - render" do
      template = %(<main data-role>One</main><main>Two</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "data-role" => false }))
    end

    test "a regexp condition matches the attribute value - render" do
      template = %(<main class="a-panel">One</main><main class="a-card">Two</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "class" => /panel/ }))
    end

    test "all attribute conditions have to match - render" do
      template = %(<main id="content" data-role="page">One</main><main id="content">Two</main>)

      assert_evaluated_snapshot(
        template,
        {},
        content_for_options(tag_name: "main", attributes: { "id" => "content", "data-role" => "page" })
      )
    end

    test "attribute name matching is case insensitive - render" do
      template = %(<main ID="content">Content</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "Id" => "content" }))
    end

    test "a symbol attribute name is matched - render" do
      template = %(<main id="content">Content</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { id: "content" }))
    end

    test "an ERB attribute value has no compile time value so a string condition does not match - render" do
      template = %(<main id="<%= @id %>">Content</main>)

      assert_evaluated_snapshot(
        template,
        { "@id": "content" },
        content_for_options(tag_name: "main", attributes: { "id" => "content" })
      )
    end

    test "an ERB attribute value still matches a presence condition - render" do
      template = %(<main id="<%= @id %>">Content</main>)

      assert_evaluated_snapshot(
        template,
        { "@id": "content" },
        content_for_options(tag_name: "main", attributes: { "id" => true })
      )
    end

    test "an empty attribute value matches an empty string condition - render" do
      template = %(<main id="">Content</main>)

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", attributes: { "id" => "" }))
    end

    test "nil content is a no-op - render" do
      template = "<section>Content</section>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "section", content: nil))
    end

    test "empty content is a no-op - render" do
      template = "<section>Content</section>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "section", content: ""))
    end

    test "ERB in the element body is kept before the content - render" do
      template = "<main><h1><%= @title %></h1></main>"

      assert_evaluated_snapshot(template, { "@title": "Hello" }, content_for_options(tag_name: "main"))
    end

    test "an element inside an ERB block gets the content - render" do
      template = "<% if true %><main>Content</main><% end %>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main"))
    end

    test "single quotes in the content are escaped - render" do
      template = "<main></main>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", content: %(<p class='single'></p>)))
    end

    test "double quotes in the content are escaped - render" do
      template = "<main></main>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", content: %(<p class="double"></p>)))
    end

    test "a backslash in the content is escaped - render" do
      template = "<main></main>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", content: %(<p class="back\\slash"></p>)))
    end

    test "Ruby interpolation in the content is not evaluated - render" do
      template = "<main></main>"

      assert_evaluated_snapshot(template, {}, content_for_options(tag_name: "main", content: "<p>\#{1 + 1}</p>"))
    end

    test "two visitors append their content in order - compilation" do
      template = "<head><title>Hello</title></head>"

      assert_compiled_snapshot(template, two_visitor_options)
    end

    test "two visitors append their content in order - render" do
      template = "<head><title>Hello</title></head>"

      assert_evaluated_snapshot(template, {}, two_visitor_options)
    end

    test "composes with AutoCloseOmittedTagsVisitor - render" do
      template = "<head><title>Hello</title></head><ul><li>One<li>Two</ul>"

      assert_evaluated_snapshot(template, {}, {
        escape: false,
        parser_options: { strict: false },
        visitors: [
          Herb::Engine::ContentForVisitor.new(%(<meta name="herb" content="1">), tag_name: "head"),
          Herb::Engine::AutoCloseOmittedTagsVisitor.new
        ],
      })
    end
  end
end
