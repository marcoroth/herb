# frozen_string_literal: true

require "action_view"
require "reactionview/template/handlers/herb/herb"

require_relative "../test_helper"
require_relative "../../lib/herb/engine"
require_relative "../action_view_renderer"

module Engine
  class RailsCompatibilityTest < Minitest::Spec
    ReActionViewHerb = ReActionView::Template::Handlers::Herb::Herb

    private

    def eval_reactionview(template, assigns = {})
      engine = ReActionViewHerb.new(template, escape: true)

      lookup_context = ::ActionView::LookupContext.new([])
      view = ::ActionView::Base.with_empty_template_cache.new(lookup_context, {}, nil)

      assigns.each { |key, value| view.instance_variable_set(:"@#{key}", value) }

      view.instance_eval("@output_buffer = ::ActionView::OutputBuffer.new; #{engine.src}", __FILE__, __LINE__)
    end

    # TODO: reactionview 0.3.0 uses safe_expr_append which does not escape.
    # This should use append= for proper XSS protection. Tracked upstream.
    test "basic content with escaping" do
      result = eval_reactionview(
        "<h1><%= @title %></h1>",
        { "title" => "Hello World" }
      )

      assert_equal "<h1>Hello World</h1>", result.to_s
    end

    test "block expressions" do
      result = eval_reactionview(
        "<% @items.each do |item| %><li><%= item %></li><% end %>",
        { "items" => ["Apple", "Banana", "Cherry"] }
      )

      assert_equal "<li>Apple</li><li>Banana</li><li>Cherry</li>", result.to_s
    end

    test "multiline with proper newline handling" do
      template = <<~ERB
        <div class="container">
          <h1><%= @title %></h1>
          <p><%= @description %></p>
        </div>
      ERB

      result = eval_reactionview(template, {
        "title" => "Welcome",
        "description" => "This is a test",
      })

      expected = <<~HTML
        <div class="container">
          <h1>Welcome</h1>
          <p>This is a test</p>
        </div>
      HTML

      assert_equal expected, result.to_s
    end

    test "compiled output is valid ruby" do
      template = '<%= link_to "/path", class: "btn" do %>Click me<% end %>'

      engine = ReActionViewHerb.new(template, escape: true)

      refute_includes engine.src, " << "

      result = Prism.parse(engine.src)
      syntax_errors = result.errors.reject { |e| e.type == :invalid_yield }
      assert syntax_errors.empty?, "Compiled output is not valid Ruby: #{syntax_errors.map(&:message).join(", ")}"
    end

    test "drop-in replacement for Herb::Engine" do
      assert_equal ::Herb::Engine, ReActionViewHerb.superclass
    end

    # TODO: reactionview 0.3.0 uses safe_expr_append which does not escape.
    test "xss prevention" do
      result = eval_reactionview(
        "<p><%= @content %></p>",
        { "content" => "<script>alert('xss')</script>" }
      )

      # With safe_expr_append, content is NOT escaped (reactionview bug)
      # Should be: "<p>&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;</p>"
      assert_equal "<p><script>alert('xss')</script></p>", result.to_s
    end

    test "output matches Rails ActionView renderer" do
      template = <<~ERB
        <div>
          <h1><%= @title %></h1>
          <p><%= @message %></p>
        </div>
      ERB

      reactionview_result = eval_reactionview(template, {
        "title" => "Hello",
        "message" => "World",
      }).to_s

      rails_result = Herb::ActionViewRenderer.render(template, { "@title": "Hello", "@message": "World" })

      assert_equal rails_result, reactionview_result
    end

    test "Herb should not strip ERB comment lines from compiled output" do
      template = "<%# comment 1 %>\n<%# comment 2 %>\n<% code %>"

      erubi_src = ::ActionView::Template::Handlers::ERB::Erubi.new(template).src
      herb_src  = ReActionViewHerb.new(template).src

      erubi_line_count = erubi_src.lines.count
      herb_line_count  = herb_src.lines.count

      assert_equal erubi_line_count, herb_line_count,
                   "Herb should preserve the same number of lines as Erubi for templates " \
                   "with ERB comment tags (<%# ... %>). Stripping comment lines changes " \
                   "the compiled method's line count, which can affect error propagation " \
                   "through Template#render boundaries.\n  " \
                   "Template: #{template.inspect}\n  " \
                   "Erubi (#{erubi_line_count} lines): #{erubi_src.inspect}\n  " \
                   "Herb  (#{herb_line_count} lines): #{herb_src.inspect}"
    end

    test "Herb preserves blank lines for single comment" do
      template = "<%# comment %>\n<% code %>"

      erubi_src = ::ActionView::Template::Handlers::ERB::Erubi.new(template).src
      herb_src  = ReActionViewHerb.new(template).src

      # Erubi produces a blank line for the comment, then the code
      # Herb should do the same
      assert_equal erubi_src.lines.count, herb_src.lines.count,
                   "Herb should emit a blank line for <%# comment %> to maintain line parity.\n  " \
                   "Erubi: #{erubi_src.inspect}\n  " \
                   "Herb:  #{herb_src.inspect}"
    end

    test "without comments, line counts match (baseline)" do
      template = "<% code1 %>\n<% code2 %>"

      erubi_src = ::ActionView::Template::Handlers::ERB::Erubi.new(template).src
      herb_src  = ReActionViewHerb.new(template).src

      assert_equal erubi_src.lines.count, herb_src.lines.count,
                   "Baseline: without comments, both engines should produce the same line count.\n  " \
                   "Erubi: #{erubi_src.inspect}\n  " \
                   "Herb:  #{herb_src.inspect}"
    end
  end
end
