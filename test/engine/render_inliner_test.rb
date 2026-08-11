# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/inline_render_visitor"
require_relative "../../lib/herb/engine/instrumentation_visitor"

module Engine
  class RenderInlinerTest < Minitest::Spec
    include SnapshotUtils

    PROJECT_PATH = "test/fixtures/render_inliner"
    SESSION = Herb::Engine::Report::Session
    CARD = "app/views/posts/_card.html.erb"

    test "inlines a simple partial" do
      assert_compiled_snapshot('<%= render "shared/header" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "inlines partial with locals" do
      assert_compiled_snapshot('<%= render partial: "posts/card", locals: { title: @post.title } %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "does not inline dynamic render" do
      assert_compiled_snapshot("<%= render @product %>", filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "does not inline without the visitor" do
      assert_compiled_snapshot('<%= render "shared/header" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, escape: false)
    end

    test "does not inline partial with yield" do
      assert_compiled_snapshot('<%= render "shared/wrapper" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "does not inline partial with content_for" do
      assert_compiled_snapshot('<%= render "shared/sidebar" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "does not inline partial with local_assigns" do
      assert_compiled_snapshot('<%= render "shared/item" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "inlines collection renders" do
      assert_compiled_snapshot('<%= render partial: "posts/post", collection: @posts %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "inlines collection with as: option" do
      assert_compiled_snapshot('<%= render partial: "posts/post", collection: @posts, as: :item %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "does not inline collection with spacer_template" do
      assert_compiled_snapshot('<%= render partial: "posts/post", collection: @posts, spacer_template: "posts/spacer" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "inlines nested partials" do
      assert_compiled_snapshot('<%= render "shared/outer" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "detects circular references and falls back" do
      assert_compiled_snapshot('<%= render "shared/a" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "scopes locals with begin/end block" do
      assert_compiled_snapshot('<%= render partial: "posts/card", locals: { name: "test" } %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "falls back for unresolvable partial" do
      assert_compiled_snapshot('<%= render "nonexistent/missing" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "handles Ruby 3.1 shorthand hash locals" do
      assert_compiled_snapshot('<%= render partial: "posts/card", locals: { title: } %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "inlines shorthand render with inline locals" do
      assert_compiled_snapshot('<%= render "posts/card", title: "Title" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    test "inlines shorthand render with multiple inline locals" do
      assert_compiled_snapshot('<%= render "posts/card", title: "Title", name: @user.name %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, visitors: [Herb::Engine::InlineRenderVisitor.new], escape: false)
    end

    describe "what an inlined partial still reports" do
      def compiled(inline:)
        visitors = [Herb::Engine::InstrumentationVisitor.new]
        visitors.unshift(Herb::Engine::InlineRenderVisitor.new) if inline

        Herb::Engine.new(%(<%= render "posts/card" %>), filename: "app/views/posts/index.html.erb",
                                                        project_path: PROJECT_PATH, escape: false,
                                                        visitors: visitors).src
      end

      def view
        Object.new.tap do |object|
          object.define_singleton_method(:title) { SESSION.observe(:seen, 1) && "x" }
          object.define_singleton_method(:render) { |*| "" }
        end
      end

      test "inlines the partial away" do
        assert_includes compiled(inline: true), "<div>"
        refute_includes compiled(inline: true), %(_buf << (render "posts/card"))
      end

      # A partial that was inlined never renders, so without the frames it would vanish from the
      # report and the page would describe itself differently depending on an optimization.
      test "reports the render it no longer performs" do
        session = SESSION.capture { view.instance_eval(compiled(inline: true)) }

        node = session.report.render_tree.last

        assert_equal CARD, node[:template]
        assert_equal :partial, node[:via]
        assert_equal "1", node[:parent]
      end

      # The nodes came from the partial's own source, so they carry its lines and columns. Only the
      # name had to be carried across with them.
      test "files what happens inside it under the partial, not the template it landed in" do
        session = SESSION.capture { view.instance_eval(compiled(inline: true)) }

        assert_equal [CARD], session.entries.map(&:template)
      end

      test "describes the page the same way as rendering the partial for real" do
        inlined = SESSION.capture { view.instance_eval(compiled(inline: true)) }.report.render_tree

        templates = inlined.map { |node| node[:template] }

        assert_equal ["app/views/posts/index.html.erb", CARD], templates
      end
    end
  end
end
