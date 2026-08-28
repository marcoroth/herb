# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/visitors/html_safe_assertions"

module Engine
  class HTMLSafeAssertionsTest < Minitest::Spec
    include SnapshotUtils

    SCRIPT = "<script>alert(1)</script>"

    def assertion_options(visitor_options = {})
      visitor = Herb::Engine::Visitors::HTMLSafeAssertions.new(file_path: "app/views/test.html.erb", **visitor_options)

      {
        escape: false,
        parser_options: { strict: false },
        visitors: [visitor],
      }
    end

    def render(template, locals = {}, visitor_options = {})
      engine = Herb::Engine.new(template, assertion_options(visitor_options))

      evaluate_herb_source(engine.src, locals)
    end

    def outcome(template, locals, visitors)
      engine = Herb::Engine.new(template, escape: false, parser_options: { strict: false }, visitors: visitors)

      evaluate_herb_source(engine.src, locals)
    rescue StandardError => e
      "#{e.class}: #{e.message}"
    end

    def teardown
      Herb::Engine::Runtime::HTMLSafeAssertions.on_violation = nil
    end

    test "visitor is not loaded when only requiring herb" do
      load_path = $LOAD_PATH.map { |path| "-I#{path}" }.join(" ")
      output = `#{Gem.ruby} #{load_path} -e 'require "herb"; print defined?(Herb::Engine::Visitors::HTMLSafeAssertions).inspect' 2>&1`

      assert_equal "nil", output
    end

    test "output tag is wrapped in an assertion - compilation" do
      template = "<div><%= @user.bio.html_safe %></div>"

      assert_compiled_snapshot(template, assertion_options)
    end

    test "control tag is wrapped in an assertion - compilation" do
      template = "<% content = message.html_safe %><div><%= content %></div>"

      assert_compiled_snapshot(template, assertion_options)
    end

    test "every html_safe call in a template is wrapped - compilation" do
      template = "<div><%= a.html_safe %> and <%= b.html_safe %></div>"

      assert_compiled_snapshot(template, assertion_options)
    end

    test "html_safe inside a block tag is wrapped - compilation" do
      template = %(<%= link_to "Home", root_path(query.html_safe) do %>Home<% end %>)

      assert_compiled_snapshot(template, assertion_options)
    end

    test "html_safe in a control flow fragment is wrapped - compilation" do
      template = "<% if a %>A<% elsif b.html_safe %>B<% end %>"

      assert_compiled_snapshot(template, assertion_options)
    end

    test "template without html_safe is left alone - compilation" do
      template = "<div><%= @user.bio %></div>"

      assert_compiled_snapshot(template, assertion_options)
    end

    test "html_safe in an ERB comment is left alone" do
      template = "<%# @user.bio.html_safe %><div>x</div>"

      engine = Herb::Engine.new(template, assertion_options)

      refute_includes engine.src, "HTMLSafeAssertions"
    end

    test "every call is wrapped once when the visitor is passed twice" do
      template = "<div><%= a.html_safe %></div>"
      visitors = [
        Herb::Engine::Visitors::HTMLSafeAssertions.new,
        Herb::Engine::Visitors::HTMLSafeAssertions.new
      ]

      engine = Herb::Engine.new(template, escape: false, visitors: visitors)

      assert_equal 1, engine.src.scan("HTMLSafeAssertions.check").length
    end

    test "the engine enables the prism_program parser option" do
      template = "<div><%= @user.bio.html_safe %></div>"

      engine = Herb::Engine.new(
        template,
        escape: false,
        parser_options: { strict: false },
        visitors: [Herb::Engine::Visitors::HTMLSafeAssertions.new]
      )

      assert_includes engine.src, "HTMLSafeAssertions.check"
    end

    test "a document parsed without the prism_program option raises" do
      document = Herb.parse("<div><%= @user.bio.html_safe %></div>").value

      error = assert_raises(Herb::Engine::Visitors::HTMLSafeAssertions::MissingPrismProgramError) do
        document.accept(Herb::Engine::Visitors::HTMLSafeAssertions.new)
      end

      assert_includes error.message, "`prism_program` parser option"
    end

    test "ignored checks are baked into the assertion - compilation" do
      template = "<div><%= @user.bio.html_safe %></div>"

      assert_compiled_snapshot(template, assertion_options({ ignore: [:risky_element, :meta_refresh] }))
    end

    test "the file is taken from the compiled template when no file path is given" do
      template = "<div><%= @user.bio.html_safe %></div>"

      engine = Herb::Engine.new(template, escape: false, visitors: [Herb::Engine::Visitors::HTMLSafeAssertions.new])

      assert_includes engine.src, "file: __FILE__"
    end

    test "safe value passes through unchanged - render" do
      template = "<div><%= bio.html_safe %></div>"

      assert_evaluated_snapshot(template, { bio: "<p>About me</p>" }, assertion_options)
    end

    test "value without html_safe is never checked - render" do
      template = "<div><%= bio %></div>"

      assert_evaluated_snapshot(template, { bio: SCRIPT }, assertion_options)
    end

    test "value that is already html safe is not checked - render" do
      template = "<div><%= bio.html_safe %></div>"

      assert_evaluated_snapshot(template, { bio: SCRIPT.html_safe }, assertion_options)
    end

    test "ignored check renders the value - render" do
      template = "<div><%= bio.html_safe %></div>"
      iframe = %(<iframe src="https://example.com"></iframe>)

      assert_evaluated_snapshot(template, { bio: iframe }, assertion_options({ ignore: [:risky_element] }))
    end

    test "unsafe value raises" do
      template = "<div><%= bio.html_safe %></div>"

      error = assert_raises(Herb::Engine::Runtime::HTMLSafeAssertions::UnsafeHTMLError) do
        render(template, bio: SCRIPT)
      end

      assert_equal [:script_element], error.violations.map(&:name)
      assert_equal "app/views/test.html.erb", error.file
      assert_equal 1, error.line
      assert_equal 6, error.column
      assert_equal "<%= bio.html_safe %>", error.source
      assert_equal SCRIPT, error.value
    end

    test "error message points at the template and the value" do
      template = %(<div>\n  <%= bio.html_safe %>\n</div>)

      error = assert_raises(Herb::Engine::Runtime::HTMLSafeAssertions::UnsafeHTMLError) do
        render(template, bio: SCRIPT)
      end

      expected = <<~MESSAGE.strip
        Unsafe `.html_safe` call in app/views/test.html.erb:2:3

            <%= bio.html_safe %>

        The value contains a `<script>` element, which the browser executes.

            "<script>alert(1)</script>"

        Escape the value or run it through `sanitize` instead of marking it as HTML-safe.
      MESSAGE

      assert_equal expected, error.message
    end

    test "warn mode warns and keeps rendering" do
      template = "<div><%= bio.html_safe %></div>"
      result = nil

      _out, err = capture_io do
        result = render(template, { bio: SCRIPT }, mode: :warn)
      end

      assert_equal "<div>#{SCRIPT}</div>", result
      assert_includes err, "Unsafe `.html_safe` call in app/views/test.html.erb:1:6"
    end

    test "on_violation handler replaces raising" do
      template = "<div><%= bio.html_safe %></div>"
      reported = []

      Herb::Engine::Runtime::HTMLSafeAssertions.on_violation = ->(error) { reported << error }

      assert_equal "<div>#{SCRIPT}</div>", render(template, bio: SCRIPT)
      assert_equal 1, reported.length
      assert_equal [:script_element], reported.first.violations.map(&:name)
    end

    test "html_safe passed as a block argument is wrapped - compilation" do
      template = "<div><%= items.map(&:html_safe).join %></div>"

      assert_compiled_snapshot(template, assertion_options)
    end

    test "html_safe passed as a block argument checks every element - render" do
      template = "<div><%= items.map(&:html_safe).join %></div>"

      assert_evaluated_snapshot(template, { items: ["<p>one</p>", "<p>two</p>"] }, assertion_options)
    end

    test "unsafe element passed as a block argument raises" do
      template = "<div><%= items.map(&:html_safe).join %></div>"

      error = assert_raises(Herb::Engine::Runtime::HTMLSafeAssertions::UnsafeHTMLError) do
        render(template, items: ["<p>fine</p>", SCRIPT])
      end

      assert_equal [:script_element], error.violations.map(&:name)
      assert_equal SCRIPT, error.value
    end

    test "a block argument for another method is left alone" do
      template = "<div><%= items.map(&:upcase).join %></div>"

      engine = Herb::Engine.new(template, assertion_options)

      refute_includes engine.src, "HTMLSafeAssertions"
    end

    test "a block argument is wrapped whatever method it is passed to" do
      templates = [
        "<%= items.flat_map(&:html_safe) %>",
        "<%= items.each(&:html_safe) %>",
        "<%= items.select(&:html_safe) %>",
        "<%= items.sort_by(&:html_safe) %>",
        "<%= items.lazy.map(&:html_safe).first(2) %>",
        "<%= items.map &:html_safe %>",
        %(<%= items.map(&:"html_safe") %>),
        "<%= my_helper(items, &:html_safe) %>"
      ]

      templates.each do |template|
        engine = Herb::Engine.new(template, assertion_options)

        assert_includes engine.src, "HTMLSafeAssertions.check", template
      end
    end

    test "every block argument in a template is wrapped" do
      template = "<%= items.map(&:html_safe).map(&:html_safe) %>"

      engine = Herb::Engine.new(template, assertion_options)

      assert_equal 2, engine.src.scan("HTMLSafeAssertions.check").length
    end

    test "a block argument keeps behaving the way the symbol did" do
      cases = {
        "flat_map" => ["<%= items.flat_map(&:html_safe).join %>", { items: ["<p>a</p>", "<p>b</p>"] }],
        "sort_by" => ["<%= items.sort_by(&:html_safe).join %>", { items: ["<p>b</p>", "<p>a</p>"] }],
        "select" => ["<%= items.select(&:html_safe).join %>", { items: ["<p>a</p>"] }],
        "empty" => ["<%= items.map(&:html_safe).join %>", { items: [] }],
        "two yielded values" => ["<%= items.each_with_index.map(&:html_safe) %>", { items: ["<p>a</p>"] }],
        "yielded pair" => ["<%= items.map(&:html_safe) %>", { items: { "<p>a</p>" => 1 } }],
        "zipped pair" => ["<%= items.zip([1]).map(&:html_safe) %>", { items: ["<p>a</p>"] }],
        "not a string" => ["<%= items.map(&:html_safe) %>", { items: [42] }],
      }

      cases.each do |name, (template, locals)|
        without = outcome(template, locals, [])
        with = outcome(template, locals, [Herb::Engine::Visitors::HTMLSafeAssertions.new])

        assert_equal without, with, name
      end
    end

    test "unknown mode raises" do
      error = assert_raises(ArgumentError) do
        Herb::Engine::Visitors::HTMLSafeAssertions.new(mode: :overlay)
      end

      assert_equal "mode must be one of :raise, :warn, got :overlay", error.message
    end

    test "unknown check raises" do
      error = assert_raises(ArgumentError) do
        Herb::Engine::Visitors::HTMLSafeAssertions.new(ignore: [:scripts])
      end

      assert_includes error.message, "unknown check :scripts"
    end

    HTML_SAFE_TEMPLATE = "<%= @user.bio.html_safe %>"

    describe "which file the assertion names" do
      def file_argument(**properties)
        visitor = Herb::Engine::Visitors::HTMLSafeAssertions.new(**properties.delete(:visitor).to_h)
        engine = Herb::Engine.new(
          HTML_SAFE_TEMPLATE, parser_options: { strict: false }, visitors: [visitor], **properties
        )

        engine.src.split("file: ", 2).last.split(",", 2).first
      end

      test "names the template the engine was compiling" do
        assert_equal %("app/views/users/show.html.erb".freeze),
                     file_argument(filename: "app/views/users/show.html.erb")
      end

      test "names it relative to the project rather than absolutely" do
        assert_equal %("app/views/users/show.html.erb".freeze),
                     file_argument(filename: File.join(Dir.pwd, "app/views/users/show.html.erb"))
      end

      test "lets a file path passed to the visitor win over the one the engine has" do
        assert_equal %("explicit/path.html.erb".freeze),
                     file_argument(filename: "app/views/engine.html.erb",
                                   visitor: { file_path: "explicit/path.html.erb" })
      end

      test "falls back to the compiled file only when nothing knows the template" do
        assert_equal "__FILE__", file_argument
      end
    end
  end
end
