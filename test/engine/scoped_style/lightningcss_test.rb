# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/visitors/inline_render"
require_relative "../../../lib/herb/engine/scoped_style/visitor"

require "lightningcss"

module Engine
  class ScopedStyleLightningCSSTest < Minitest::Spec
    include SnapshotUtils

    PROJECT_PATH = "test/fixtures/scoped_styles"
    TEMPLATE = "app/views/posts/index.html.erb"

    def options(inline: false, **overrides)
      visitors = inline ? [Herb::Engine::Visitors::InlineRender.new] : []

      visitors << Herb::Engine::ScopedStyle::Visitor.new(
        transform: LightningCSS::Transformer.new(minify: true),
        **overrides
      )

      { filename: TEMPLATE, project_path: PROJECT_PATH, escape: false, visitors: visitors }
    end

    test "narrows by ancestor when the file renders nothing" do
      assert_compiled_snapshot(%(<style scoped>.title { color: #ff0000 }</style><h1 class="title">Hi</h1>), options)
    end

    test "narrows by the element itself when the file renders something" do
      source = %(<style scoped>.title { color: #ff0000 }</style><h1 class="title">Hi</h1><%= render "posts/plain" %>)

      assert_compiled_snapshot(source, options)
    end

    test "minifies what it narrowed" do
      source = %(<style scoped>.a { color: #ff0000; font-weight: bold }</style><h1>Hi</h1>)

      assert_compiled_snapshot(source, options)
    end

    test "leaves keyframe selectors alone" do
      source = %(<style scoped>@keyframes spin { from { opacity: 0 } } .a { animation: spin 1s }</style><h1>Hi</h1>)

      assert_compiled_snapshot(source, options)
    end

    test "puts the scope ahead of a pseudo element" do
      assert_compiled_snapshot(%(<style scoped>.item::before { content: "x" }</style><h1>Hi</h1>), options)
    end

    test "leaves the inside of a functional pseudo class alone" do
      assert_compiled_snapshot(%(<style scoped>.x:not(.y) { color: red }</style><h1>Hi</h1>), options)
    end

    test "gives an inlined partial its own scope, and narrows its CSS to it" do
      source = %(<style scoped>.page { color: #ff0000 }</style><section class="page"><%= render "posts/card" %></section>)

      assert_compiled_snapshot(source, options(inline: true))
    end

    test "registers the narrowed CSS when it hoists" do
      source = %(<style scoped>.a { color: #ff0000 }</style><h1>Hi</h1>)

      assert_compiled_snapshot(source, options(deliver: :hoist))
    end

    test "leaves a block it could not parse as it was written, instead of raising" do
      assert_compiled_snapshot(%(<style scoped>!!! { color: red }</style><h1>Hi</h1>), options)
    end

    test "reports what Lightning CSS kept without acting on" do
      assert_compiled_snapshot(%(<style scoped>.a:deep(.b) { color: red }</style><h1>Hi</h1>), options)
    end
  end
end
