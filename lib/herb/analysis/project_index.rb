# frozen_string_literal: true

require "pathname"

require_relative "partial_index"
require_relative "partial_resolution"
require_relative "render_graph_builder"

module Herb
  module Analysis
    class ProjectIndex
      attr_reader :project_path #: Pathname
      attr_reader :partials #: PartialIndex?
      attr_reader :graph #: RenderGraph?

      #: (String | Pathname) -> void
      def initialize(project_path)
        @project_path = Pathname.new(project_path)
        @partials = nil
        @graph = nil
      end

      #: () -> void
      def index_all
        index_partials
        index_call_sites
      end

      #: () -> void
      def index_partials
        @partials = PartialIndex.build(@project_path)
      end

      #: () -> void
      def index_call_sites
        partials = @partials

        return @graph = nil unless partials

        @graph = RenderGraphBuilder.new(partials).build(partials.templates, "")
      end

      #: () -> Pathname?
      def view_root
        @partials&.view_root
      end

      #: (String, ?String?) -> bool
      def handle_change(path, source = nil)
        file = template_file_for(path)

        return false unless file

        declaration_changed = update_partial(file)
        calls_changed = update_call_sites(file, source)

        declaration_changed || calls_changed
      end

      #: (String) -> bool
      def remove(path)
        file = template_file_for(path)

        return false unless file

        stopped_calling = remove_call_sites(file)
        removed_partial = remove_partial(file)

        removed_partial || stopped_calling
      end

      private

      #: (String) -> String?
      def template_file_for(path)
        return nil unless PartialResolution.template_path?(path)

        File.expand_path(path, @project_path.to_s)
      end

      #: (String) -> bool
      def update_partial(file)
        partials = @partials

        return false unless partials && PartialResolution.partial_path?(file)

        !partials.update(file).nil?
      end

      #: (String) -> bool
      def remove_partial(file)
        partials = @partials

        return false unless partials && PartialResolution.partial_path?(file)

        !partials.remove(file).nil?
      end

      #: (String, String?) -> bool
      def update_call_sites(file, source)
        graph = @graph
        partials = @partials

        return false unless graph && partials

        contents = source || read(file)

        return false unless contents

        sites = {} #: Hash[String, Array[RenderGraph::PartialCallSite]]
        collected = RenderGraphBuilder.new(partials).collect_call_sites(file, contents, sites)

        changed = graph.replace_calls_from(file, sites, collected.unresolved)
        graph.set_roots(file, collected.roots)
        graph.add_document_root(file) if collected.document_root

        changed
      end

      #: (String) -> bool
      def remove_call_sites(file)
        graph = @graph

        return false unless graph

        stopped_calling = graph.replace_calls_from(file, {})

        graph.remove_calls_to(file) || stopped_calling
      end

      #: (String) -> String?
      def read(path)
        File.read(path)
      rescue StandardError
        nil
      end
    end
  end
end
