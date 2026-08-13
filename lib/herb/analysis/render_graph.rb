# frozen_string_literal: true

require "set"

require_relative "partial_declaration"
require_relative "render_graph/ancestor_chain"
require_relative "render_graph/call_frame"
require_relative "render_graph/call_site_location"
require_relative "render_graph/inferred_signature"
require_relative "render_graph/partial_call_site"
require_relative "render_graph/partial_context"
require_relative "render_graph/template_roots"

module Herb
  module Analysis
    class RenderGraph
      MAX_ANCESTOR_CHAINS = 32 #: Integer

      NO_ROOTS = TemplateRoots.new(tags: [], conditional_tags: [], renders: [], resolved: true) #: TemplateRoots
      UNRESOLVED = PartialContext.new(chains: [], resolved: false) #: PartialContext
      DOCUMENT_ROOT = PartialContext.new(chains: [AncestorChain::EMPTY], resolved: true) #: PartialContext

      #: (Hash[String, untyped]) -> RenderGraph
      def self.from(data)
        call_sites = (data["callSites"] || {}).transform_values { |sites| sites.map { |site| PartialCallSite.from(site) } }
        roots = (data["roots"] || {}).transform_values { |entry| TemplateRoots.from(entry) }

        new(
          call_sites,
          roots,
          Set.new(data["documentRoots"] || []),
          data["unresolvedRenders"] || {},
          Set.new(data["skippedFiles"] || [])
        )
      end

      #: (?Hash[String, Array[PartialCallSite]], ?Hash[String, TemplateRoots], ?Set[String], ?Hash[String, Integer], ?Set[String]) -> void
      def initialize(call_sites = {}, roots = {}, document_roots = Set.new, unresolved_renders = {}, skipped_files = Set.new)
        @call_sites = call_sites
        @roots = roots
        @document_roots = document_roots
        @unresolved_renders = unresolved_renders
        @skipped_files = skipped_files
        @contexts = {} #: Hash[String, PartialContext]
      end

      #: () -> Integer
      def unresolved_render_count
        @unresolved_renders.values.sum
      end

      #: () -> Integer
      def skipped_file_count
        @skipped_files.size
      end

      #: () -> bool
      def complete?
        @unresolved_renders.empty? && @skipped_files.empty?
      end

      #: (String) -> TemplateRoots
      def roots_of(file)
        @roots[file] || NO_ROOTS
      end

      #: (String, TemplateRoots) -> void
      def set_roots(file, roots)
        @roots[file] = roots
      end

      #: (String) -> Array[PartialCallSite]
      def callers_of(partial_file)
        @call_sites[partial_file] || []
      end

      #: (String) -> void
      def add_document_root(file)
        @document_roots.add(file)
      end

      #: (String) -> bool
      def document_root?(file)
        @document_roots.include?(file)
      end

      #: (String) -> void
      def skip(file)
        @skipped_files.add(file)
      end

      #: (String, Hash[String, Array[PartialCallSite]], ?Integer) -> bool
      def replace_calls_from(caller, sites, unresolved = 0)
        changed = replace_unresolved_from(caller, unresolved)

        @call_sites.keys.each do |partial_file|
          call_sites = @call_sites[partial_file]
          remaining = call_sites.reject { |call_site| call_site.caller == caller }

          next if remaining.size == call_sites.size

          changed = true

          if remaining.any?
            @call_sites[partial_file] = remaining
          else
            @call_sites.delete(partial_file)
          end
        end

        sites.each do |partial_file, call_sites|
          next if call_sites.empty?

          changed = true

          @call_sites[partial_file] = callers_of(partial_file) + call_sites
        end

        @contexts.clear if changed

        changed
      end

      #: (String) -> bool
      def remove_calls_to(partial_file)
        return false unless @call_sites.key?(partial_file)

        @call_sites.delete(partial_file)
        @contexts.clear

        true
      end

      #: (String) -> InferredSignature
      def infer_signature(partial_file)
        callers = callers_of(partial_file)
        names = callers.flat_map(&:locals).uniq.sort

        InferredSignature.new(
          locals: names.map { |name| StrictLocal.new(name: name, required: false) },
          call_site_count: callers.size,
          keyword_rest: !complete?
        )
      end

      #: (String) -> PartialContext
      def context_of(file)
        @contexts[file] ||= resolve_context(file, Set.new)
      end

      #: (Array[String], *String) -> Symbol
      def descendant_verdict(files, *tag_names)
        return :unknown if files.empty?

        verdicts = files.map { |file| root_verdict(file, tag_names, Set.new) }

        return :always if verdicts.all?(:always)
        return :never if verdicts.all?(:never)
        return :mixed if verdicts.any? { |verdict| verdict == :always || verdict == :mixed }

        :unknown
      end

      #: () -> Integer
      def size
        @call_sites.size
      end

      #: () -> Hash[String, untyped]
      def to_h
        {
          "callSites" => @call_sites.transform_values { |sites| sites.map(&:to_h) },
          "roots" => @roots.transform_values(&:to_h),
          "documentRoots" => @document_roots.to_a.sort,
          "unresolvedRenders" => @unresolved_renders,
          "skippedFiles" => @skipped_files.to_a.sort
        }
      end

      private

      #: (String, Integer) -> bool
      def replace_unresolved_from(caller, unresolved)
        previous = @unresolved_renders[caller] || 0

        return false if previous == unresolved

        if unresolved.zero?
          @unresolved_renders.delete(caller)
        else
          @unresolved_renders[caller] = unresolved
        end

        true
      end

      #: (String, Array[String], Set[String]) -> Symbol
      def root_verdict(file, tag_names, seen)
        return :never if seen.include?(file)

        seen.add(file)

        roots = roots_of(file)

        return :always if roots.tags.any? { |tag| tag_names.include?(tag) }
        return :mixed if roots.conditional_tags.any? { |tag| tag_names.include?(tag) }

        through = roots.renders.map { |rendered| root_verdict(rendered, tag_names, seen.dup) }

        return :always if through.include?(:always)
        return :mixed if through.include?(:mixed)
        return :unknown if !roots.resolved || through.include?(:unknown)

        :never
      end

      #: (String, Set[String]) -> PartialContext
      def resolve_context(file, visiting)
        return DOCUMENT_ROOT if @document_roots.include?(file)
        return UNRESOLVED if visiting.include?(file)

        call_sites = callers_of(file)

        return UNRESOLVED if call_sites.empty?

        visiting.add(file)

        chains = [] #: Array[AncestorChain]
        by_key = {} #: Hash[String, AncestorChain]
        resolved = true

        call_sites.each do |call_site|
          parent = resolve_context(call_site.caller, visiting)
          resolved = false unless parent.resolved

          frame = frame_for(call_site)
          prefixes = parent.chains.any? ? parent.chains : [AncestorChain::EMPTY]

          prefixes.each do |prefix|
            tags = prefix.tags + call_site.ancestors
            empty = {} #: Hash[String, String]
            attributes = (prefix.attributes || prefix.tags.map { empty }) + (call_site.ancestor_attributes || call_site.ancestors.map { empty })
            key = [tags, attributes].inspect
            existing = by_key[key]

            if existing
              existing.occurrences += prefix.occurrences
              next
            end

            if chains.size >= MAX_ANCESTOR_CHAINS
              resolved = false
              break
            end

            chain = AncestorChain.new(
              tags,
              attributes.any? { |attribute| attribute.any? } ? attributes : nil,
              prefix.frames + [frame],
              prefix.occurrences
            )

            by_key[key] = chain
            chains << chain
          end
        end

        visiting.delete(file)

        PartialContext.new(chains: chains, resolved: resolved)
      end

      #: (PartialCallSite) -> CallFrame
      def frame_for(call_site)
        CallFrame.new(
          file: call_site.caller,
          ancestors: call_site.ancestors,
          ancestor_attributes: call_site.ancestor_attributes,
          via: call_site.via || "render",
          location: call_site.location
        )
      end
    end
  end
end
