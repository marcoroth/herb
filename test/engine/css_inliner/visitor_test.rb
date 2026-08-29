# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/inline_render/visitor"
require_relative "../../../lib/herb/engine/scoped_style/visitor"
require_relative "../../../lib/herb/engine/css_inliner/visitor"

require "lightningcss"

module Engine
  class CSSInlinerVisitorTest < Minitest::Spec
    include SnapshotUtils

    PROJECT_PATH = "test/fixtures/css_inliner"
    TEMPLATE = "app/views/posts/index.html.erb"
    ROW = "app/views/posts/_row.html.erb"

    class Raising
      def inline_fragment(*)
        raise ArgumentError, "no idea what to do with that"
      end
    end

    def options(scoped: false, filename: TEMPLATE, stylesheets: [], **overrides)
      visitors = [] #: Array[untyped]

      visitors << Herb::Engine::ScopedStyle::Visitor.new(transform: LightningCSS::Transformer.new(minify: true)) if scoped
      visitors << Herb::Engine::CSSInliner::Visitor.new(stylesheets: stylesheets, **overrides)

      { filename: filename, project_path: PROJECT_PATH, escape: false, visitors: visitors }
    end

    after do
      Herb::Engine::CSSInliner.inliner = nil
    end

    test "builds what it renders through, so a stack is the only place it has to be said" do
      Herb::Engine::CSSInliner.inliner = nil

      assert_evaluated_snapshot(%(<style>.built { color: #ff0000 }</style><h1 class="built">Hi</h1>), {}, options)
    end

    test "writes a block the template wrote into the style attribute of the markup it applies to" do
      assert_evaluated_snapshot(%(<style>.title { color: #ff0000 }</style><h1 class="title">Hi</h1>), {}, options)
    end

    test "writes a stylesheet it was compiled against into the markup" do
      assert_evaluated_snapshot(%(<div class="card">Hi</div>), {}, options(stylesheets: ["email.css"]))
    end

    test "reads stylesheets in the order it was given them, so the last one said wins" do
      assert_evaluated_snapshot(%(<div class="card">Hi</div>), {}, options(stylesheets: ["email.css", "theme.css"]))
    end

    test "reads them the other way around when it is given them the other way around" do
      assert_evaluated_snapshot(%(<div class="card">Hi</div>), {}, options(stylesheets: ["theme.css", "email.css"]))
    end

    test "writes a block a scoped style narrowed, without reaching past the file" do
      source = %(<style scoped>.title { color: #ff0000 }</style><h1 class="title">Hi</h1>)

      assert_evaluated_snapshot(source, {}, options(scoped: true))
    end

    test "holds a file whose roots are table rows together" do
      source = %(<style>.cell { color: #008000 }</style><tr class="row"><td class="cell">Cell</td></tr>)

      assert_evaluated_snapshot(source, {}, options(filename: ROW))
    end

    test "keeps the blocks when the CSS holds something a style attribute cannot say" do
      source = %(<style>.title { color: #ff0000 } .title:hover { color: #0000ff }</style><h1 class="title">Hi</h1>)

      assert_evaluated_snapshot(source, {}, options)
    end

    test "keeps the blocks when a block is built with ERB and cannot be read" do
      source = %(<style>.title { color: <%= "#ff0000" %> }</style><h1 class="title">Hi</h1>)

      assert_evaluated_snapshot(source, {}, options)
    end

    test "answers the markup as it was rendered when nothing is installed" do
      Herb::Engine::CSSInliner.inliner = nil

      assert_evaluated_snapshot(%(<style>.uninstalled { color: #ff0000 }</style><h1 class="uninstalled">Hi</h1>), {}, options)
    end

    test "answers the markup as it was rendered when the inliner fails" do
      Herb::Engine::CSSInliner.inliner =
        Herb::Engine::CSSInliner::Inliner.new(keeping: Raising.new, dropping: Raising.new)

      assert_evaluated_snapshot(%(<style>.failing { color: #ff0000 }</style><h1 class="failing">Hi</h1>), {}, options)
    end

    test "reports a stylesheet it could not read, and inlines what it has" do
      assert_evaluated_snapshot(%(<style>.a { color: #ff0000 }</style><p class="a">Hi</p>), {}, options(stylesheets: ["nope.css"]))
    end

    describe "what it asks of the passes around it" do
      def scoper(**)
        Herb::Engine::ScopedStyle::Visitor.new(transform: LightningCSS::Transformer.new(minify: true), **)
      end

      def compile(visitors)
        Herb::Engine.new(
          %(<style scoped>.title { color: #ff0000 }</style><h1 class="title">Hi</h1>),
          filename: TEMPLATE, project_path: PROJECT_PATH, escape: false, visitors: visitors
        ).src
      end

      test "reads selectors narrowed by an attribute, which is the only kind it can match" do
        compiled = compile([scoper, Herb::Engine::CSSInliner::Visitor.new])

        assert_includes compiled, "[data-herb-scope-"
        refute_includes compiled, ":where("
      end

      test "asks for nothing when the block it would have read was taken out" do
        refute_includes compile([scoper(deliver: :hoist), Herb::Engine::CSSInliner::Visitor.new]), "CSSInliner.inline"
      end

      test "refuses to run before the pass that rewrites the blocks it reads" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          compile([Herb::Engine::CSSInliner::Visitor.new, scoper])
        end

        assert_includes error.message, "has to run after"
      end
    end
  end
end
