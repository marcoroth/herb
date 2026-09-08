# frozen_string_literal: true

require "json"
require "tmpdir"
require "fileutils"

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    class BindingsTest < Minitest::Spec
      Bindings = Herb::Engine::Slots::Bindings

      CARD = <<~ERB
        <%# herb:slots client %>
        <%# herb:state (open: false, label: "", count: 0) %>
        <p><% if open %>open<% else %>shut<% end %> <%= label %> <%= count %></p>
      ERB

      CALLER = <<~ERB
        <%# herb:slots client %>
        <%# herb:state (modal_open: false, page: 1, title: "") %>
        <div><%= render "shared/album_card", album: a, state: { open: modal_open } %></div>
      ERB

      class View
        attr_reader :frames

        def initialize(rendered)
          @rendered = rendered
          @frames = []
        end

        def render(*)
          @frames << Bindings.current("app/views/shared/_album_card.html.erb")

          @rendered
        end

        def a
          "album"
        end
      end

      def with_project
        Dir.mktmpdir("herb-bindings") do |root|
          @root = root

          write("app/views/shared/_album_card.html.erb", CARD)

          yield root
        end
      end

      def write(relative, source)
        path = File.join(@root, relative)

        FileUtils.mkdir_p(File.dirname(path))
        File.write(path, source)

        path
      end

      def compile(source, identifier: :path, relative: "app/views/overlays/show.html.erb")
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client, identifier: identifier)
        engine = Herb::Engine.new(source, visitors: [visitor], filename: File.join(@root, relative), project_path: @root)

        [visitor, engine.src]
      end

      def refusal(source)
        error = assert_raises(Herb::Engine::CompilationError) { compile(source) }

        error.diagnostics.map(&:message).join("\n")
      end

      def caller_with(state)
        CALLER.sub("state: { open: modal_open }", "state: #{state}")
      end

      test "a binding lands in the manifest keyed by the child slot" do
        with_project do
          visitor, = compile(CALLER)

          assert_equal(
            { "0" => { "identifier" => "app/views/shared/_album_card.html.erb", "partial" => "shared/album_card", "states" => { "open" => "modal_open" } } },
            visitor.manifest["bindings"]
          )
          assert_empty visitor.diagnostics
        end
      end

      test "the compiled call carries the wrapper and no state argument" do
        with_project do
          _, src = compile(CALLER)

          assert_match(%r{Bindings\.with\("app/views/shared/_album_card\.html\.erb", bound: \{ "open" => modal_open \}, seeded: \{  \}\) \{ render "shared/album_card", album: a \}}, src)
          refute_match(/state:/, src)
        end
      end

      test "the child slot's expression is the stripped call" do
        with_project do
          visitor, = compile(CALLER)

          assert_equal %(render "shared/album_card", album: a), visitor.slots.fetch(0).expression.to_s.strip
        end
      end

      test "a bound state is not a server read of the child slot" do
        with_project do
          visitor, = compile(CALLER)

          assert_empty visitor.manifest["states"]["server"]["reads"]
        end
      end

      test "a render that is an element's only child keeps its comment markers" do
        with_project do
          _, src = compile(CALLER)
          view = View.new("<partial/>")
          rendered = view.instance_eval(src)

          assert_match(%r{<div><!--herb-slot:0--><partial/><!--/herb-slot:0--></div>}, rendered)
          refute_match(/data-herb-slot="0:child"/, rendered)
        end
      end

      test "the render sees the frame with the caller's current value" do
        with_project do
          _, src = compile(CALLER)
          view = View.new("<partial/>")

          view.instance_eval(src)

          assert_equal [{ bound: { "open" => false }, seeded: {} }], view.frames
        end
      end

      test "a bare value that is not a caller state and an expression both seed the partial" do
        with_project do
          visitor, src = compile(caller_with("{ open: modal_open, label: \"hi\", count: page + 1 }"))

          assert_equal({ "open" => "modal_open" }, visitor.manifest["bindings"].fetch("0").fetch("states"))
          assert_match(/seeded: \{ "label" => \("hi"\), "count" => \(page \+ 1\) \}/, src)
        end
      end

      test "the ruby shorthand binds the caller state of the same name" do
        with_project do
          write("app/views/shared/_album_card.html.erb", CARD.sub("count: 0", "page: 0"))

          visitor, = compile(caller_with("{ page: }"))

          assert_equal({ "page" => "page" }, visitor.manifest["bindings"].fetch("0").fetch("states"))
        end
      end

      test "a binding changes the version of the template that carries it" do
        with_project do
          bound, = compile(CALLER)
          unbound, = compile(CALLER.sub(", state: { open: modal_open }", ""))
          rebound, = compile(CALLER.sub("modal_open }", "title }").sub("open: title", "label: title"))

          refute_equal unbound.version, bound.version
          refute_equal bound.version, rebound.version
        end
      end

      test "digest identifiers on both sides agree" do
        with_project do
          visitor, = compile(CALLER, identifier: :digest)
          partial = Herb::Engine::Slots::Visitor.new(mode: :client, identifier: :digest)

          Herb::Engine.new(CARD, visitors: [partial], filename: File.join(@root, "app/views/shared/_album_card.html.erb"), project_path: @root)

          assert_equal partial.identifier, visitor.manifest["bindings"].fetch("0").fetch("identifier")
          assert_match(/\A[0-9a-f]{12}\z/, partial.identifier)
        end
      end

      test "a partial that cannot be found is refused" do
        with_project do
          error = assert_raises(Herb::Engine::CompilationError) { compile(CALLER.sub("shared/album_card", "shared/album_cards")) }
          diagnostic = error.diagnostics.fetch(0)

          assert_equal "`shared/album_cards` could not be found from `app/views/overlays/show.html.erb`, and `state:` needs a partial the compiler can open.", diagnostic.message
          assert_equal "Did you mean `shared/album_card`?", diagnostic.suggestion
        end
      end

      test "a partial named without its directory is refused" do
        with_project do
          write("app/views/overlays/_album_card.html.erb", CARD)

          assert_match(/`state:` needs the partial's directory in its name, since `album_card` resolves through the controller's view paths/, refusal(CALLER.sub("shared/album_card", "album_card")))
        end
      end

      test "a near miss of a caller state warns and seeds" do
        with_project do
          visitor, = compile(caller_with("{ open: modal_opne }"))

          assert_match(/Did you mean `modal_open`/, visitor.diagnostics.select(&:warning?).map(&:message).join)
          assert_empty visitor.manifest["bindings"]
        end
      end

      test "a splat keeps state an ordinary local" do
        with_project do
          visitor, src = compile(caller_with("{ open: modal_open, **extra }"))

          assert_empty visitor.manifest["bindings"]
          assert_match(%r{render "shared/album_card", album: a, state: \{ open: modal_open, \*\*extra \}}, src)
          refute_match(/Bindings\.with/, src)
        end
      end

      test "a string key keeps state an ordinary local" do
        with_project do
          visitor, src = compile(caller_with("{ \"open\" => modal_open }"))

          assert_empty visitor.manifest["bindings"]
          assert_match(%r{render "shared/album_card", album: a, state: \{ "open" => modal_open \}}, src)
          refute_match(/Bindings\.with/, src)
        end
      end

      test "a state argument ahead of the locals is stripped with its comma" do
        with_project do
          source = CALLER.sub(%(album: a, state: { open: modal_open }), %(state: { open: modal_open }, album: a))
          visitor, src = compile(source)

          assert_match(%r{Bindings\.with\([^)]*\) \{ render "shared/album_card", album: a \}}, src)
          assert_equal %(render "shared/album_card", album: a), visitor.slots.fetch(0).expression.to_s.strip
        end
      end

      test "a multibyte local ahead of the state argument does not shift the splice" do
        with_project do
          source = CALLER.sub("album: a,", %(album: "Zürich",))
          visitor, src = compile(source)

          assert_match(%r{Bindings\.with\([^)]*\) \{ render "shared/album_card", album: "Zürich" \}}, src)
          assert_equal %(render "shared/album_card", album: "Zürich"), visitor.slots.fetch(0).expression.to_s.strip
        end
      end

      test "a render spread over several lines is stripped by position" do
        with_project do
          source = CALLER.sub(%(render "shared/album_card", album: a, state: { open: modal_open }), "render \"shared/album_card\",\n      album: a,\n      state: { open: modal_open }")
          visitor, src = compile(source)

          assert_match(%r{Bindings\.with\([^)]*\) \{ render "shared/album_card",\n      album: a \}}, src)
          assert_equal "render \"shared/album_card\",\n      album: a", visitor.slots.fetch(0).expression.to_s.strip
        end
      end

      test "a duplicate key is refused" do
        with_project { assert_match(/binds `open` twice/, refusal(caller_with("{ open: modal_open, open: title }"))) }
      end

      test "a block render is refused" do
        with_project do
          source = CALLER.sub("state: { open: modal_open } %>", "state: { open: modal_open } do %>inside<% end %>")

          assert_match(/cannot bind a partial rendered with a block/, refusal(source))
        end
      end

      test "a render that picks its template at runtime is refused" do
        with_project do
          source = CALLER.sub(%(render "shared/album_card", album: a, state: { open: modal_open }), "render @card, state: { open: modal_open }")

          assert_match(/picks its template at runtime/, refusal(source))
        end
      end

      test "a derived caller state is refused" do
        with_project do
          source = CALLER.sub("title: \"\"", "title: \"\", busy: page > 3").sub("open: modal_open", "open: busy")

          assert_match(/`busy` is a derived state/, refusal(source))
        end
      end

      test "a binding whose kinds disagree is refused" do
        with_project { assert_match(%r{`open` on `shared/album_card` is a boolean state and `title` is a string one}, refusal(caller_with("{ open: title }"))) }
      end

      test "a literal seed whose kind disagrees is refused" do
        with_project { assert_match(%r{`count` on `shared/album_card` is an integer state, and `"many"` seeds it with a string value}, refusal(caller_with("{ count: \"many\" }"))) }
      end

      test "a state the partial never declares is refused" do
        with_project { assert_match(/declares no state `missing`/, refusal(caller_with("{ missing: modal_open }"))) }
      end

      test "a derived state of the partial is refused" do
        with_project do
          write("app/views/shared/_album_card.html.erb", CARD.sub("count: 0", "count: 0, full: count > 2"))

          assert_match(%r{`full` is a derived state of `shared/album_card`}, refusal(caller_with("{ full: modal_open }")))
        end
      end

      test "a literal of every kind seeds a state of that kind" do
        with_project do
          write("app/views/shared/_album_card.html.erb", CARD.sub("count: 0", "count: 0, tone: :warm, note: nil"))

          visitor, src = compile(caller_with(%({ open: true, label: "hi", count: 3, tone: :cool, note: nil })))

          assert_empty visitor.diagnostics
          assert_empty visitor.manifest["bindings"]
          assert_match(/seeded: \{ "open" => \(true\), "label" => \("hi"\), "count" => \(3\), "tone" => \(:cool\), "note" => \(nil\) \}/, src)
        end
      end

      test "a literal seed reaches the render as the partial's starting value" do
        with_project do
          _, src = compile(caller_with(%({ count: -1, label: "hi" })))
          view = View.new("<partial/>")

          view.instance_eval(src)

          assert_equal({ "count" => -1, "label" => "hi" }, view.frames.fetch(0).fetch(:seeded))
          assert_empty view.frames.fetch(0).fetch(:bound)
        end
      end

      test "nil seeds a state of any kind" do
        with_project do
          visitor, src = compile(caller_with("{ open: nil, count: nil, label: nil }"))

          assert_empty visitor.diagnostics
          assert_match(/seeded: \{ "open" => \(nil\), "count" => \(nil\), "label" => \(nil\) \}/, src)
        end
      end

      test "an interpolated string seeds as an expression" do
        with_project do
          _, src = compile(caller_with(%({ label: "album \#{a}" })))
          view = View.new("<partial/>")

          view.instance_eval(src)

          assert_equal({ "label" => "album album" }, view.frames.fetch(0).fetch(:seeded))
        end
      end

      test "a boolean literal is refused on a string state" do
        with_project { assert_match(%r{`label` on `shared/album_card` is a string state, and `true` seeds it with a boolean value}, refusal(caller_with("{ label: true }"))) }
      end

      test "an integer literal is refused on a boolean state" do
        with_project { assert_match(%r{`open` on `shared/album_card` is a boolean state, and `1` seeds it with an integer value}, refusal(caller_with("{ open: 1 }"))) }
      end

      test "a symbol literal is refused on an integer state" do
        with_project { assert_match(%r{`count` on `shared/album_card` is an integer state, and `:many` seeds it with a symbol value}, refusal(caller_with("{ count: :many }"))) }
      end

      test "a float literal is refused" do
        with_project { assert_match(%r{`1\.5` seeds `count` on `shared/album_card` with a Float\. Ruby and JavaScript disagree}, refusal(caller_with("{ count: 1.5 }"))) }
      end

      test "an array literal is refused" do
        with_project { assert_match(%r{`\[1, 2\]` seeds `count` on `shared/album_card` with an Array\. A list on the page}, refusal(caller_with("{ count: [1, 2] }"))) }
      end

      test "a hash literal is refused" do
        with_project { assert_match(%r{`\{ x: 1 \}` seeds `count` on `shared/album_card` with a Hash\. A state holds one value}, refusal(caller_with("{ count: { x: 1 } }"))) }
      end

      test "a name passed as both a local and a state is refused" do
        with_project do
          source = CALLER.sub("album: a, state: { open: modal_open }", "open: a, state: { open: modal_open }")

          assert_match(%r{`open` goes to `shared/album_card` both as a local and as a state}, refusal(source))
        end
      end

      test "a name in the locals hash and the state hash is refused" do
        with_project do
          source = CALLER.sub(%(render "shared/album_card", album: a, state: { open: modal_open }), %(render partial: "shared/album_card", locals: { open: a }, state: { open: modal_open }))

          assert_match(%r{`open` goes to `shared/album_card` both as a local and as a state}, refusal(source))
        end
      end

      test "a partial that does not compile reports its own diagnostic" do
        with_project do
          write("app/views/shared/_album_card.html.erb", CARD.sub("<%# herb:state", "<%# locals: (open: false) %>\n<%# herb:state"))

          assert_match(%r{`shared/album_card` did not compile, so `state:` cannot check its states\. Its compile said `open` is both a strict local and a state}, refusal(CALLER))
        end
      end

      test "the context's resolver decides which file a binding targets" do
        with_project do
          write("engine/views/shared/_album_card.html.erb", CARD)

          resolver = Herb::Analysis::PartialResolver.new(@root, view_root: File.join(@root, "engine", "views"))
          visitor = Herb::Engine::Slots::Visitor.new(mode: :client)

          Herb::Engine.new(CALLER, visitors: [visitor], filename: File.join(@root, "app/views/overlays/show.html.erb"), project_path: @root, resolver: resolver)

          assert_empty visitor.diagnostics
          assert_equal "engine/views/shared/_album_card.html.erb", visitor.manifest["bindings"].fetch("0").fetch("identifier")
        end
      end

      test "a refused literal points at its own entry" do
        with_project do
          source = caller_with("{ open: modal_open, count: 1.5 }")
          error = assert_raises(Herb::Engine::CompilationError) { compile(source) }
          location = error.diagnostics.fetch(0).location

          assert_equal "count: 1.5", source.lines.fetch(location.start.line - 1)[location.start.column...location.end.column]
        end
      end
    end
  end
end
