# frozen_string_literal: true

require "prism"
require "set"

module Herb
  module ActionView
    class TemplateDependencies
      Result = Data.define(
        :file,
        :instance_variables,
        :constants,
        :locals_declared,
        :locals_received,
        :render_calls,
        :helper_calls,
        :unknown_calls
      )

      def initialize(project_path)
        @project_path = Pathname.new(project_path)
        @view_root = find_view_root
        @helper_registry = load_helper_registry
        @custom_helpers = Set.new
      end

      def analyze(file_path)
        file_path = @project_path.join(file_path).to_s unless Pathname.new(file_path).absolute?
        source = File.read(file_path)

        ast = ::Herb.parse(source, render_nodes: true, strict_locals: true, prism_nodes: true, track_whitespace: true).value

        known_helpers = @custom_helpers.dup
        component_methods_for(file_path).each { |m| known_helpers.add(m) }

        prescan = LocalScanner.new
        ast.accept(prescan)

        collector = DependencyCollector.new(@helper_registry, known_helpers, prescan.locals)
        ast.accept(collector)

        Result.new(
          file: file_path,
          instance_variables: collector.instance_variables.to_a.sort,
          constants: collector.constants.to_a.sort,
          locals_declared: collector.locals_declared.to_a.sort,
          locals_received: collector.locals_received,
          render_calls: collector.render_calls,
          helper_calls: collector.helper_calls.to_a.sort,
          unknown_calls: collector.unknown_calls.to_a.sort
        )
      end

      def analyze_all(erb_files = nil)
        erb_files ||= find_erb_files
        results = {} #: Hash[String, Result]

        erb_files.each do |file|
          results[file] = analyze(file)
        end

        results
      end

      def affected_templates(entry_point, state)
        entry_point = @project_path.join(entry_point).to_s unless Pathname.new(entry_point).absolute?

        all = {} #: Hash[String, Result]

        reachable = collect_reachable_files(entry_point)
        reachable.each { |file| all[file] = analyze(file) }

        affected = Set.new #: Set[String]
        partial_to_file = build_partial_to_file_map(reachable)
        entry_result = all[entry_point]

        return [] unless entry_result

        if entry_result.instance_variables.include?(state) || entry_result.constants.include?(state)
          affected.add(entry_point)
        else
          return []
        end

        state_locals = {} #: Hash[String, Set[String]]
        reachable.each { |file| state_locals[file] = Set.new }
        state_locals[entry_point].add(state)

        queue = [entry_point]
        visited = Set.new #: Set[String]

        while (file = queue.shift)
          next if visited.include?(file)

          visited.add(file)
          result = all[file]
          next unless result

          carrying = state_locals[file]

          result.render_calls.each do |call|
            flowing_locals = {} #: Hash[String, bool]

            call[:locals].each do |local_name, value_expr|
              flows = carrying.any? { |name| expression_references?(value_expr, name) }
              flowing_locals[local_name] = true if flows
            end

            collection_flows = call[:collection] && carrying.any? { |name| expression_references?(call[:collection], name) }

            next unless flowing_locals.any? || collection_flows

            partial_files = partial_to_file[call[:partial]] || []

            partial_files.each do |partial_file|
              state_locals[partial_file] ||= Set.new
              flowing_locals.each_key { |local_name| state_locals[partial_file].add(local_name) }

              if collection_flows && call[:partial]
                item_name = File.basename(call[:partial])
                state_locals[partial_file].add(item_name)
              end

              unless affected.include?(partial_file)
                affected.add(partial_file)
                queue << partial_file
              end
            end
          end
        end

        affected.to_a.sort
      end

      def affected_nodes(file_path, state)
        file_path = @project_path.join(file_path).to_s unless Pathname.new(file_path).absolute?
        source = File.read(file_path)

        ast = ::Herb.parse(source, render_nodes: true, strict_locals: true, prism_nodes: true, track_whitespace: true).value

        collector = NodeDependencyCollector.new(state, @helper_registry, @custom_helpers)
        ast.accept(collector)

        collector.affected
      end

      def dependency_index(file_path)
        file_path = @project_path.join(file_path).to_s unless Pathname.new(file_path).absolute?
        result = analyze(file_path)

        index = {} #: Hash[String, Array[Hash[Symbol, untyped]]]

        (result.instance_variables + result.constants).each do |state|
          nodes = affected_nodes(file_path, state)
          index[state] = nodes if nodes.any?
        end

        index
      end

      def scan_helpers!
        helpers_dir = @project_path.join("app", "helpers")

        if helpers_dir.directory?
          Dir[helpers_dir.join("**", "*.rb")].each do |file|
            extract_helper_methods(file).each { |name| @custom_helpers.add(name) }
          end
        end

        @custom_helpers
      end

      private

      def collect_reachable_files(entry_point)
        reachable = Set.new([entry_point]) #: Set[String]
        queue = [entry_point]
        all_partials = build_partial_to_file_map(find_erb_files)

        while (file = queue.shift)
          result = analyze(file)

          result.render_calls.each do |call|
            partial_files = all_partials[call[:partial]] || []

            partial_files.each do |partial_file|
              unless reachable.include?(partial_file)
                reachable.add(partial_file)
                queue << partial_file
              end
            end
          end
        end

        reachable.to_a
      end

      def component_methods_for(template_path)
        rb_path = template_path.sub(/\.html\.erb\z/, ".rb").sub(/\.erb\z/, ".rb")
        return [] unless File.exist?(rb_path)

        extract_helper_methods(rb_path)
      end

      def find_erb_files
        Dir[@project_path.join("app", "views", "**", "*.erb")].sort
      end

      def build_partial_to_file_map(files)
        map = {} #: Hash[String, Array[String]]

        files.each do |file|
          basename = File.basename(file)
          next unless basename.start_with?("_")

          relative = Pathname.new(file).relative_path_from(@view_root).to_s
          directory = File.dirname(relative)
          name = basename.sub(/\A_/, "").sub(/\.html\.erb\z/, "").sub(/\.erb\z/, "").sub(/\.\w+\.erb\z/, "")
          partial_name = directory == "." ? name : "#{directory}/#{name}"

          map[partial_name] ||= [] #: Array[String]
          map[partial_name] << file
        end

        map
      end

      def expression_references?(expression, name)
        return false unless expression && name

        if name.start_with?("@")
          expression.include?(name)
        else
          expression.match?(/\b#{Regexp.escape(name)}\b/)
        end
      end

      def extract_helper_methods(file)
        methods = [] #: Array[String]
        source = File.read(file)
        result = Prism.parse(source)

        walk_for_defs(result.value, methods)
        methods
      rescue StandardError
        [] #: Array[String]
      end

      def walk_for_defs(node, methods)
        if node.is_a?(Prism::DefNode)
          methods << node.name.to_s
        end

        node.child_nodes.compact.each { |child| walk_for_defs(child, methods) }
      end

      def load_helper_registry
        require_relative "helper_registry"
        names = Set.new #: Set[String]

        HelperRegistry.entries.each do |entry|
          names.add(entry.name.to_s)
        end

        names
      end

      def find_view_root
        @project_path.join("app", "views")
      end
    end

    class DependencyCollector < ::Herb::Visitor
      attr_reader :instance_variables, :constants, :locals_declared,
                  :locals_received, :helper_calls, :unknown_calls, :render_calls

      def initialize(helper_registry, custom_helpers, prescanned_locals = Set.new)
        super()
        @helper_registry = helper_registry
        @custom_helpers = custom_helpers
        @instance_variables = Set.new
        @constants = Set.new
        @locals_declared = Set.new
        @locals_received = {} #: Hash[String, String]
        @helper_calls = Set.new
        @unknown_calls = Set.new
        @known_locals = prescanned_locals.dup
        @render_calls = [] #: Array[Hash[Symbol, untyped]]
      end

      def visit_erb_node(node)
        analyze_erb_node(node)
      end

      def visit_erb_render_node(node)
        locals = {} #: Hash[String, String]

        node.keywords&.locals&.each do |local|
          name = local.name&.value
          value = local.value&.content

          next unless name && value

          value = name if value == "#{name}:"
          @locals_received[name] = value
          locals[name] = value

          analyze_ruby_expression(value)
        end

        if node.static_partial?
          @render_calls << {
            partial: node.partial_path,
            locals: locals,
            collection: node.keywords&.collection&.value
          }
        end

        if node.keywords&.collection
          analyze_ruby_expression(node.keywords.collection.value)
        end

        super
      end

      def visit_erb_strict_locals_node(node)
        node.locals&.each do |param|
          @locals_declared.add(param.name&.value) if param.name&.value
          @known_locals.add(param.name&.value) if param.name&.value
        end

        super
      end

      private

      def analyze_erb_node(erb_node)
        prism_node = erb_node.deserialized_prism_node if erb_node.respond_to?(:deserialized_prism_node)

        if prism_node
          walk_prism_node(prism_node)
        else
          analyze_ruby_expression(erb_node.content&.value&.strip)
        end
      rescue StandardError
        nil
      end

      def analyze_ruby_expression(code)
        return if code.nil? || code.empty?

        result = Prism.parse(code)
        return if result.errors.any?

        walk_prism_node(result.value)
      rescue StandardError
        nil
      end

      def walk_prism_node(node)
        case node
        when Prism::InstanceVariableReadNode
          @instance_variables.add(node.name.to_s)
        when Prism::LocalVariableWriteNode,
             Prism::LocalVariableOrWriteNode,
             Prism::LocalVariableAndWriteNode,
             Prism::LocalVariableOperatorWriteNode
          @known_locals.add(node.name.to_s)
        when Prism::BlockParameterNode, Prism::RequiredParameterNode
          @known_locals.add(node.name.to_s)
        when Prism::ConstantReadNode
          # Standalone constants are just references, not state
        when Prism::CallNode
          check_call_node(node)
        when Prism::LocalVariableReadNode
          @known_locals.add(node.name.to_s)
        end

        node.child_nodes.compact.each { |child| walk_prism_node(child) }
      end

      def check_call_node(node)
        name = node.name.to_s

        if node.receiver.nil?
          if @helper_registry.include?(name)
            @helper_calls.add(name)
          elsif @custom_helpers.include?(name)
            @helper_calls.add(name)
          elsif name == "render"
            # render calls are handled by visit_erb_render_node
          elsif !@known_locals.include?(name) && !@locals_received.key?(name) && !@locals_declared.include?(name)
            @unknown_calls.add(name)
          end
        elsif node.receiver.is_a?(Prism::ConstantReadNode)
          @constants.add("#{node.receiver.name}.#{name}")
        end
      end
    end

    class NodeDependencyCollector < ::Herb::Visitor
      attr_reader :affected

      def initialize(state, helper_registry, custom_helpers)
        super()
        @state = state
        @helper_registry = helper_registry
        @custom_helpers = custom_helpers
        @affected = [] #: Array[Hash[Symbol, untyped]]
        @path = [] #: Array[Integer]
        @child_index = [] #: Array[Integer]
      end

      def visit_document_node(node)
        visit_children_with_paths(node.child_nodes)
      end

      def visit_html_element_node(node)
        visit_children_with_paths(node.child_nodes)
      end

      def visit_html_open_tag_node(node)
        node.child_nodes.each_with_index do |child, i|
          if child.is_a?(Herb::AST::HTMLAttributeNode)
            check_attribute(child, @path + [i])
          end
        end
      end

      def visit_erb_content_node(node)
        check_erb_expression(node, :text_content)
      end

      def visit_erb_if_node(node)
        check_block_for_state(node, :conditional)
      end

      def visit_erb_unless_node(node)
        check_block_for_state(node, :conditional)
      end

      def visit_erb_case_node(node)
        check_block_for_state(node, :conditional)
      end

      def visit_erb_node(node)
        check_erb_expression(node, :expression)
      end

      def visit_erb_render_node(node)
        check_erb_expression(node, :render)
      end

      private

      def visit_children_with_paths(children)
        return unless children

        children.each_with_index do |child, index|
          @path.push(index)
          visit(child)
          @path.pop
        end
      end

      def check_block_for_state(node, type)
        all_content = collect_all_expressions(node)

        if all_content.any? { |code| references_state?(code) }
          location = node.location
          condition = node.content&.value&.strip

          @affected << {
            node_path: @path.dup,
            type: type,
            expression: condition,
            location: location ? "#{location.start.line}:#{location.start.column}" : nil
          }
        end

        visit_children_with_paths(node.child_nodes)
      end

      def collect_all_expressions(node)
        expressions = [] #: Array[String]

        if node.respond_to?(:content) && node.content
          value = node.content.respond_to?(:value) ? node.content.value&.strip : nil

          expressions << value if value && !value.empty? # steep:ignore
        end

        children = node.respond_to?(:child_nodes) ? node.child_nodes.compact : [] # steep:ignore
        children.each { |child| expressions.concat(collect_all_expressions(child)) }

        expressions
      end

      def check_erb_expression(node, type)
        code = node.content&.value&.strip
        return unless code

        if references_state?(code)
          location = node.location

          @affected << {
            node_path: @path.dup,
            type: type,
            expression: code,
            location: location ? "#{location.start.line}:#{location.start.column}" : nil
          }
        end
      end

      def check_attribute(attribute_node, path)
        attribute_name = nil

        attribute_node.child_nodes.each do |child|
          if child.is_a?(Herb::AST::HTMLAttributeNameNode)
            first = child.child_nodes&.first

            attribute_name = if first.respond_to?(:content)
                               content = first.content # steep:ignore
                               content.respond_to?(:value) ? content.value : content.to_s
                             end
          end

          next unless child.is_a?(Herb::AST::HTMLAttributeValueNode)

          child.child_nodes&.each do |value_child|
            next unless value_child.respond_to?(:content) && value_child.content # steep:ignore

            content = value_child.content # steep:ignore
            code = (content.respond_to?(:value) ? content.value : content.to_s).strip
            next unless code && !code.empty? && references_state?(code)

            location = value_child.location # steep:ignore

            @affected << {
              node_path: path.dup,
              type: :attribute_value,
              attribute: attribute_name,
              expression: code,
              location: location ? "#{location.start.line}:#{location.start.column}" : nil
            }
          end
        end
      end

      def references_state?(code)
        if @state.start_with?("@")
          code.include?(@state)
        elsif @state.include?(".")
          constant = @state.split(".").first
          code.include?(constant.to_s)
        else
          code.match?(/\b#{Regexp.escape(@state)}\b/)
        end
      end
    end

    class LocalScanner < ::Herb::Visitor
      attr_reader :locals

      def initialize
        super
        @locals = Set.new #: Set[String]
      end

      def visit_erb_node(node)
        return unless node.respond_to?(:deserialized_prism_node)

        pn = node.deserialized_prism_node
        collect_locals(pn) if pn
      rescue StandardError
        nil
      end

      private

      def collect_locals(node)
        case node
        when Prism::LocalVariableWriteNode,            # title = ...
             Prism::LocalVariableOrWriteNode,          # title ||= ...
             Prism::LocalVariableAndWriteNode,         # title &&= ...
             Prism::LocalVariableOperatorWriteNode     # count += 1
          @locals.add(node.name.to_s)
        when Prism::MultiWriteNode
          node.lefts.each do |target|
            @locals.add(target.name.to_s) if target.respond_to?(:name) # steep:ignore
          end
        end

        node.child_nodes.compact.each { |child| collect_locals(child) }
      end
    end
  end
end
