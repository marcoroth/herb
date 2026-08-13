# frozen_string_literal: true

require "prism"
require "set"

require_relative "partial_index"
require_relative "template_dependencies/dependency_collector"
require_relative "template_dependencies/local_scanner"
require_relative "template_dependencies/node_dependency_collector"

module Herb
  module Analysis
    class TemplateDependencies
      FlowNode = Data.define(:file, :names, :via, :nodes, :children)

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

      def affected_templates(entry_point, state)
        trace = trace_state(entry_point, state)

        return [] unless trace

        trace[:affected].to_a.sort
      end

      def state_flow(entry_point, state)
        trace = trace_state(entry_point, state)

        return nil unless trace

        flow_node(trace, trace[:entry_point], nil, Set.new)
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
        scan_routes!
        scan_helper_methods!

        helpers_dir = @project_path.join("app", "helpers")

        if helpers_dir.directory?
          Dir[helpers_dir.join("**", "*.rb")].each do |file|
            extract_helper_methods(file).each { |name| @custom_helpers.add(name) }
          end
        end

        @custom_helpers
      end

      private
      # `helper_method :foo` in a controller exposes a controller method to every view. It is not a
      # module inclusion, so scanning `app/helpers` alone never finds it.
      def scan_helper_methods!
        ["app", "lib"].each do |directory|
          root = @project_path.join(directory)

          next unless root.directory?

          Dir[root.join("**", "*.rb")].each do |file|
            source = File.read(file)

            next unless source.include?("helper_method")

            source.scan(/helper_method\s+([:\w\s,]+)/) do |match|
              match[0].scan(/:(\w+)/) { |name| @custom_helpers.add(name[0]) }
            end
          rescue StandardError
            next
          end
        end

        @custom_helpers
      end

      # Route helpers are generated from `config/routes.rb`, so no module defines them and a plain
      # helper scan can never find them. Mirrors the Rust extractor, including nested resources,
      # member/collection routes, and the `_index` suffix Rails adds for singular resource names.
      def scan_routes!
        routes_file = @project_path.join("config", "routes.rb")

        return @custom_helpers unless routes_file.file?

        namespaces = [] #: Array[String]
        depths = [] #: Array[Integer]
        resources = [] #: Array[Array[String]]
        resource_depths = [] #: Array[Integer]

        routes_file.each_line do |line|
          trimmed = line.strip

          next if trimmed.empty? || trimmed.start_with?("#")

          if trimmed == "end"
            if (depth = depths.pop)
              namespaces.pop
              if resource_depths.last == depth
                resource_depths.pop
                resources.pop
              end
            end

            next
          end

          prefix = namespaces.empty? ? "" : "#{namespaces.join("_")}_"

          if (namespace = symbol_after(trimmed, "namespace "))
            namespaces.push(namespace)
            depths.push(namespaces.size)

            next
          end

          if (scope = trimmed[/on: :(\w+)/, 1]) && (action = symbol_after(trimmed, trimmed[/\A(get|post|patch|put|delete) /, 1].to_s + " "))
            owner = resources.last

            if owner
              stem = scope == "collection" ? "#{namespaces[0..-2].join("_")}#{namespaces.size > 1 ? "_" : ""}#{owner[1]}" : prefix.chomp("_")
              add_route_pair("#{action}_#{stem}")
            end

            next
          end

          if (name = symbol_after(trimmed, "resources "))
            singular = singularize(name)

            add_route_pair("#{prefix}#{name}")
            add_route_pair("#{prefix}#{singular}")
            add_route_pair("new_#{prefix}#{singular}")
            add_route_pair("edit_#{prefix}#{singular}")
            add_route_pair("#{prefix}#{name}_index") if singular == name

            if trimmed.end_with?(" do")
              namespaces.push(singular)
              depths.push(namespaces.size)
              resources.push([singular, name])
              resource_depths.push(namespaces.size)
            end

            next
          end

          if (name = symbol_after(trimmed, "resource "))
            add_route_pair("#{prefix}#{name}")
            add_route_pair("new_#{prefix}#{name}")
            add_route_pair("edit_#{prefix}#{name}")

            # A singular resource can open a block too. Without pushing here, its `end` pops the
            # enclosing namespace and every later route is named against the wrong parent.
            if trimmed.end_with?(" do")
              namespaces.push(name)
              depths.push(namespaces.size)
              resources.push([name, name])
              resource_depths.push(namespaces.size)
            end

            next
          end

          add_route_pair("#{prefix}root") if trimmed.start_with?("root ")

          if (alias_name = trimmed[/as: :(\w+)/, 1])
            add_route_pair("#{prefix}#{alias_name}")
          elsif (literal = trimmed[/\A(?:get|post|patch|put|delete)\s+["']([a-z0-9_\/-]+)["']/, 1])
            # `get "about"` names the helper after the path itself.
            add_route_pair("#{prefix}#{literal.delete_prefix("/").tr("/-", "__")}")
          end
        end

        @custom_helpers
      end

      def add_route_pair(stem)
        return if stem.empty?

        @custom_helpers.add("#{stem}_path")
        @custom_helpers.add("#{stem}_url")
      end

      def symbol_after(line, keyword)
        return nil if keyword.strip.empty?

        rest = line[/\A#{Regexp.escape(keyword)}\s*:(\w+)/, 1]

        rest
      end

      def singularize(name)
        return name.sub(/ies\z/, "y") if name.end_with?("ies")
        return name.chomp("es") if name.end_with?("sses", "ches", "shes", "xes", "ses", "zes")
        return name.chomp("s") if name.end_with?("s") && !name.end_with?("ss")

        name
      end


      def trace_state(entry_point, state)
        entry_point = @project_path.join(entry_point).to_s unless Pathname.new(entry_point).absolute?

        all = {} #: Hash[String, Result]
        reachable = collect_reachable_files(entry_point)
        reachable.each { |file| all[file] = analyze(file) }

        entry_result = all[entry_point]

        return nil unless entry_result
        return nil unless entry_result.instance_variables.include?(state) || entry_result.constants.include?(state)

        index = PartialIndex.new(@view_root, reachable)
        affected = Set.new([entry_point]) #: Set[String]

        state_locals = {} #: Hash[String, Set[String]]
        reachable.each { |file| state_locals[file] = Set.new }
        state_locals[entry_point].add(state)

        edges = {} #: Hash[String, Array[Hash[Symbol, untyped]]]
        queue = [entry_point]
        visited = Set.new #: Set[String]

        while (file = queue.shift)
          next if visited.include?(file)

          visited.add(file)
          result = all[file]

          next unless result

          carrying = state_locals[file]

          result.render_calls.each do |call|
            flowing_locals = {} #: Hash[String, String]

            call[:locals].each do |local_name, value_expr|
              flowing_locals[local_name] = value_expr if carrying.any? { |name| expression_references?(value_expr, name) }
            end

            collection_flows = call[:collection] && carrying.any? { |name| expression_references?(call[:collection], name) }

            next unless flowing_locals.any? || collection_flows

            index.resolve(call[:partial], file).each do |partial_file|
              state_locals[partial_file] ||= Set.new
              flowing_locals.each_key { |local_name| state_locals[partial_file].add(local_name) }

              carried = flowing_locals.dup

              if collection_flows && call[:partial]
                item_name = File.basename(call[:partial])
                state_locals[partial_file].add(item_name)
                carried[item_name] = call[:collection]
              end

              (edges[file] ||= []) << { partial: partial_file, locals: carried }

              unless affected.include?(partial_file)
                affected.add(partial_file)
                queue << partial_file
              end
            end
          end
        end

        { entry_point: entry_point, affected: affected, state_locals: state_locals, edges: edges }
      end

      def flow_node(trace, file, via, path)
        return nil if path.include?(file)

        names = (trace[:state_locals][file] || Set.new).to_a.sort
        descended = path | [file]

        children = (trace[:edges][file] || []).filter_map do |edge|
          flow_node(trace, edge[:partial], edge[:locals], descended)
        end

        FlowNode.new(
          file: file,
          names: names,
          via: via,
          nodes: nodes_for(file, names),
          children: children
        )
      end

      def nodes_for(file, names)
        seen = Set.new #: Set[untyped]

        names.flat_map { |name| affected_nodes(file, name) }.select do |node|
          key = [node[:node_path], node[:type], node[:expression]]

          seen.add?(key) ? true : false
        end
      end

      def collect_reachable_files(entry_point)
        reachable = Set.new([entry_point]) #: Set[String]
        queue = [entry_point]
        index = partial_index

        while (file = queue.shift)
          result = analyze(file)

          result.render_calls.each do |call|
            partial_files = index.resolve(call[:partial], file)

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

      def partial_index
        @partial_index ||= PartialIndex.build(@project_path)
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
        require_relative "../action_view/helper_registry"
        names = Set.new #: Set[String]

        ActionView::HelperRegistry.entries.each do |entry|
          names.add(entry.name.to_s)

          # A helper answers to every alias it declares: `l` is `localize`, `t` is `translate`.
          entry.aliases&.each { |alias_name| names.add(alias_name.to_s) }
        end

        names
      end

      def find_view_root
        PartialIndex.resolve_view_root(@project_path)
      end
    end
  end
end
