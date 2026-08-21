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

      #: (String | Pathname, ?compile: ^(String, String) -> untyped) -> void
      def initialize(project_path, compile: nil)
        @compile = compile
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
        reached = across(entry_point)
        state = reached.transform_values { |slots|
          slots.map { |slot| { "file" => identifier_for(slot[:file]), "version" => slot[:version], "index" => slot[:index], "mode" => slot[:mode].to_s } }
        }

        {
          "state" => state,
          "params" => request_names(entry_point, state.keys, params),
          "states" => declared_states(entry_point, reached),
        }
      end

      #: (String, Hash[String, untyped]) -> Hash[String, untyped]
      def declared_states(entry_point, reached)
        files = ([absolute(entry_point)] + reached.values.flatten.map { |slot| slot[:file] } + rendered_files(entry_point)).uniq
        manifests = {} #: Hash[String, untyped]

        files.each do |file|
          manifest = template(file)[:states]

          manifests[identifier_for(file)] = manifest if manifest
        end

        manifests
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

        return { version: nil, slots: {} } unless visitor.respond_to?(:slots)

        slots = visitor.slots
        wanted = names || state_names(analysis)
        reached = reached_paths(visitor, source, wanted)
        settable = (analysis.instance_variables + analysis.locals_declared + (names || [])).to_set - analysis.constants.to_set

        index = {} #: Hash[Integer, Hash[Symbol, untyped]]

        slots.each do |slot|
          state = reached.filter_map { |name, paths| name if paths.key?(slot.node_path) }.sort
          expressions = reached.values.filter_map { |paths| paths[slot.node_path] }.flatten.uniq

          index[slot.index] = { state: state, mode: mode_for(slot, state, expressions, settable) }
        end

        { version: visitor.schema[:version], slots: index, states: states_manifest(visitor) }
      end

      #: (untyped) -> Hash[String, untyped]?
      def states_manifest(visitor)
        return nil unless visitor.respond_to?(:state_declarations)

        declared = visitor.state_declarations
        names = declared[:region].map { |declaration| declaration[:name] } +
                declared[:items].values.flatten.map { |declaration| declaration[:name] }

        return nil if names.empty?

        declarations = declared[:region].map { |declaration| declaration.transform_keys(&:to_s).merge("scope" => "region") } +
                       declared[:items].flat_map { |index, list| list.map { |declaration| declaration.transform_keys(&:to_s).merge("scope" => index) } }

        reads = {} #: Hash[String, Array[Integer]]
        bound = {} #: Hash[String, Array[Integer]]

        visitor.slots.each do |slot|
          next unless [:child, :attribute, :attribute_interpolation, :element, :raw_text].include?(slot.type)

          expression = slot.expression.to_s.strip
          name = expression.delete_suffix("?")

          next unless names.include?(name)

          (reads[name] ||= []) << slot.index
          (bound[name] ||= []) << slot.index if bound_slot?(slot)
        end

        presence = {} #: Hash[String, untyped]

        visitor.state_presence.each do |index, read|
          presence[index.to_s] = StateDirectives.condition_entry(read)
          StateDirectives.read_names(read).each { |name| (reads[name] ||= []) << index }

          next unless read.is_a?(StateDirectives::Read)

          (bound[read.name] ||= []) << index if read.comparand.nil? && read.against.nil? && bound_slot?(visitor.slots[index])
        end

        conditionals = visitor.state_conditional_entries.to_h { |index, info|
          [index.to_s, { "arms" => info[:arms], "else" => info[:else] }]
        }

        if visitor.respond_to?(:state_count_entries)
          visitor.state_count_entries.each do |count|
            declaration = declarations.find { |declared| declared["name"] == count[:name] && declared["scope"] == "region" }

            next unless declaration

            declaration["count"] = { "collection" => count[:collection], "when" => count[:when], "by" => count[:by] }
          end
        end

        {
          "version" => visitor.schema[:version],
          "declarations" => declarations,
          "reads" => reads,
          "bound" => bound,
          "conditionals" => conditionals,
          "presence" => presence,
        }
      end

      #: (untyped) -> bool
      def bound_slot?(slot)
        return false unless slot.respond_to?(:tag)
        return false if slot.type == :attribute_interpolation

        tag = slot.tag.to_s

        if slot.attribute
          ["value", "checked", "selected"].include?(slot.attribute) && ["input", "textarea", "select", "option"].include?(tag)
        else
          tag == "textarea"
        end
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
          next false unless call[:partial] && File.basename(call[:partial].to_s) == name

          blocks = call[:within] || [] #: Array[Hash[Symbol, untyped]]

          !!call[:collection] || blocks.any? { |enclosing| enclosing[:iterating] }
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

      #: (String) -> Array[String]
      def rendered_files(entry_point)
        partials = partial_paths
        seen = [absolute(entry_point)]
        queue = seen.dup

        until queue.empty?
          file = queue.shift

          @dependencies.analyze(file).render_calls.each do |call|
            next unless call[:partial]

            name = File.basename(call[:partial].to_s)

            (partials[name] || []).each do |candidate|
              next if seen.include?(candidate)

              seen << candidate
              queue << candidate
            end
          end
        end

        seen
      end

      #: () -> Hash[String, Array[String]]
      def partial_paths
        @partial_paths ||= Dir.glob(@project_path.join("app/views/**/_*.erb").to_s).group_by { |path|
          File.basename(path).delete_prefix("_").split(".").first.to_s
        }
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
        return @compile.call(source, path) if @compile

        visitor = Herb::Engine::SlotVisitor.new(mark: false)

        Herb::Engine.new(source, visitors: [visitor], filename: path)

        visitor
      end

      #: (untyped, String, Array[String]) -> Hash[String, Hash[Array[Integer], Array[String?]]]
      def reached_paths(visitor, source, names)
        ast = visitor.document || ::Herb.parse(source, render_nodes: true, strict_locals: true, prism_nodes: true, track_whitespace: true).value

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
