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

    test "takes the locals it was given as parameters, which is what scopes them" do
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

    describe "a project that does not keep templates in app/views" do
      def in_project(&block)
        root = Dir.mktmpdir("herb_inliner_layout")

        begin
          block.call(root)
        ensure
          FileUtils.rm_rf(root)
        end
      end

      def write_partial(root, path)
        full_path = File.join(root, path)
        FileUtils.mkdir_p(File.dirname(full_path))
        File.write(full_path, "<p>the card</p>")
      end

      def compile_in(root, filename, inline:)
        Herb::Engine.new(
          %(<div><%= render "posts/card" %></div>),
          filename: filename,
          project_path: Pathname.new(root),
          escape: false,
          visitors: inline ? [Herb::Engine::InlineRenderVisitor.new] : []
        ).src
      end

      def render_with(source)
        context = Object.new
        context.define_singleton_method(:render) { |*| "<p>the card</p>" }
        context.instance_eval(source)
      end

      test "inlines a partial when the templates sit at the project root" do
        in_project do |root|
          write_partial(root, "posts/_card.html.erb")

          refute_match(/_buf << \(render/, compile_in(root, "posts/index.html.erb", inline: true))
        end
      end

      test "still inlines a partial under app/views" do
        in_project do |root|
          write_partial(root, "app/views/posts/_card.html.erb")

          refute_match(/_buf << \(render/, compile_in(root, "app/views/posts/index.html.erb", inline: true))
        end
      end

      test "renders the same output inlined or not when templates sit at the project root" do
        in_project do |root|
          write_partial(root, "posts/_card.html.erb")

          inlined = render_with(compile_in(root, "posts/index.html.erb", inline: true))
          plain = render_with(compile_in(root, "posts/index.html.erb", inline: false))

          assert_equal "<div><p>the card</p></div>", plain
          assert_equal plain, inlined
        end
      end

      test "leaves the render call alone when the partial does not exist" do
        in_project do |root|
          FileUtils.mkdir_p(File.join(root, "posts"))

          assert_match(/_buf << \(render/, compile_in(root, "posts/index.html.erb", inline: true))
        end
      end
    end

    # A partial means what it means because of where it is, not only because of what it says. Every
    # one of these is a way the copy would have meant something else, and the copy is only worth
    # having if it means the same.
    describe "what the copy has to keep meaning" do
      def compile(source, file: "app/views/posts/index.html.erb", visitor: Herb::Engine::InlineRenderVisitor.new)
        Herb::Engine.new(source, filename: file, project_path: PROJECT_PATH, escape: false,
                                 visitors: [visitor]).src
      end

      def refute_inlined(source, **)
        assert_match(/_buf << \(render/, compile(source, **))
      end

      # `app/views/posts/_card.html.erb` and `app/views/_card.html.erb` both exist. Rails resolves a
      # partial named without a directory against the template's own.
      test "resolves a partial named without a directory against the template's directory" do
        assert_includes compile(%(<%= render "card" %>)), "<div>"
        refute_includes compile(%(<%= render "card" %>)), "root card"
      end

      test "leaves a partial that translates against its own virtual path" do
        refute_inlined(%(<%= render "shared/translated" %>))
      end

      test "leaves a partial that caches against its own virtual path" do
        refute_inlined(%(<%= render "shared/cached" %>))
      end

      # The declaration is Rails asking Rails to check what a caller passed, and the copy has no
      # signature left to check anything against.
      test "leaves a partial that declares strict locals" do
        refute_inlined(%(<%= render "shared/strict" %>))
      end

      # `shared/_fmt` exists as both `.html.erb` and `.turbo_stream.erb`, and the shared candidate
      # order puts HTML first for everyone else who asks.
      test "resolves a partial in the format the template renders in" do
        assert_includes compile(%(<%= render "shared/fmt" %>), file: "app/views/posts/index.turbo_stream.erb"),
                        "turbo version"
        assert_includes compile(%(<%= render "shared/fmt" %>)), "html version"
      end

      test "leaves a partial that reads the iteration of the collection it is rendered for" do
        refute_inlined(%(<%= render partial: "shared/counted", collection: @items %>))
      end

      # The partial would read the template's local rather than call the method of that name it
      # meant, and only where it is says which of the two it was.
      test "leaves a partial naming something the template has a local for" do
        refute_inlined(%(<% label = "template" %><%= render "shared/labelled" %>))
      end

      # A name it was passed is its own, so nothing outside can reach it.
      test "inlines it when that same name is what was passed to it" do
        assert_includes compile(%(<% label = "t" %><%= render "shared/labelled", label: "x" %>)), "->(label)"
      end

      # A name the partial assigns for itself is declared block-local where it is spliced, so it
      # never reaches the template's, and the partial does not have to be left alone over it.
      test "inlines a partial that assigns a name the template has a local for" do
        compiled = compile(%(<% label = "template" %><%= render "shared/assigns" %>))

        assert_includes compiled, "->(; label)"
        refute_includes compiled, "_buf << (render"
      end

      # The inliner resolves against the directory of the template it was given, so one kept between
      # compiles answers the next template with the last one's directory.
      test "resolves against the template it is compiling rather than the first it ever saw" do
        visitor = Herb::Engine::InlineRenderVisitor.new

        compile(%(<%= render "card" %>), file: "app/views/posts/index.html.erb", visitor: visitor)
        second = compile(%(<%= render "card" %>), file: "app/views/index.html.erb", visitor: visitor)

        assert_includes second, "root card"
      end

      test "leaves a partial that does not parse, so the error is still reported against it" do
        refute_inlined(%(<%= render "shared/broken" %>))
      end

      # Rails throws away what a non-output render returns, so putting the markup where the tag was
      # would add output the template never asked for.
      test "leaves a render that does not output" do
        compiled = compile(%(<% render "shared/header" %>))

        refute_includes compiled, "_buf << '<header>"
      end

      test "renders nothing for a collection that is nil, the way Rails does" do
        compiled = compile(%(<%= render partial: "posts/post", collection: nil %>))

        assert_includes compiled, "|| []"
      end
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
