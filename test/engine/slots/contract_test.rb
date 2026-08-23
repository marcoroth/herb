# frozen_string_literal: true

require "json"
require "tmpdir"
require "fileutils"
require "erb/util"
require "active_support/core_ext/string/output_safety"

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/dynamics_compiler"
require_relative "../../../lib/herb/engine/slot_dependencies"

module Engine
  module Slots
    # Generates the fixtures the client's contract test drives, one per template, so the two
    # implementations are checked against each other on every construct the markers can express
    # and not only on the one template round_trip_test.rb covers.
    class ContractTest < Minitest::Spec
      FIXTURES = File.expand_path("../../../javascript/packages/client/test/fixtures", __dir__)
      CONTRACT = File.join(FIXTURES, "contract")
      MARKERS = File.join(FIXTURES, "markers.json")

      BUFFER = "@output_buffer"

      # How the app compiles a template. ActionView escapes on the way into its buffer rather than
      # in the compiled template, and the values compile escapes the same way in every context so
      # the two halves write the same bytes for the same value.
      ESCAPING = {
        escape: true,
        escapefunc: "::ERB::Util.h",
        attrfunc: nil,
        jsfunc: nil,
        cssfunc: nil,
      }.freeze

      # A view whose helpers capture a block the way ActionView does: the block writes into the
      # buffer, the helper swaps the buffer around the yield and wraps what was written. What a
      # helper returns is markup it produced itself, so it comes back safe and is not escaped again.
      class View
        def initialize(**assigns)
          assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
        end

        def form_with(**) = "<form>#{capture { |*| yield(Field.new) }}</form>".html_safe
        def tag = TagBuilder.new(self)

        def capture
          outer = @output_buffer
          @output_buffer = +""

          value = yield

          written = @output_buffer
          @output_buffer = outer

          (written.empty? ? value.to_s : written).html_safe
        end

        class Field
          def label = "Name"
        end

        class TagBuilder
          def initialize(view)
            @view = view
          end

          def li(**, &) = "<li>#{@view.capture(&)}</li>".html_safe
        end
      end

      TEMPLATES = {
        "expressions in order" => [
          %(<%= @a %><p><%= @b %></p><%= @c %>),
          { a: "a", b: "b", c: "c" },
          { a: "A", b: "B", c: "C" }
        ],
        "an attribute and a child" => [
          %(<li class="<%= @c %>"><%= @n %></li>),
          { c: "item", n: "Marco" },
          { c: "row", n: "Joe" }
        ],
        "two attributes on one element" => [
          %(<div class="<%= @c %>" id="<%= @i %>"></div>),
          { c: "c", i: "i" },
          { c: "d", i: "j" }
        ],
        "a block and what follows it" => [
          %(<%= form_with(model: 1) do |f| %><%= f.label %><% end %><%= @after %>),
          { after: "A" },
          { after: "B" }
        ],
        "a conditional that branches" => [
          %(<% if @on %><b><%= @x %></b><% else %><%= @y %><% end %><%= @z %>),
          { on: true, x: "x", y: "y", z: "z" },
          { on: false, x: "x", y: "Y", z: "Z" }
        ],
        "a conditional that collapses" => [
          %(<% if @on %><h1><%= @x %></h1><% else %><h1><%= @y %></h1><% end %>),
          { on: false, x: "x", y: "y" },
          { on: true, x: "X", y: "y" }
        ],
        "a conditional matching nothing" => [
          %(<% if @on %><%= @x %><% end %>),
          { on: false, x: "x" },
          { on: true, x: "X" }
        ],
        "a keyed collection" => [
          %(<% @items.each do |r| %><li id="<%= r %>"><%= r %></li><% end %>),
          { items: [1, 2] },
          { items: [2, 3] }
        ],
        "a keyed collection whose keys carry markup" => [
          %(<% @items.each do |r| %><li id="<%= r %>"><%= r %></li><% end %>),
          { items: ["a&b", "c<d"] },
          { items: ["c<d", %(e"f)] }
        ],
        "an empty collection" => [
          %(<% @items.each do |r| %><li id="<%= r %>"><%= r %></li><% end %>),
          { items: [] },
          { items: [1] }
        ],
        "a collection inside a branch" => [
          %(<% if @on %><% @items.each do |r| %><li id="<%= r %>"><%= r %></li><% end %><% end %>),
          { on: true, items: ["a"] },
          { on: true, items: ["a", "b"] }
        ],
        "a helper block building an element" => [
          %(<%= tag.li(id: 1) do %><%= @n %><% end %><%= @after %>),
          { n: "n", after: "A" },
          { n: "N", after: "B" }
        ],
        "a conditional inside a block" => [
          %(<%= form_with(model: 1) do |f| %><% if @on %><%= @x %><% end %><% end %>),
          { on: true, x: "x" },
          { on: true, x: "X" }
        ],
        "a boolean attribute driven by a value" => [
          %(<video muted="<%= @muted %>"></video>),
          { muted: false },
          { muted: true }
        ],
        "a value carrying markup and quotes" => [
          %(<li title="<%= @t %>"><%= @n %></li>),
          { t: %(a "quoted" & <tag>), n: "Tom & <b>Jerry</b>" },
          { t: "plain", n: "Tom & Jerry" }
        ],
        "a boolean attribute inside a block" => [
          %(<%# herb:state (sending: false) %><%= form_with(model: 1) do |f| %><video muted="<%= sending %>"></video><% end %>),
          {},
          {}
        ],
        "an interpolated attribute inside a block" => [
          %(<%= form_with(model: 1) do |f| %><li id="row_<%= @r %>">x</li><% end %>),
          { r: 7 },
          { r: 8 }
        ],
        "a keyed collection with declared item state" => [
          %(<%# herb:state (filter: "all") %><ul><% @items.each do |r| %><%# herb:key r %><%# herb:state (starred: false) %><li id="<%= r %>" hidden="<%= filter == "starred" && starred == false %>"><%= r %></li><% end %></ul>),
          { items: ["a", "b"] },
          { items: ["b", "c"] }
        ],
        "nothing dynamic at all" => [
          %(<p>static</p>),
          {},
          {}
        ],
      }.freeze

      def setup
        @project_path = Dir.mktmpdir("herb_slot_contract")
      end

      def teardown
        FileUtils.rm_rf(@project_path)
      end

      def slug(label)
        label.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")
      end

      def file_for(label)
        "app/views/contract/#{slug(label)}.html.erb"
      end

      def write(label, source)
        path = File.join(@project_path, file_for(label))

        FileUtils.mkdir_p(File.dirname(path))
        File.write(path, source)

        path
      end

      def render(label, source, assigns, mode:)
        visitor = Herb::Engine::SlotVisitor.new(mode: mode)
        compiled = Herb::Engine.new(source, visitors: [visitor], filename: file_for(label), project_path: @project_path, bufvar: BUFFER, **ESCAPING).src

        [View.new(**assigns).instance_eval(compiled), visitor]
      end

      def values(label, source, assigns)
        compiled = Herb::Engine::DynamicsCompiler.new(source, filename: file_for(label), project_path: @project_path, bufvar: BUFFER, **ESCAPING).src

        View.new(**assigns).instance_eval(compiled)
      end

      def dependencies(label, source)
        path = write(label, source)

        Herb::Engine::SlotDependencies.new(@project_path).payload(path)
      end

      def fixture(label, source, before, after)
        rendered, visitor = render(label, source, before, mode: :server)
        client, = render(label, source, before, mode: :client)
        expected, = render(label, source, after, mode: :server)

        {
          file: file_for(label),
          template: source,
          rendered: rendered,
          client: client,
          values: values(label, source, after),
          expected: expected,
          schema: visitor.schema,
          dependencies: dependencies(label, source),
        }
      end

      def check(path, generated)
        File.write(path, generated) if ENV["UPDATE_SNAPSHOTS"] || ENV["FORCE_UPDATE_SNAPSHOTS"]

        assert_equal generated, File.read(path), "#{File.basename(path)} no longer describes the compiler's output, re-run with UPDATE_SNAPSHOTS=1"
      end

      TEMPLATES.each do |label, (source, before, after)|
        test "the contract fixture for #{label} is the one the compiler produces" do
          FileUtils.mkdir_p(CONTRACT)

          check(File.join(CONTRACT, "#{slug(label)}.json"), "#{JSON.pretty_generate(fixture(label, source, before, after))}\n")
        end
      end

      test "no contract fixture describes a template this table no longer has" do
        skip "fixtures are being regenerated" if ENV["UPDATE_SNAPSHOTS"] || ENV["FORCE_UPDATE_SNAPSHOTS"]

        expected = TEMPLATES.keys.map { |label| "#{slug(label)}.json" }.sort

        assert_equal expected, Dir.children(CONTRACT).sort
      end

      test "the marker grammar fixture is the one SlotMarkers builds" do
        markers = Herb::Engine::SlotMarkers.new

        grammar = {
          slot_open: { child: markers.slot_open(3, :child), conditional: markers.slot_open(4, :conditional), collection: markers.slot_open(5, :collection) },
          slot_close: markers.slot_close(3),
          element_anchors: markers.element_anchors([[6, :attribute, "class"], [7, :child, nil], [8, :boolean_attribute, "muted"]]),
          branch: markers.branch(4, 1),
          item_open: "#{markers.item_open_prefix(5)}a&b#{markers.item_open_suffix}",
          item_close: markers.item_close(5),
          region_open: "#{markers.region_open_prefix("app/views/posts/_card.html.erb", "aaaaaaaa")}2#{markers.region_open_suffix}",
          region_close: markers.region_close("app/views/posts/_card.html.erb"),
          statics_open: markers.statics_open("app/views/posts/_card.html.erb", "aaaaaaaa"),
          statics_close: markers.statics_close,
        }

        check(MARKERS, "#{JSON.pretty_generate(grammar)}\n")
      end
    end
  end
end
