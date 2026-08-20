# frozen_string_literal: true

require_relative "../partial_resolution"
require_relative "../render_graph"

module Herb
  module Analysis
    class RenderGraph
      class Builder
        RENDER_MARKER = "render" #: String
        YIELD_MARKER = "yield" #: String
        DOCUMENT_ROOT_TAG = "html" #: String
        ANCESTOR_CONTEXT_ATTRIBUTES = ["class"].freeze #: Array[String]

        PARSER_OPTIONS = { render_nodes: true, prism_nodes: true, action_view_helpers: true }.freeze #: Hash[Symbol, bool]

        ScannedTemplate = Data.define(:sites, :yields, :document_root, :roots)
        YieldSite = Data.define(:ancestors, :ancestor_attributes, :location)
        RenderSite = Data.define(:node, :ancestors, :ancestor_attributes)
        CollectedCallSites = Data.define(:unresolved, :yields, :document_root, :roots)
        StackEntry = Data.define(:tag_name, :attributes)

        class ScanState
          attr_reader :sites #: Array[RenderSite]
          attr_reader :yields #: Array[YieldSite]
          attr_reader :stack #: Array[StackEntry]
          attr_reader :tags #: Array[String]
          attr_reader :conditional_tags #: Array[String]
          attr_reader :renders #: Array[String]

          attr_accessor :document_root #: bool
          attr_accessor :conditional_depth #: Integer
          attr_accessor :roots_resolved #: bool

          #: () -> void
          def initialize
            @sites = [] #: Array[RenderSite]
            @yields = [] #: Array[YieldSite]
            @stack = [] #: Array[StackEntry]
            @tags = [] #: Array[String]
            @conditional_tags = [] #: Array[String]
            @renders = [] #: Array[String]
            @document_root = false
            @conditional_depth = 0
            @roots_resolved = true
          end
        end

        NOTHING_COLLECTED = CollectedCallSites.new(
          unresolved: 0,
          yields: [],
          document_root: false,
          roots: NO_ROOTS
        ) #: CollectedCallSites

        #: (PartialIndex, ?resolve_layouts: bool) -> void
        def initialize(partials, resolve_layouts: true)
          @partials = partials
          @resolve_layouts = resolve_layouts
        end

        #: (String, String, Hash[String, Array[PartialCallSite]]) -> CollectedCallSites
        def collect_call_sites(file, source, call_sites)
          renders_nothing = !source.include?(RENDER_MARKER) && !source.include?(YIELD_MARKER)

          return NOTHING_COLLECTED if renders_nothing && !PartialResolution.partial_path?(file)

          scanned = scan_template(parse(source))
          unresolved = 0

          scanned.sites.each do |site|
            name = partial_name_rendered_by(site.node)

            if name.nil?
              unresolved += 1
              next
            end

            declaration = @partials.lookup(name, file)

            if declaration.nil?
              unresolved += 1
              next
            end

            call_sites[declaration.file] ||= []
            call_sites[declaration.file] << PartialCallSite.new(
              caller: file,
              locals: locals_passed_by(site.node),
              ancestors: site.ancestors,
              ancestor_attributes: site.ancestor_attributes,
              via: "render",
              location: call_site_location(site.node)
            )
          end

          root_renders = [] #: Array[String]
          roots_resolved = scanned.roots.resolved

          scanned.roots.renders.each do |name|
            target = @partials.lookup(name, file)

            if target
              root_renders << target.file
            else
              roots_resolved = false
            end
          end

          CollectedCallSites.new(
            unresolved: unresolved,
            yields: scanned.yields,
            document_root: scanned.document_root,
            roots: TemplateRoots.new(
              tags: scanned.roots.tags,
              conditional_tags: scanned.roots.conditional_tags,
              renders: root_renders,
              resolved: roots_resolved
            )
          )
        end

        #: (Array[String]) -> RenderGraph
        def build(templates)
          call_sites = {} #: Hash[String, Array[PartialCallSite]]
          roots = {} #: Hash[String, TemplateRoots]
          document_roots = Set.new #: Set[String]
          unresolved_renders = {} #: Hash[String, Integer]
          skipped = Set.new #: Set[String]
          layout_yields = {} #: Hash[String, Array[YieldSite]]
          scanned = [] #: Array[String]

          templates.each do |file|
            source = read(file)

            if source.nil?
              skipped.add(file)
              next
            end

            collected = collect_call_sites(file, source, call_sites)

            unresolved_renders[file] = collected.unresolved if collected.unresolved.positive?
            document_roots.add(file) if collected.document_root
            layout_yields[file] = collected.yields if collected.yields.any?
            roots[file] = collected.roots
            scanned << file
          end

          add_layout_call_sites(scanned, layout_yields, call_sites) if @resolve_layouts

          RenderGraph.new(call_sites, roots, document_roots, unresolved_renders, skipped)
        end

        private

        #: (Array[String], Hash[String, Array[YieldSite]], Hash[String, Array[PartialCallSite]]) -> void
        def add_layout_call_sites(files, layout_yields, call_sites)
          view_roots = @partials.view_roots
          layouts = {} #: Hash[String, String]

          files.each do |file|
            name = PartialResolution.template_name_for_roots(file, view_roots)

            next unless name && layout_yields.key?(file)

            existing = layouts[name]

            next if existing && !PartialResolution.outranks_template?(file, existing)

            layouts[name] = file
          end

          files.each do |file|
            PartialResolution.layout_candidates_for_roots(file, view_roots).each do |candidate|
              layout = layouts[candidate]

              next if layout.nil? || layout == file

              (layout_yields[layout] || []).each do |site|
                (call_sites[file] ||= []) << PartialCallSite.new(
                  caller: layout,
                  locals: [],
                  ancestors: site.ancestors,
                  ancestor_attributes: site.ancestor_attributes,
                  via: "layout",
                  location: site.location
                )
              end

              break
            end
          end
        end

        #: (String) -> Herb::AST::DocumentNode
        def parse(source)
          ::Herb.parse(source, **PARSER_OPTIONS).value
        end

        #: (String) -> String?
        def read(path)
          File.read(path)
        rescue StandardError
          nil
        end

        #: (Herb::AST::Node) -> ScannedTemplate
        def scan_template(root)
          state = ScanState.new

          walk(root, state)

          ScannedTemplate.new(
            sites: state.sites,
            yields: state.yields,
            document_root: state.document_root,
            roots: TemplateRoots.new(
              tags: state.tags,
              conditional_tags: state.conditional_tags,
              renders: state.renders,
              resolved: state.roots_resolved
            )
          )
        end

        #: (Herb::AST::Node, ScanState) -> void
        def walk(current, state)
          element = current.is_a?(AST::HTMLElementNode) ? current : nil
          tag_name = element&.tag_name&.value
          conditional = conditional_node?(current)

          state.conditional_depth += 1 if conditional

          collect_root(current, tag_name, state) if state.stack.empty?

          state.document_root = true if tag_name == DOCUMENT_ROOT_TAG

          state.stack << StackEntry.new(tag_name: tag_name, attributes: static_ancestor_attributes(element)) if tag_name

          if current.is_a?(AST::ERBRenderNode)
            ancestors = state.stack.map(&:tag_name)
            attributes = state.stack.map(&:attributes)

            state.sites << RenderSite.new(
              node: current,
              ancestors: ancestors,
              ancestor_attributes: attributes.any? { |attribute| attribute.any? } ? attributes : nil
            )
          end

          if bare_yield?(current)
            state.yields << YieldSite.new(
              ancestors: state.stack.map(&:tag_name),
              ancestor_attributes: ancestor_attributes_for(state),
              location: call_site_location(current)
            )
          end

          current.child_nodes.each { |child| walk(child, state) if child }

          state.stack.pop if tag_name
          state.conditional_depth -= 1 if conditional
        end

        #: (Herb::AST::Node, String?, ScanState) -> void
        def collect_root(current, tag_name, state)
          if tag_name
            bucket = state.conditional_depth.positive? ? state.conditional_tags : state.tags
            bucket << tag_name
          elsif current.is_a?(AST::ERBRenderNode)
            rendered = partial_name_rendered_by(current)

            if rendered
              state.renders << rendered
            else
              state.roots_resolved = false
            end
          end
        end

        #: (ScanState) -> Array[Hash[String, String]]?
        def ancestor_attributes_for(state)
          attributes = state.stack.map(&:attributes)

          attributes.any? { |attribute| attribute.any? } ? attributes : nil
        end

        #: (Herb::AST::Node) -> bool
        def bare_yield?(node)
          node.is_a?(AST::ERBYieldNode) && node.content&.value&.strip == YIELD_MARKER
        end

        #: (Herb::AST::Node) -> bool
        def conditional_node?(node)
          node.is_a?(AST::ERBIfNode) || node.is_a?(AST::ERBUnlessNode) || node.is_a?(AST::ERBCaseNode)
        end

        #: (Herb::AST::HTMLElementNode?) -> Hash[String, String]
        def static_ancestor_attributes(element)
          return {} unless element

          open_tag = element.open_tag

          return {} unless open_tag.is_a?(AST::HTMLOpenTagNode)

          attributes = {} #: Hash[String, String]

          open_tag.children.each do |child|
            next unless child.is_a?(AST::HTMLAttributeNode)

            name = attribute_name(child)

            next unless name && ANCESTOR_CONTEXT_ATTRIBUTES.include?(name)

            attributes[name] = static_attribute_value(child)
          end

          attributes
        end

        #: (Herb::AST::HTMLAttributeNode) -> String?
        def attribute_name(attribute)
          children = attribute.name&.children

          return nil unless children

          literal_content(children)
        end

        #: (Herb::AST::HTMLAttributeNode) -> String
        def static_attribute_value(attribute)
          value = attribute.value

          return "" unless value

          literal_content(value.children) || ""
        end

        #: (Array[Herb::AST::Node]) -> String?
        def literal_content(children)
          parts = [] #: Array[String]

          children.each do |child|
            return nil unless child.is_a?(AST::LiteralNode)

            parts << (child.content || "")
          end

          parts.join
        end

        #: (Herb::AST::ERBRenderNode) -> String?
        def partial_name_rendered_by(node)
          return nil unless node.static_partial?

          node.partial_path
        end

        #: (Herb::AST::ERBRenderNode) -> Array[String]
        def locals_passed_by(node)
          node.local_names.compact
        end

        #: (Herb::AST::Node) -> CallSiteLocation?
        def call_site_location(node)
          start = node.location&.start

          return nil unless start

          CallSiteLocation.new(line: start.line, column: start.column)
        end
      end
    end
  end
end
