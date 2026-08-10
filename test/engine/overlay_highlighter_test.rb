# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class OverlayHighlighterTest < Minitest::Spec
    class FakeBridge
      attr_reader :html_fragments_calls

      def initialize(available: true, fragments: [], stylesheet: nil)
        @available = available
        @fragments = fragments
        @stylesheet = stylesheet
        @html_fragments_calls = []
      end

      def available?
        @available
      end

      def html_fragments(**kwargs)
        @html_fragments_calls << kwargs
        @fragments
      end

      def stylesheet(_theme = "onedark")
        @stylesheet
      end
    end

    EDITOR_ENV_KEYS = ["HERB_EDITOR", "RAILS_EDITOR", "EDITOR"].freeze

    def parser_errors_for(source)
      Herb.parse(source).errors
    end

    def with_editor(name)
      previous = EDITOR_ENV_KEYS.to_h { |key| [key, ENV.fetch(key, nil)] }

      EDITOR_ENV_KEYS.each { |key| ENV.delete(key) }
      ENV["HERB_EDITOR"] = name

      yield
    ensure
      previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    end

    def with_html_safe_shim
      shimmed = !String.method_defined?(:html_safe)

      String.class_eval { define_method(:html_safe) { self } } if shimmed

      yield
    ensure
      String.class_eval { remove_method(:html_safe) } if shimmed
    end

    def many_errors_source
      (1..10).map { |index| "<div><span>row #{index}</div>" }.join("\n")
    end

    def validation_error
      @validation_error ||= {
        message: "ERB output tags are not allowed in attribute position.",
        location: Herb::Location.from(1, 5, 1, 22),
        severity: "error",
        code: "SecurityViolation",
        source: "SecurityValidator",
        suggestion: "Use control flow instead.",
      }
    end

    test "parser overlay embeds bridge fragments and the stylesheet" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)
      fragments = errors.each_index.map { |index| "<figure class=\"herb-highlight\">CARD#{index}</figure>" }

      bridge = FakeBridge.new(fragments: fragments, stylesheet: ".herb-highlight { color: red; }")

      overlay = Herb::Engine::ParserErrorOverlay.new(source, errors, filename: "show.html.erb", bridge: bridge)
      html = overlay.generate_html

      fragments.each { |fragment| assert_includes html, fragment }
      assert_includes html, ".herb-highlight { color: red; }"
      refute_includes html, "class=\"herb-tpl-row"
      refute_includes html, "class=\"herb-tpl-plain\""
    end

    test "parser overlay places bridge fragment n inside card n" do
      source = many_errors_source
      errors = parser_errors_for(source)
      fragments = errors.each_index.map { |index| %(<figure class="herb-highlight">CARD-#{index}</figure>) }

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(fragments: fragments)
      ).generate_html

      cards = html.split("<li class=\"herb-tpl-item\"").drop(1)

      assert_equal errors.length, cards.length

      cards.each_with_index do |card, index|
        assert_includes card, "<span class=\"herb-tpl-rank\">#{index + 1}</span>"
        assert_includes card, "CARD-#{index}</figure>"
        refute_includes card, "CARD-#{index + 1}</figure>"
      end
    end

    test "parser overlay passes overlay_messages to the bridge" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      bridge = FakeBridge.new(fragments: [])
      Herb::Engine::ParserErrorOverlay.new(source, errors, bridge: bridge).generate_html

      assert_equal "both", bridge.html_fragments_calls.first[:messages]

      header_bridge = FakeBridge.new(fragments: [])
      Herb::Engine::ParserErrorOverlay.new(source, errors, overlay_messages: "header",
                                                           bridge: header_bridge).generate_html

      assert_equal "header", header_bridge.html_fragments_calls.first[:messages]
    end

    test "parser overlay requests span markers from the bridge" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      bridge = FakeBridge.new(fragments: ["<figure>CARD</figure>"])
      Herb::Engine::ParserErrorOverlay.new(source, errors, bridge: bridge).generate_html

      assert_equal "spans", bridge.html_fragments_calls.first[:markers]
    end

    test "parser overlay renders fallback markup when the bridge is unavailable" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      bridge = FakeBridge.new(available: false)
      overlay = Herb::Engine::ParserErrorOverlay.new(source, errors, bridge: bridge)
      html = overlay.generate_html

      assert_includes html, "class=\"herb-tpl-row"
      assert_includes html, "class=\"herb-tpl-row herb-tpl-row-marked\""
      assert_includes html, "class=\"herb-tpl-caret\""
      assert_includes html, "&lt;div&gt;&lt;span&gt;Content&lt;/div&gt;"
      refute_includes html, "herb-highlight"
    end

    test "parser overlay expands tabs so the fallback caret lines up with the rendered row" do
      tabbed = "\t\t<div><span>hi</div>"
      spaced = "#{" " * (Herb::Engine::ParserErrorOverlay::TAB_WIDTH * 2)}<div><span>hi</div>"

      pads = [tabbed, spaced].map do |source|
        html = Herb::Engine::ParserErrorOverlay.new(
          source, parser_errors_for(source), bridge: FakeBridge.new(available: false)
        ).generate_html

        html.scan(/<span class="herb-tpl-caret">( *)\^/).flatten.map(&:length)
      end

      refute_empty pads.first
      assert_equal pads.last, pads.first
    end

    test "parser overlay groups identical diagnostics into a single card" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)
      doubled = errors + errors

      bridge = FakeBridge.new(available: false)
      html = Herb::Engine::ParserErrorOverlay.new(source, doubled, bridge: bridge).generate_html

      assert_equal errors.length, html.scan("class=\"herb-tpl-item\"").length
      assert_operator html.scan("class=\"herb-tpl-item\"").length, :<, doubled.length
      assert_includes html, "×2"
    end

    test "parser overlay defers diagnostics past the visible limit to a disclosure" do
      source = many_errors_source
      errors = parser_errors_for(source)

      assert_equal 10, errors.length

      bridge = FakeBridge.new(available: false)
      html = Herb::Engine::ParserErrorOverlay.new(source, errors, bridge: bridge).generate_html

      boundary = html.index("<details class=\"herb-tpl-more\"")

      refute_nil boundary
      assert_equal Herb::Engine::ParserErrorOverlay::VISIBLE_LIMIT,
                   html[0...boundary].to_s.scan("class=\"herb-tpl-item\"").length
      assert_includes html, "Show 2 more diagnostics"
      assert_equal Herb::Engine::ParserErrorOverlay::OPEN_LIMIT,
                   html.scan("<details class=\"herb-tpl-card\" open>").length
      assert_equal 7, html.scan("<details class=\"herb-tpl-card\">").length
    end

    test "parser overlay marks the first card as the place to start" do
      source = many_errors_source
      errors = parser_errors_for(source)

      bridge = FakeBridge.new(available: false)
      html = Herb::Engine::ParserErrorOverlay.new(source, errors, bridge: bridge).generate_html

      assert_equal 1, html.scan("start here").length

      single_source = "<div><span>Content</div>"
      single_html = Herb::Engine::ParserErrorOverlay.new(
        single_source, parser_errors_for(single_source), bridge: FakeBridge.new(available: false)
      ).generate_html

      refute_includes single_html, "start here"
    end

    test "parser overlay separates warning severity from error severity" do
      source = "<%= 1 + %>"
      errors = parser_errors_for(source)

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(available: false)
      ).generate_html

      assert_includes html, "data-herb-tpl-severity=\"warning\""
      assert_includes html, "herb-tpl-dot-warning"
      refute_includes html, "0 errors"
      assert_includes html, "1 warning</li>"
    end

    test "parser overlay links each card to the configured editor" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      with_editor("code") do
        html = Herb::Engine::ParserErrorOverlay.new(
          source, errors,
          filename: "app/views/posts/_card.html.erb",
          project_path: "/srv/app",
          bridge: FakeBridge.new(available: false)
        ).generate_html

        assert_includes html, "href=\"vscode://file//srv/app/app/views/posts/_card.html.erb:1:5\""
      end
    end

    test "parser overlay renders a static location when no absolute path is known" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      with_editor("code") do
        html = Herb::Engine::ParserErrorOverlay.new(
          source, errors,
          filename: "app/views/posts/_card.html.erb",
          project_path: nil,
          bridge: FakeBridge.new(available: false)
        ).generate_html

        assert_includes html, "herb-tpl-tool-static"
        refute_includes html, "href=\"vscode"
      end
    end

    test "parser overlay escapes ampersands in editor urls" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      with_editor("subl") do
        html = Herb::Engine::ParserErrorOverlay.new(
          source, errors,
          filename: "app/views/posts/_card.html.erb",
          project_path: "/srv/app",
          bridge: FakeBridge.new(available: false)
        ).generate_html

        assert_includes html, "&amp;line="
        refute_includes html, "&line="
      end
    end

    test "parser overlay derives Rails chips from the template path" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      chips = lambda do |filename|
        Herb::Engine::ParserErrorOverlay.new(
          source, errors, filename: filename, bridge: FakeBridge.new(available: false)
        ).generate_html
      end

      partial = chips.call("app/views/posts/_card.html.erb")

      assert_includes partial, ">partial</li>"
      assert_includes partial, "posts/card"

      layout = chips.call("app/views/layouts/application.html.erb")

      assert_includes layout, ">layout</li>"
      refute_includes layout, "renders as"

      assert_includes chips.call("app/views/posts/show.html.erb"), ">view</li>"
      assert_includes chips.call("foo.html.erb"), ">template</li>"
    end

    test "parser overlay escapes tag names interpolated into the fix strip" do
      source = "<div>x</span>"
      errors = parser_errors_for(source)

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(available: false)
      ).generate_html

      assert_includes html, "&lt;span&gt; before the closing tag"
      refute_includes html, "<span> before the closing tag"
    end

    test "parser overlay chrome never styles a highlighter class" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(available: false)
      ).generate_html

      refute_match(/\.herb-(?!tpl-|parser-error-overlay)/, html)
    end

    test "parser overlay escapes a hostile filename in every attribute context" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)
      filename = %(app/views/"><script>alert(1)</script>/_x'.html.erb)

      with_editor("code") do
        html = Herb::Engine::ParserErrorOverlay.new(
          source, errors, filename: filename, project_path: "/srv/app", bridge: FakeBridge.new(available: false)
        ).generate_html

        refute_includes html, "<script>alert(1)</script>"
        refute_includes html, %(alert(1)</script>/_x'.html.erb")

        assert_includes html, "data-herb-tpl-file=\"app/views/&quot;&gt;&lt;script&gt;"
        assert_includes html, "data-herb-tpl-copy=\"app/views/&quot;&gt;&lt;script&gt;"
        assert_includes html, "href=\"vscode://file//srv/app/app/views/&quot;&gt;&lt;script&gt;"
        assert_includes html, "&lt;/script&gt;/_x&#39;.html.erb"
      end
    end

    test "engine round-trips backslashes in the template source through the compiled overlay" do
      single = "\\"
      double = "\\" * 2
      excerpt = "a#{single}b#{double}c#{double}#{double}d"
      source = "<div><span>#{excerpt}</div>"

      engine = Herb::Engine.new(source, validation_mode: :overlay, highlighter: false)
      rendered = with_html_safe_shim { Object.new.instance_eval(engine.src) }

      assert_includes engine.src, "html_safe"
      assert_includes rendered.to_s, "class=\"herb-tpl-row"
      assert_includes rendered.to_s, excerpt
    end

    test "parser overlay keeps the dev-tools root contract" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(available: false)
      ).generate_html

      assert_includes html, "class=\"herb-parser-error-overlay"
      assert_includes html, "display: flex;"
    end

    test "parser overlay emits script-only controls hidden" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(available: false)
      ).generate_html

      assert_includes html, "aria-label=\"Copy location\" hidden"
      assert_includes html, "data-herb-tpl-dismiss aria-label=\"Dismiss overlay\" hidden"
      assert_includes html, "data-herb-tpl-esc hidden"
    end

    test "parser overlay returns an empty string without errors" do
      overlay = Herb::Engine::ParserErrorOverlay.new("<div></div>", [], bridge: FakeBridge.new(available: false))

      assert_equal "", overlay.generate_html
    end

    test "parser overlay script declares a single root binding" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      html = Herb::Engine::ParserErrorOverlay.new(
        source, errors, bridge: FakeBridge.new(available: false)
      ).generate_html

      refute_includes html, "const overlay"
      assert_equal 1, html.scan("var root =").length
    end

    test "validation overlay embeds a bridge fragment inside the code snippet" do
      source = "<div <%= @malicious %>>Content</div>"
      fragment = "<figure class=\"herb-highlight\">VCARD</figure>"

      bridge = FakeBridge.new(fragments: [fragment])
      overlay = Herb::Engine::ValidationErrorOverlay.new(source, validation_error, filename: "show.html.erb",
                                                                                   bridge: bridge)
      html = overlay.generate_fragment

      assert_includes html, fragment
      assert_includes html, "herb-code-snippet"
      assert_includes html, "herb-validation-header"
      assert_includes html, "ERB output tags are not allowed in attribute position."
      assert_includes html, "Use control flow instead."
      refute_includes html, "<div class=\"herb-code-line"

      call = bridge.html_fragments_calls.first

      assert_equal [validation_error], call[:errors]
      assert_equal "both", call[:messages]
      assert_equal "spans", call[:markers]
    end

    test "validation overlay renders fallback markup when the bridge is unavailable" do
      source = "<div <%= @malicious %>>Content</div>"

      bridge = FakeBridge.new(available: false, fragments: [])
      overlay = Herb::Engine::ValidationErrorOverlay.new(source, validation_error, bridge: bridge)
      html = overlay.generate_fragment

      assert_includes html, "herb-code-line herb-error-line"
      assert_includes html, "&lt;div &lt;%= @malicious %&gt;&gt;Content&lt;/div&gt;"
      assert_includes html, "herb-error-pointer"
      refute_includes html, "herb-highlight"
    end

    test "engine renders fallback overlays with highlighter disabled" do
      engine = Herb::Engine.new(
        "<div><span>Content</div>",
        validation_mode: :overlay,
        highlighter: false
      )

      assert_includes engine.src, "class=\"herb-tpl-row"
      refute_includes engine.src, "herb-highlight"
    end

    test "engine renders fallback validation overlays with highlighter disabled" do
      engine = Herb::Engine.new(
        "<div <%= @malicious %>>Content</div>",
        validation_mode: :overlay,
        highlighter: false
      )

      assert_includes engine.src, "herb-code-line"
      refute_includes engine.src, "herb-highlight"
    end

    test "engine rejects unknown overlay_messages values" do
      error = assert_raises(ArgumentError) do
        Herb::Engine.new("<div></div>", overlay_messages: "hover")
      end

      assert_includes error.message, "overlay_messages must be one of"
      assert_includes error.message, "hover"
    end
  end
end
