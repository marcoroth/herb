# frozen_string_literal: true
# typed: false

require_relative "../../herb"
require_relative "../engine"
require_relative "slot_visitor"
require_relative "../analysis/template_dependencies"

require "json"

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
      ATTRIBUTE = "data-herb-dependencies" #: String
      STRUCTURAL_TYPES = [:conditional, :collection, :block].freeze #: Array[Symbol]
      PARTIAL_TYPES = [:attribute_interpolation].freeze #: Array[Symbol]

      #: (String | Pathname) -> void
      def initialize(project_path)
        @project_path = Pathname.new(project_path)
        @dependencies = Herb::Analysis::TemplateDependencies.new(project_path)
        @templates = {} #: Hash[String, Hash[Symbol, untyped]]
      end

      #: (String) -> Hash[String, Array[Hash[Symbol, untyped]]]
      def across(entry_point)
        path = absolute(entry_point)
        index = {} #: Hash[String, Array[Hash[Symbol, untyped]]]

        state_names(@dependencies.analyze(path)).each do |name|
          flow = @dependencies.state_flow(path, name)

          next unless flow

          reached = reached_slots(flow)

          index[name] = reached if reached.any?
        end

        index
      end

      #: (String, Array[String]) -> Array[Hash[Symbol, untyped]]
      def subtree_slots(entry_point, changed)
        reached = across(entry_point).filter_map { |name, slots| slots if changed.include?(name) }

        reached.flatten.select { |slot| slot[:mode] == :structural }.uniq { |slot| [slot[:file], slot[:index]] }
      end

      #: (String, ?params: Hash[String, String]) -> Hash[String, untyped]
      def payload(entry_point, params: {})
        state = across(entry_point).transform_values { |slots|
          slots.map { |slot| { "file" => identifier_for(slot[:file]), "version" => slot[:version], "index" => slot[:index], "mode" => slot[:mode].to_s } }
        }

        { "state" => state, "params" => request_names(entry_point, state.keys, params) }
      end

      #: (String, ?params: Hash[String, String]) -> String
      def element(entry_point, params: {})
        json = JSON.generate(payload(entry_point, params: params), script_safe: true)

        %(<template #{ATTRIBUTE}>#{json}</template>)
      end

      #: (String) -> Hash[Integer, Hash[Symbol, untyped]]
      def for(file_path)
        template(absolute(file_path))[:slots]
      end

      #: (String) -> String
      def version_for(file_path)
        template(absolute(file_path))[:version]
      end

      private

      #: (String, ?Array[String]?) -> Hash[Symbol, untyped]
      def template(path, names = nil)
        @templates[[path, names]] ||= build(path, names)
      end

      #: (String, Array[String]?) -> Hash[Symbol, untyped]
      def build(path, names)
        source = File.read(path)
        analysis = @dependencies.analyze(path)
        visitor = visitor_for(source, path)
        slots = visitor.slots
        wanted = names || state_names(analysis)
        reached = reached_paths(source, wanted)
        settable = (analysis.instance_variables + analysis.locals_declared + (names || [])).to_set

        index = {} #: Hash[Integer, Hash[Symbol, untyped]]

        slots.each do |slot|
          state = reached.filter_map { |name, paths| name if paths.key?(slot.node_path) }.sort
          expressions = reached.values.filter_map { |paths| paths[slot.node_path] }.flatten.uniq

          index[slot.index] = { state: state, mode: mode_for(slot, state, expressions, settable) }
        end

        { version: visitor.schema[:version], slots: index }
      end

      #: (untyped, ?Array[Hash[Symbol, untyped]], ?per_item: bool) -> Array[Hash[Symbol, untyped]]
      def reached_slots(flow, reached = [], per_item: false)
        carried = flow.names.to_a.sort
        compiled = template(flow.file, carried)

        compiled[:slots].each do |index, info|
          next unless info[:state].intersect?(carried)

          reached << { file: flow.file, version: compiled[:version], index: index, mode: mode_within(info[:mode], per_item) }
        end

        flow.children.each { |child| reached_slots(child, reached, per_item: per_item || per_item?(flow, child)) }

        reached
      end

      #: (Symbol, bool) -> Symbol
      def mode_within(mode, per_item)
        per_item && mode == :identity ? :derived : mode
      end

      #: (untyped, untyped) -> bool
      def per_item?(parent, child)
        name = File.basename(child.file).delete_prefix("_").split(".").first

        @dependencies.analyze(parent.file).render_calls.any? { |call|
          call[:collection] && call[:partial] && File.basename(call[:partial].to_s) == name
        }
      end

      #: (String, Array[String], Hash[String, String]) -> Hash[String, String]
      def request_names(entry_point, names, declared)
        analysis = @dependencies.analyze(absolute(entry_point))
        settable = (analysis.instance_variables + analysis.locals_declared).to_set
        counts = Hash.new(0) #: Hash[String, Integer]
        defaults = {} #: Hash[String, String]

        names.each { |name|
          counts[name.delete_prefix("@")] += 1 if settable.include?(name)
          request_name = name.delete_prefix("@")

          next unless settable.include?(name)
          next unless counts[request_name] == 1

          defaults[request_name] = name
        }

        defaults.reject { |_, name| declared.value?(name) }.merge(declared)
      end

      #: (String) -> String
      def identifier_for(path)
        relative = Pathname.new(path).relative_path_from(@project_path).to_s

        relative.start_with?("..") ? path : relative
      rescue ArgumentError
        path
      end

      #: (String) -> String
      def absolute(file_path)
        return file_path if Pathname.new(file_path).absolute?

        @project_path.join(file_path).to_s
      end

      #: (String, String) -> untyped
      def visitor_for(source, path)
        visitor = Herb::Engine::SlotVisitor.new

        Herb::Engine.new(source, visitors: [visitor], filename: path)

        visitor
      end

      #: (String, Array[String]) -> Hash[String, Hash[Array[Integer], Array[String?]]]
      def reached_paths(source, names)
        ast = ::Herb.parse(source, render_nodes: true, strict_locals: true, prism_nodes: true, track_whitespace: true).value

        reached = {} #: Hash[String, Hash[Array[Integer], Array[String?]]]

        names.each do |name|
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
