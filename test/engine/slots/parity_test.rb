# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/dynamics_compiler"

module Engine
  module Slots
    # `DynamicsCompiler` says what a template evaluated to and `SlotVisitor` says where those values
    # go. They agree only if an index means the same thing to both, and an index that means one
    # thing to the compiler and another to the markers on the page writes the right value into the
    # wrong slot, silently.
    #
    # The compiler reads its indices off the visitor rather than counting, so these hold by
    # construction. They are here because the failure is invisible: nothing raises, the page is just
    # wrong, and the two used to disagree on every template containing a block.
    class ParityTest < Minitest::Spec
      class View
        def initialize(**assigns)
          assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
        end

        def form_with(**) = "<form>#{yield(Field.new)}</form>"
        def tag = TagBuilder.new

        class Field
          def label = "Name"
        end

        class TagBuilder
          def li(**) = "<li>#{yield}</li>"
        end
      end
      TEMPLATES = {
        "expressions in order" => [%(<%= @a %><p><%= @b %></p><%= @c %>), { a: "a", b: "b", c: "c" }],
        "an attribute and a child" => [%(<li class="<%= @c %>"><%= @n %></li>), { c: "row", n: "Marco" }],
        "two attributes on one element" => [%(<div class="<%= @c %>" id="<%= @i %>"></div>), { c: "c", i: "i" }],
        "a block, and what follows it" => [%(<%= form_with(model: 1) do |f| %><%= f.label %><% end %><%= @after %>), { after: "A" }],
        "a conditional that branches" => [%(<% if @on %><b><%= @x %></b><% else %><%= @y %><% end %><%= @z %>), { on: true, x: "x", y: "y", z: "z" }],
        "a conditional that collapses" => [%(<% if @on %><h1><%= @x %></h1><% else %><h1><%= @y %></h1><% end %>), { on: false, x: "x", y: "y" }],
        "a conditional matching nothing" => [%(<% if @on %><%= @x %><% end %>), { on: false, x: "x" }],
        "a keyed collection" => [%(<% @rows.each do |r| %><li id="<%= r %>"><%= r %></li><% end %>), { rows: [1, 2] }],
        "an empty collection" => [%(<% @rows.each do |r| %><%= r %><% end %>), { rows: [] }],
        "a collection inside a branch" => [%(<% if @on %><% @rows.each do |r| %><%= r %><% end %><% end %>), { on: true, rows: ["a"] }],
        "a helper block building an element" => [%(<%= tag.li(id: 1) do %><%= @n %><% end %><%= @after %>), { n: "n", after: "A" }],
        "an iteration whose value is output" => [%(<%= @rows.each do |r| %><%= r %><% end %>), { rows: [1, 2] }],
        "a conditional inside a block" => [%(<%= form_with(model: 1) do |f| %><% if @on %><%= @x %><% end %><% end %>), { on: true, x: "x" }],
        "nothing dynamic at all" => [%(<p>static</p>), {}],
      }.freeze

      def compile(source)
        Herb::Engine::DynamicsCompiler.new(source, filename: "app/views/test.html.erb")
      end

      def evaluate(compiler, assigns)
        View.new(**assigns).instance_eval(compiler.src).fetch(:slots)
      end

      def shapes(values, found = {})
        values.each do |index, value|
          case value
          when Hash
            if value.key?(:branch)
              found[index] = :conditional
              shapes(value[:slots] || {}, found)
            elsif value.key?(:rows)
              found[index] = :collection
              value[:rows].each_value { |row| shapes(row, found) }
            else
              found[index] = :value
            end
          else
            found[index] = :value
          end
        end

        found
      end

      def recorded(compiler)
        compiler.slot_visitor.slots.to_h { |slot|
          shape = case slot.type
                  when :conditional then :conditional
                  when :collection then :collection
                  else :value
                  end

          [slot.index, shape]
        }
      end

      TEMPLATES.each do |label, (source, assigns)|
        test "every value #{label} produces names a slot the visitor recorded" do
          compiler = compile(source)
          carried = shapes(evaluate(compiler, assigns))
          known = recorded(compiler)

          carried.each_key do |index|
            assert_includes known.keys, index,
                            "index #{index} carries a value but names no slot, so nothing on the page can receive it"
          end
        end

        test "every value #{label} produces is carried as the shape its slot was recorded as" do
          compiler = compile(source)
          carried = shapes(evaluate(compiler, assigns))
          known = recorded(compiler)

          carried.each do |index, shape|
            next unless known.key?(index)

            assert_equal known[index], shape,
                         "slot #{index} was recorded as #{known[index]} and its value arrived as #{shape}"
          end
        end
      end

      test "a block's interior is covered alongside the block itself" do
        source = %(<%= form_with(model: 1) do |f| %><%= f.label %><% end %><%= @after %>)
        compiler = compile(source)

        assert_equal([[0, :block], [1, :child], [2, :child]],
                     compiler.slot_visitor.slots.map { |slot| [slot.index, slot.type] })

        assert_equal({ 0 => "<form>Name</form>", 1 => "Name", 2 => "A" }, evaluate(compiler, after: "A"))
      end

      test "an iteration is a collection whether or not its value is output" do
        rows = { rows: { "1" => { 1 => "1" }, "2" => { 1 => "2" } } }

        %(<% @rows.each do |r| %><%= r %><% end %>).then do |source|
          assert_equal({ 0 => rows }, evaluate(compile(source), rows: [1, 2]))
        end

        %(<%= @rows.each do |r| %><%= r %><% end %>).then do |source|
          assert_equal({ 0 => rows }, evaluate(compile(source), rows: [1, 2]))
        end
      end

      test "a collapsed conditional reports one value rather than a branch" do
        source = %(<% if @on %><h1><%= @x %></h1><% else %><h1><%= @y %></h1><% end %>)
        compiler = compile(source)

        assert_equal [:child], compiler.slot_visitor.slots.map(&:type)
        assert_equal({ 0 => "y" }, evaluate(compiler, on: false, x: "x", y: "y"))
      end

      test "the visitor it numbered against is the one it compiled with" do
        compiler = compile(%(<p><%= @a %></p>))

        assert_equal "app/views/test.html.erb", compiler.slot_visitor.schema[:file]
        assert_match(/\A[0-9a-f]{8}\z/, compiler.slot_visitor.version)
      end
    end
  end
end
