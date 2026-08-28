# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/inline_render_visitor"
require_relative "../../../lib/herb/engine/scoped_style/visitor"

require "lightningcss"

module Engine
  class ScopedStyleInlinerTest < Minitest::Spec
    include SnapshotUtils

    PROJECT_PATH = "test/fixtures/scoped_styles"
    TEMPLATE = "app/views/posts/index.html.erb"
    ROW = "app/views/posts/_row.html.erb"

    class Raising
      def inline_fragment(*)
        raise ArgumentError, "no idea what to do with that"
      end
    end

    def options(inline: false, filename: TEMPLATE, **overrides)
      visitors = inline ? [Herb::Engine::InlineRenderVisitor.new] : []

      visitors << Herb::Engine::ScopedStyle::Visitor.new(
        transform: LightningCSS::Transformer.new(minify: true),
        deliver: :style_attributes,
        **overrides
      )

      { filename: filename, project_path: PROJECT_PATH, escape: false, visitors: visitors }
    end

    before do
      Herb::Engine::ScopedStyle.inliner = Herb::Engine::ScopedStyle::Inliner.new
    end

    after do
      Herb::Engine::ScopedStyle.inliner = nil
    end

    test "writes the CSS into the style attribute of the markup it applies to" do
      assert_evaluated_snapshot(%(<style scoped>.title { color: #ff0000 }</style><h1 class="title">Hi</h1>), {}, options)
    end

    test "reaches an element the file wrote below its roots" do
      source = %(<style scoped>.title { color: #ff0000 }</style><div><h1 class="title">Hi</h1></div>)

      assert_evaluated_snapshot(source, {}, options)
    end

    test "leaves markup the file did not write alone" do
      source = %(<style scoped>.title { color: #ff0000 }</style><h1 class="title">Hi</h1><%= render "posts/plain" %>)

      assert_evaluated_snapshot(source, {}, options(inline: true))
    end

    test "holds a file whose roots are table rows together" do
      source = %(<style scoped>.cell { color: #008000 }</style><tr class="row"><td class="cell">Cell</td></tr>)

      assert_evaluated_snapshot(source, {}, options(filename: ROW))
    end

    test "keeps the block when the CSS holds something a style attribute cannot say" do
      source = %(<style scoped>.title { color: #ff0000 } .title:hover { color: #0000ff }</style><h1 class="title">Hi</h1>)

      assert_evaluated_snapshot(source, {}, options)
    end

    test "keeps the block when the CSS is held in a media query" do
      source = %(<style scoped>@media (min-width: 40em) { .title { color: #ff0000 } }</style><h1 class="title">Hi</h1>)

      assert_evaluated_snapshot(source, {}, options)
    end

    test "answers the markup as it was rendered when nothing is installed" do
      Herb::Engine::ScopedStyle.inliner = nil

      assert_evaluated_snapshot(%(<style scoped>.uninstalled { color: #ff0000 }</style><h1 class="uninstalled">Hi</h1>), {}, options)
    end

    test "answers the markup as it was rendered when the inliner fails" do
      Herb::Engine::ScopedStyle.inliner =
        Herb::Engine::ScopedStyle::Inliner.new(keeping: Raising.new, dropping: Raising.new)

      assert_evaluated_snapshot(%(<style scoped>.failing { color: #ff0000 }</style><h1 class="failing">Hi</h1>), {}, options)
    end
  end
end
