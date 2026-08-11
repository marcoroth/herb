# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/inline_render_visitor"
require_relative "../../lib/herb/engine/instrumentation_visitor"
require_relative "../../lib/herb/engine/component_visitor"
require_relative "../../lib/herb/engine/validators"

module Engine
  class InlineRenderVisitorTest < Minitest::Spec
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
        visitors = inline ? [Herb::Engine::InlineRenderVisitor.new] : []
        visitors.push(Herb::Engine::InstrumentationVisitor.new)

        Herb::Engine.new(
          %(<%= render "posts/card" %>),
          filename: "app/views/posts/index.html.erb",
          project_path: PROJECT_PATH,
          escape: false,
          visitors: visitors
        ).src
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

      test "reports the render it no longer performs" do
        session = SESSION.capture { view.instance_eval(compiled(inline: true)) }

        node = session.report.render_tree.last

        assert_equal CARD, node[:template]
        assert_equal :partial, node[:via]
        assert_equal "1", node[:parent]
      end

      test "files what happens inside it under the partial, not the template it landed in" do
        session = SESSION.capture { view.instance_eval(compiled(inline: true)) }

        assert_equal [CARD], session.entries.map(&:template)
      end

      test "describes the page the same way as rendering the partial for real" do
        inlined = SESSION.capture { view.instance_eval(compiled(inline: true)) }.report.render_tree

        templates = inlined.map { |node| node[:template] }

        assert_equal ["app/views/posts/index.html.erb", CARD], templates
      end

      test "instruments nothing it wrote itself" do
        source = compiled(inline: true)

        assert_equal ['("app/views/posts/index.html.erb", 1, 0, :partial)'], source.scan(/Session\.enter(\([^)]*\))/).flatten
        assert_equal ["(\"#{CARD}\", 1, 5)"], source.scan(/Session\.at(\([^)]*\))/).flatten
      end

      test "reports one render per item of a collection rather than one for the lot" do
        source = %(<%= render partial: "posts/post", collection: posts %>)

        compiled = Herb::Engine.new(
          source,
          filename: "app/views/posts/index.html.erb",
          project_path: PROJECT_PATH, escape: false,
          visitors: [
            Herb::Engine::InlineRenderVisitor.new,
            Herb::Engine::InstrumentationVisitor.new
          ]
        ).src

        object = view.tap { |view| view.define_singleton_method(:posts) { [1, 2, 3] } }
        tree = SESSION.capture { object.instance_eval(compiled) }.report.render_tree

        assert_equal(3, tree.count { |node| node[:template] == "app/views/posts/_post.html.erb" })
      end

      test "keeps a partial rendered from a partial inside the one that rendered it" do
        source = %(<%= render "shared/outer" %>)
        compiled = Herb::Engine.new(
          source,
          filename: "app/views/posts/index.html.erb",
          project_path: PROJECT_PATH, escape: false,
          visitors: [
            Herb::Engine::InlineRenderVisitor.new,
            Herb::Engine::InstrumentationVisitor.new
          ]
        ).src

        tree = SESSION.capture { view.instance_eval(compiled) }.report.render_tree

        assert_equal(["app/views/shared/_outer.html.erb", "app/views/shared/_inner.html.erb"],
                     tree.drop(1).map { |node| node[:template] })
        assert_equal([tree[0][:id], tree[1][:id]], tree.drop(1).map { |node| node[:parent] })
      end

      # The inner partial is spliced into the middle of the outer one, between two of its nodes.
      # Attributing the nodes rather than what holds them split the outer partial in two, and it
      # reported as two renders with the inner one beside it rather than inside it.
      test "keeps a partial whole when another is rendered from the middle of it" do
        source = %(<%= render "shared/around" %>)
        compiled = Herb::Engine.new(
          source,
          filename: "app/views/posts/index.html.erb",
          project_path: PROJECT_PATH, escape: false,
          visitors: [
            Herb::Engine::InlineRenderVisitor.new,
            Herb::Engine::InstrumentationVisitor.new
          ]
        ).src

        tree = SESSION.capture { view.instance_eval(compiled) }.report.render_tree

        assert_equal(["app/views/shared/_around.html.erb", "app/views/shared/_inner.html.erb"],
                     tree.drop(1).map { |node| node[:template] })
        assert_equal([tree[0][:id], tree[1][:id]], tree.drop(1).map { |node| node[:parent] })
      end
    end

    describe "what the rest of the stack sees" do
      def compiled(source, visitors)
        Herb::Engine.new(
          source,
          filename: "app/views/posts/index.html.erb",
          project_path: PROJECT_PATH,
          escape: false,
          visitors: [
            Herb::Engine::InlineRenderVisitor.new, *visitors
          ]
        ).src
      end

      test "a validator refuses markup in a partial the way it refuses it in a template" do
        error = assert_raises(Herb::Engine::SecurityError) do
          compiled(%(<%= render "shared/unsafe" %>), Herb::Engine::Validators.all(fatal: true))
        end

        assert_match(/attribute/i, error.message)
      end

      test "a transforming visitor transforms what the partial brought with it" do
        compiled = compiled(%(<%= render "shared/component" %>), [Herb::Engine::ComponentVisitor.new])

        assert_includes compiled, %(render Card.new(title: "hi"))
      end
    end
  end
end
