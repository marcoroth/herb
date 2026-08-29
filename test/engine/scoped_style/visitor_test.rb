# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/inline_render/visitor"
require_relative "../../../lib/herb/engine/scoped_style/visitor"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/runtime/middleware"

module Engine
  class ScopedStyleVisitorTest < Minitest::Spec
    include SnapshotUtils

    PROJECT_PATH = "test/fixtures/scoped_styles"
    TEMPLATE = "app/views/posts/index.html.erb"
    CARD = "app/views/posts/_card.html.erb"
    SESSION = Herb::Engine::Runtime::Session

    class Transform
      attr_reader :calls #: Array[Array[untyped]]

      def initialize
        @calls = []
      end

      def call(css, scope:)
        @calls << [css, scope]

        "#{css}/* narrowed */"
      end
    end

    class RaisingTransform
      def call(css, **)
        raise ArgumentError, "no idea what to do with that" if css.include?("!!!")

        "#{css}/* narrowed */"
      end
    end

    class WarningTransform
      Narrowed = Data.define(:css, :warnings) do
        def to_s
          css
        end
      end

      def call(css, **)
        Narrowed.new(css: "#{css}/* narrowed */", warnings: ["it kept `:deep()` without acting on it"])
      end
    end

    class Narrowing
      def call(css, scope:)
        css.gsub(/([^{}]+)\{([^{}]*)\}/) { "#{Regexp.last_match(1).strip}#{scope}{#{Regexp.last_match(2).strip}}" }
      end
    end

    class Recording
      attr_reader :calls #: Array[Array[untyped]]

      def initialize(answer: "inlined")
        @answer = answer
        @calls = []
      end

      def call(html, keep: false)
        @calls << [html, keep]

        @answer
      end
    end

    class Untransformable < Herb::Engine::ScopedStyle::Visitor
      private

      def require(*)
        raise LoadError, "cannot load such file -- lightningcss"
      end
    end

    def options(transform: Transform.new, filename: TEMPLATE, visitors: [], deliver: :inline, **overrides)
      visitor = Herb::Engine::ScopedStyle::Visitor.new(transform: transform, deliver: deliver)

      { filename: filename, escape: false, visitors: visitors + [visitor] }.merge(overrides)
    end

    def compile(source, **)
      settings = options(**)
      engine = Herb::Engine.new(source, **settings)

      [engine.src, settings[:visitors].last]
    end

    test "scopes a block to the markup written in the same file" do
      source = %(<style scoped>.title { color: red; }</style>\n<h1 class="title">Hi</h1>)

      assert_compiled_snapshot(source, options)
    end

    test "hands the block's CSS and the selector to narrow it by to the transform" do
      transform = Transform.new

      _, visitor = compile(%(<style scoped>.title { color: red; }</style><h1 class="title">Hi</h1>), transform: transform)

      scope = visitor.styles.keys.first

      assert_equal [[".title { color: red; }", "[#{scope}]"]], transform.calls
    end

    test "takes the scoped attribute back out with the space that separated it" do
      assert_compiled_snapshot(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), options)
    end

    test "puts the attribute on every element the file wrote" do
      source = %(<style scoped>.a { color: red; }</style>\n<div class="card"><h1 class="title">Hi</h1></div>)

      assert_compiled_snapshot(source, options)
    end

    test "puts it on every element it wrote and none it rendered" do
      source = %(<style scoped>.a { color: red; }</style>\n<div class="card"><h1 class="title">Hi</h1><%= render "posts/plain" %></div>)

      assert_compiled_snapshot(source, options(project_path: PROJECT_PATH))
    end

    test "counts a yield as something the file did not write" do
      source = %(<style scoped>.a { color: red; }</style><div><span><%= yield %></span></div>)

      assert_compiled_snapshot(source, options)
    end

    test "narrows a block ahead of a render written after it" do
      source = %(<style scoped>.a { color: red; }</style><div>Hi</div><%= render "posts/plain" %>)

      assert_compiled_snapshot(source, options(project_path: PROJECT_PATH))
    end

    test "attributes every root when a file has more than one" do
      source = %(<style scoped>.a { color: red; }</style>\n<header>One</header>\n<main>Two</main>\n<footer>Three</footer>)

      assert_compiled_snapshot(source, options)
    end

    test "reports a block in a file that has no markup to apply it to" do
      _, visitor = compile(%(<style scoped>.a { color: red; }</style>))

      assert_equal ["scoped-style-without-markup"], visitor.diagnostics.map(&:code)
    end

    test "leaves a style block that was not written as scoped alone" do
      assert_compiled_snapshot(%(<style>.title { color: red; }</style>\n<h1>Hi</h1>), options)
    end

    test "leaves a file with no scoped block unattributed" do
      source, visitor = compile(%(<div><span>Hi</span></div>))

      assert_equal %(_buf = ::String.new; _buf << '<div><span>Hi</span></div>'.freeze;\n_buf.to_s\n), source
      assert_empty visitor.diagnostics
      assert_empty visitor.styles
    end

    test "leaves a block built with ERB alone, because it has no CSS to read yet" do
      _, visitor = compile(%(<style scoped>.title { color: <%= @color %>; }</style><h1 class="title">Hi</h1>))

      assert_equal ["scoped-style-built-with-erb"], visitor.diagnostics.map(&:code)
      assert_empty visitor.styles
    end

    test "narrows with Lightning CSS when it was given no transform of its own" do
      _, visitor = compile(%(<style scoped>.title { color: red; }</style><h1 class="title">Hi</h1>), transform: nil)

      assert_empty visitor.diagnostics
      assert_equal 1, visitor.styles.length
      assert_includes visitor.styles.values.first, "[data-herb-scope-"
    end

    test "refuses a template compiled without a path, because a scope would not be stable" do
      _, visitor = compile(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), filename: nil)

      assert_equal ["scoped-style-without-a-file"], visitor.diagnostics.map(&:code)
      assert_empty visitor.styles
    end

    test "derives the same scope from the same file every time" do
      _, first = compile(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>))
      _, again = compile(%(<style scoped>.b { color: blue; }</style><h2>Hi</h2>))

      assert_equal first.styles.keys, again.styles.keys
    end

    test "derives a different scope for a different file" do
      _, here = compile(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>))
      _, there = compile(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), filename: CARD)

      refute_equal here.styles.keys, there.styles.keys
    end

    test "gives markup an inlined partial brought with it the partial's own scope" do
      source = %(<style scoped>.page { padding: 1rem; }</style><section class="page"><%= render "posts/card" %></section>)

      assert_compiled_snapshot(source, options(visitors: [Herb::Engine::InlineRender::Visitor.new], project_path: PROJECT_PATH))
    end

    test "leaves a partial that has no scoped block of its own unattributed" do
      source = %(<style scoped>.page { padding: 1rem; }</style><section class="page"><%= render "posts/plain" %></section>)

      assert_compiled_snapshot(source, options(visitors: [Herb::Engine::InlineRender::Visitor.new], project_path: PROJECT_PATH))
    end

    test "attributes an element a helper produced, when the parser was told about helpers" do
      source = %(<style scoped>.btn { color: red; }</style><div><%= link_to "x", "/p", class: "btn" %><%= render "posts/plain" %></div>)

      assert_compiled_snapshot(source, options(project_path: PROJECT_PATH, parser_options: { action_view_helpers: true }))
    end

    test "treats an element a helper produced as a root of its own" do
      source = %(<style scoped>.btn { color: red; }</style><%= link_to "x", "/p", class: "btn" %>)

      assert_compiled_snapshot(source, options(parser_options: { action_view_helpers: true }))
    end

    test "does not attribute a style or a script element" do
      source = %(<style scoped>.a { color: red; }</style>\n<script>console.log(1)</script>\n<div>Hi</div>)

      assert_compiled_snapshot(source, options)
    end

    test "collects the CSS it scoped, keyed by the attribute narrowing it" do
      _, visitor = compile(%(<style scoped>.title { color: red; }</style><h1 class="title">Hi</h1>))

      scope, css = visitor.styles.first

      assert_equal "data-herb-scope-2940ba8a", scope
      assert_equal ".title { color: red; }/* narrowed */", css
    end

    test "carries the scope into the markup a client rebuilds a branch from" do
      source = %(<style scoped>.b { color: red; }</style><div><% if @admin %><b>Admin</b><% else %><i>Guest</i><% end %></div><%= render "posts/plain" %>)

      assert_compiled_snapshot(
        source,
        options(visitors: [Herb::Engine::Slots::Visitor.new(mode: :client)], project_path: PROJECT_PATH)
      )
    end

    describe "delivering the CSS it narrowed" do
      def hoisted(source, filename: TEMPLATE)
        Herb::Engine.new(source, **options(filename: filename, deliver: :hoist)).src
      end

      after do
        SESSION.reset!
      end

      test "leaves the block where it was written by default" do
        assert_compiled_snapshot(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), options)
      end

      test "takes the block out and registers the CSS when told to hoist it" do
        assert_compiled_snapshot(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), options(deliver: :hoist))
      end

      test "registers a file's CSS once however many times the file renders" do
        compiled = hoisted(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), filename: CARD)
        session = SESSION.capture { 5.times { eval(compiled) } }

        assert_equal 1, session.report.channels.first.styles.length
      end

      test "keeps a scope for each file that has one" do
        page = hoisted(%(<style scoped>.page { color: red; }</style><h1>Hi</h1>))
        card = hoisted(%(<style scoped>.card { color: blue; }</style><h2>Hi</h2>), filename: CARD)

        session = SESSION.capture do
          eval(page)
          eval(card)
        end

        assert_equal 2, session.report.channels.first.styles.length
      end

      test "puts one style block in the head, whatever the page rendered" do
        compiled = hoisted(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), filename: CARD)

        app = lambda { |_env|
          body = +"<html><head></head><body>"
          5.times { body << eval(compiled) }
          body << "</body></html>"

          [200, { "content-type" => "text/html" }, [body]]
        }

        _, _, response = Herb::Engine::Runtime::Middleware.new(app).call({})

        assert_equal 1, response.first.scan("<style").length
        assert_equal 5, response.first.scan("<h1").length
      end

      test "puts nothing on a page that registered nothing" do
        app = ->(_env) { [200, { "content-type" => "text/html" }, ["<html><head></head><body></body></html>"]] }

        _, _, response = Herb::Engine::Runtime::Middleware.new(app).call({})

        assert_equal "<html><head></head><body></body></html>", response.first
      end

      test "leaves a response with no head alone" do
        compiled = hoisted(%(<style scoped>.a { color: red; }</style><h1>Hi</h1>), filename: CARD)

        app = lambda { |_env|
          [200, { "content-type" => "text/html" }, ["<div>#{eval(compiled)}</div>"]]
        }

        _, _, response = Herb::Engine::Runtime::Middleware.new(app).call({})

        assert_equal 0, response.first.scan("<style").length
      end
    end

    test "leaves a block alone, and the file unattributed, when the transform could not narrow it" do
      settings = options(transform: RaisingTransform.new)

      assert_compiled_snapshot(%(<style scoped>!!! { color: red; }</style><h1>Hi</h1>), settings)

      visitor = settings[:visitors].last

      assert_equal ["scoped-style-that-could-not-be-narrowed"], visitor.diagnostics.map(&:code)
      assert_empty visitor.styles
    end

    test "scopes the file all the same when one block narrowed and another could not" do
      source = %(<style scoped>.a { color: red; }</style><style scoped>!!! {}</style><h1 class="a">Hi</h1>)
      settings = options(transform: RaisingTransform.new)

      assert_compiled_snapshot(source, settings)

      visitor = settings[:visitors].last

      assert_equal ["scoped-style-that-could-not-be-narrowed"], visitor.diagnostics.map(&:code)
      assert_equal 1, visitor.styles.size
    end

    test "reports what the transform kept but could not act on" do
      settings = options(transform: WarningTransform.new)

      assert_compiled_snapshot(%(<style scoped>.a:deep(.b) { color: red; }</style><h1>Hi</h1>), settings)

      visitor = settings[:visitors].last

      assert_equal ["scoped-style-with-a-warning"], visitor.diagnostics.map(&:code)
      assert_equal 1, visitor.styles.size
    end

    test "visitor is not loaded when only requiring herb" do
      load_path = $LOAD_PATH.map { |path| "-I#{path}" }.join(" ")
      output = `#{Gem.ruby} #{load_path} -e 'require "herb"; print defined?(Herb::Engine::ScopedStyle::Visitor).inspect' 2>&1`

      assert_equal "nil", output
    end
    test "leaves a block alone when there is no transform to narrow it with" do
      visitor = Untransformable.new
      Herb::Engine.new(%(<style scoped>.title { color: red; }</style><h1>Hi</h1>), filename: TEMPLATE, escape: false, visitors: [visitor])

      assert_equal ["scoped-style-without-a-transform"], visitor.diagnostics.map(&:code)
      assert_empty visitor.styles
    end

    test "says why there is no transform, so that a broken install is not read as a missing one" do
      visitor = Untransformable.new
      Herb::Engine.new(%(<style scoped>.title { color: red; }</style><h1>Hi</h1>), filename: TEMPLATE, escape: false, visitors: [visitor])

      assert_includes visitor.diagnostics.first.message, "cannot load such file -- lightningcss"
    end
  end
end
