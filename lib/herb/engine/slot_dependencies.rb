# frozen_string_literal: true
# typed: false

require_relative "../../herb"
require_relative "../engine"
require_relative "slot_visitor"
require_relative "../analysis/template_dependencies"

module Herb
  class Engine
    # Says which state each of a template's slots reads, and where that slot's next value can come
    # from:
    #
    #     Herb::Engine::SlotDependencies.new(project_path).for("app/views/posts/index.html.erb")
    #     #=> { 0 => { state: ["@items"], mode: :structural },
    #           1 => { state: ["@items"], mode: :derived } }
    #
    # `SlotVisitor` records a `node_path` for every slot and `TemplateDependencies` reports one for
    # every node a state reaches, so the two are joined on that path.
    #
    # A mode says who can produce the next value. `identity` is a slot whose expression is the
    # state itself, so a client writes it by copying what it was given. `structural` is a
    # conditional or a collection, which a client can only rebuild from markup the server parked.
    # `derived` is an expression that has to be evaluated, and evaluating it means running Ruby.
    #
    # A conditional is reported against its own condition rather than everything inside it. What
    # the branches read belongs to the slots in them, which carry their own state.
    class SlotDependencies
      STRUCTURAL_TYPES = [:conditional, :collection, :block].freeze #: Array[Symbol]
      PARTIAL_TYPES = [:attribute_interpolation].freeze #: Array[Symbol]

      #: (String | Pathname) -> void
      def initialize(project_path)
        @project_path = Pathname.new(project_path)
        @dependencies = Herb::Analysis::TemplateDependencies.new(project_path)
      end

      #: (String) -> Hash[Integer, Hash[Symbol, untyped]]
      def for(file_path)
        path = absolute(file_path)
        source = File.read(path)
        analysis = @dependencies.analyze(path)
        slots = slots_for(source, path)
        reached = reached_paths(source, analysis)
        settable = (analysis.instance_variables + analysis.locals_declared).to_set

        index = {} #: Hash[Integer, Hash[Symbol, untyped]]

        slots.each do |slot|
          state = reached.filter_map { |name, paths| name if paths.key?(slot.node_path) }.sort
          expressions = reached.values.filter_map { |paths| paths[slot.node_path] }.flatten.uniq

          index[slot.index] = { state: state, mode: mode_for(slot, state, expressions, settable) }
        end

        index
      end

      private

      #: (String) -> String
      def absolute(file_path)
        return file_path if Pathname.new(file_path).absolute?

        @project_path.join(file_path).to_s
      end

      #: (String, String) -> Array[untyped]
      def slots_for(source, path)
        visitor = Herb::Engine::SlotVisitor.new

        Herb::Engine.new(source, visitors: [visitor], filename: path)

        visitor.slots
      end

      #: (String, untyped) -> Hash[String, Hash[Array[Integer], Array[String?]]]
      def reached_paths(source, analysis)
        ast = ::Herb.parse(source, render_nodes: true, strict_locals: true, prism_nodes: true, track_whitespace: true).value

        reached = {} #: Hash[String, Hash[Array[Integer], Array[String?]]]

        state_names(analysis).each do |name|
          nodes = @dependencies.nodes_in(ast, name, conditions_only: true)

          next if nodes.empty?

          paths = {} #: Hash[Array[Integer], Array[String?]]

          nodes.each do |node|
            entry = paths[node[:node_path]] ||= [] #: Array[String?]
            entry << node[:expression]
          end

          reached[name] = paths
        end

        reached
      end

      #: (untyped) -> Array[String]
      def state_names(analysis)
        analysis.instance_variables + analysis.constants + analysis.locals_declared
      end

      #: (untyped, Array[String], Array[String?], Set[String]) -> Symbol
      def mode_for(slot, state, expressions, settable)
        return :structural if STRUCTURAL_TYPES.include?(slot.type)
        return :derived if PARTIAL_TYPES.include?(slot.type)
        return :derived unless state.one?
        return :derived unless settable.include?(state.first)

        written = slot.expression ? [slot.expression] : expressions

        written.map { |expression| expression.to_s.strip } == [state.first] ? :identity : :derived
      end
    end
  end
end
