# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/visitors/source_attribution_visitor"
require_relative "../../../lib/herb/engine/inline_render/visitor"
require_relative "../../../lib/herb/engine/visitors/optimize_visitor"

module Engine
  class SourceAttributionTest < Minitest::Spec
    include SnapshotUtils

    FILENAME = "app/views/posts/_card.html.erb"
    PROJECT_PATH = "test/fixtures/render_inliner"

    def attribution_options(**overrides)
      {
        escape: false,
        visitors: [Herb::Engine::SourceAttributionVisitor.new],
      }.merge(overrides)
    end

    test "visitor is not loaded when only requiring herb" do
      load_path = $LOAD_PATH.map { |path| "-I#{path}" }.join(" ")
      output = `#{Gem.ruby} #{load_path} -e 'require "herb"; print defined?(Herb::Engine::SourceAttributionVisitor).inspect' 2>&1`

      assert_equal "nil", output
    end

    describe "what it stamps" do
      test "a single element" do
        assert_evaluated_snapshot("<div>Hello</div>", {}, attribution_options, filename: FILENAME)
      end

      test "each element with its own position" do
        template = <<~ERB
          <div class="card">
            <h1>Title</h1>
            <p>Body</p>
          </div>
        ERB

        assert_evaluated_snapshot(template, {}, attribution_options, filename: FILENAME)
      end

      test "a void element" do
        assert_evaluated_snapshot(%(<img src="a.png">), {}, attribution_options, filename: FILENAME)
      end

      test "an element that already carries attributes" do
        assert_evaluated_snapshot(%(<a href="/" class="link">Home</a>), {}, attribution_options, filename: FILENAME)
      end

      test "an element with a dynamic attribute" do
        assert_evaluated_snapshot(%(<div class="<%= level %>">x</div>), { level: "high" }, attribution_options, filename: FILENAME)
      end

      test "an element carrying a whole attribute list from ERB" do
        assert_evaluated_snapshot("<div <%= attributes %>>x</div>", { attributes: %(id="one") }, attribution_options, filename: FILENAME)
      end

      test "an element inside a conditional" do
        assert_evaluated_snapshot("<% if visible %><span>x</span><% end %>", { visible: true }, attribution_options, filename: FILENAME)
      end

      test "the template it was written in when no filename is given" do
        assert_evaluated_snapshot("<div>x</div>", {}, attribution_options)
      end
    end

    describe "a tag helper the parser resolved" do
      test "is stamped at the position of the tag that asked for it" do
        assert_evaluated_snapshot(%(<%= link_to "Home", "/" %>), {}, attribution_options, filename: FILENAME)
      end

      test "keeps the attributes the helper was given" do
        assert_evaluated_snapshot(%(<%= link_to "Home", "/", class: "nav" %>), {}, attribution_options, filename: FILENAME)
      end

      test "is stamped when an attribute is only known at render time" do
        assert_evaluated_snapshot(%(<%= content_tag :div, "x", class: level %>), { level: "high" }, attribution_options, filename: FILENAME)
      end

      test "is stamped in its block form" do
        assert_evaluated_snapshot(%(<%= link_to "/" do %>body<% end %>), {}, attribution_options, filename: FILENAME)
      end

      test "is stamped inside surrounding markup, which keeps its own position" do
        template = <<~ERB
          <nav>
            <%= link_to "Home", "/" %>
          </nav>
        ERB

        assert_evaluated_snapshot(template, {}, attribution_options, filename: FILENAME)
      end

      test "is left alone when the host turns the recommendation down" do
        options = attribution_options(parser_options: { action_view_helpers: false, track_locations: true })

        assert_compiled_snapshot(%(<div><%= link_to "Home", "/" %></div>), options, filename: FILENAME)
      end

      test "is stamped without the caller asking, once a visitor that requires the option is in the stack" do
        options = attribution_options(
          visitors: [
            Herb::Engine::OptimizeVisitor.new,
            Herb::Engine::SourceAttributionVisitor.new
          ]
        )

        assert_evaluated_snapshot(%(<nav><%= link_to "Home", "/" %></nav>), {}, options, filename: FILENAME)
      end
    end

    describe "a helper the parser cannot resolve to a tag" do
      test "is left alone, and the markup around it keeps its stamp" do
        template = <<~ERB
          <div>
            <%= form_with url: "/" do |form| %>
              inner
            <% end %>
          </div>
        ERB

        assert_compiled_snapshot(template, attribution_options, filename: FILENAME)
      end
    end

    describe "what it leaves alone" do
      test "markup that arrives from Ruby, the way a helper builds it" do
        template = <<~ERB
          <div>
            <%= button %>
          </div>
        ERB

        assert_evaluated_snapshot(template, { button: %(<button type="submit">Go</button>) }, attribution_options, filename: FILENAME)
      end

      test "an element whose tag name is built at runtime" do
        assert_evaluated_snapshot("<<%= tag_name %>>x</<%= tag_name %>>", { tag_name: "div" }, attribution_options, filename: FILENAME)
      end

      test "an element that is already stamped" do
        options = attribution_options(
          visitors: [
            Herb::Engine::SourceAttributionVisitor.new,
            Herb::Engine::SourceAttributionVisitor.new
          ]
        )

        assert_evaluated_snapshot("<div>x</div>", {}, options, filename: FILENAME)
      end
    end

    describe "an element that renders more than once" do
      test "carries the line it was written at, not the line it rendered at" do
        template = <<~ERB
          <ul>
            <% items.each do |item| %>
              <li><%= item %></li>
            <% end %>
          </ul>
        ERB

        assert_evaluated_snapshot(template, { items: ["a", "b", "c"] }, attribution_options, filename: FILENAME)
      end
    end

    describe "a partial brought in by the inliner" do
      def inlined_options
        {
          escape: false,
          project_path: PROJECT_PATH,
          visitors: [
            Herb::Engine::InlineRender::Visitor.new,
            Herb::Engine::SourceAttributionVisitor.new
          ],
        }
      end

      test "is stamped with the file it was written in" do
        assert_evaluated_snapshot(
          %(<main><%= render "shared/header" %></main>),
          {},
          inlined_options,
          filename: "app/views/posts/index.html.erb"
        )
      end

      test "hands the surrounding template back after the partial ends" do
        assert_evaluated_snapshot(
          %(<main><%= render "shared/header" %><footer>end</footer></main>),
          {},
          inlined_options,
          filename: "app/views/posts/index.html.erb"
        )
      end
    end

    describe "the attribute" do
      test "can be named by the caller" do
        options = attribution_options(
          visitors: [Herb::Engine::SourceAttributionVisitor.new(attribute: "data-origin")]
        )

        assert_evaluated_snapshot("<div>x</div>", {}, options, filename: FILENAME)
      end

      test "escapes a value that would close it" do
        assert_evaluated_snapshot("<div>x</div>", {}, attribution_options, filename: %(a"b.html.erb))
      end
    end

    describe "inspect" do
      test "names the visitor" do
        assert_equal "#<Herb::Engine::SourceAttributionVisitor>", Herb::Engine::SourceAttributionVisitor.new.inspect
      end

      test "names a custom attribute" do
        visitor = Herb::Engine::SourceAttributionVisitor.new(attribute: "data-origin")

        assert_equal %(#<Herb::Engine::SourceAttributionVisitor attribute="data-origin">), visitor.inspect
      end
    end

    describe "parser options" do
      test "requires locations to be tracked" do
        assert_equal({ track_locations: true }, Herb::Engine::SourceAttributionVisitor.required_parser_options)
      end

      test "recommends that the parser understands tag helpers" do
        assert_equal({ action_view_helpers: true }, Herb::Engine::SourceAttributionVisitor.recommended_parser_options)
      end

      test "warns, without raising, when a compile turns tag helpers off" do
        _, stderr = capture_io do
          Herb::Engine.new("<div>x</div>", parser_options: { action_view_helpers: false }, visitors: [Herb::Engine::SourceAttributionVisitor.new])
        end

        assert_equal "[Herb] Herb::Engine::SourceAttributionVisitor recommends the `action_view_helpers` parser option to be true, but it is set to false\n", stderr
      end

      test "conflicts with a compile that turns location tracking off" do
        error = assert_raises(ArgumentError) do
          Herb::Engine.new("<div>x</div>", parser_options: { track_locations: false }, visitors: [Herb::Engine::SourceAttributionVisitor.new])
        end

        assert_equal "Herb::Engine::SourceAttributionVisitor requires the `track_locations` parser option to be true, but it is set to false", error.message
      end
    end
  end
end
