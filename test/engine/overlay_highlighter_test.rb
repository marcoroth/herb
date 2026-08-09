# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class OverlayHighlighterTest < Minitest::Spec
    class FakeBridge
      attr_reader :html_fragments_calls, :markers_script

      def initialize(available: true, fragments: [], stylesheet: nil, markers_script: nil)
        @available = available
        @fragments = fragments
        @stylesheet = stylesheet
        @markers_script = markers_script
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

    def parser_errors_for(source)
      Herb.parse(source).errors
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

    test "parser overlay embeds bridge fragments, stylesheet, and hydration script" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)
      fragments = errors.each_index.map { |index| "<figure class=\"herb-highlight\">CARD#{index}</figure>" }

      bridge = FakeBridge.new(
        fragments: fragments,
        stylesheet: ".herb-highlight { color: red; }",
        markers_script: "console.log(\"hydrate\")"
      )

      overlay = Herb::Engine::ParserErrorOverlay.new(source, errors, filename: "show.html.erb", bridge: bridge)
      html = overlay.generate_html

      fragments.each { |fragment| assert_includes html, fragment }
      assert_includes html, ".herb-highlight { color: red; }"
      assert_includes html, "console.log(\"hydrate\")"
      refute_includes html, "<div class=\"herb-code-line"
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

    test "parser overlay renders fallback markup when the bridge is unavailable" do
      source = "<div><span>Content</div>"
      errors = parser_errors_for(source)

      bridge = FakeBridge.new(available: false)
      overlay = Herb::Engine::ParserErrorOverlay.new(source, errors, bridge: bridge)
      html = overlay.generate_html

      assert_includes html, "herb-code-line"
      assert_includes html, "herb-line-number"
      assert_includes html, "&lt;div&gt;&lt;span&gt;Content&lt;/div&gt;"
      assert_includes html, "herb-error-pointer"
      refute_includes html, "herb-highlight"
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
