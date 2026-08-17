# frozen_string_literal: true

require_relative "ancestor_chain"

module Herb
  module Analysis
    class RenderGraph
      PartialContext = Data.define(:chains, :resolved)

      class PartialContext
        #: (Array[String], *String) -> Symbol
        def ancestor_verdict(local_ancestors, *tag_names)
          return :always if local_ancestors.any? { |tag| tag_names.include?(tag) }
          return :unknown if chains.empty?

          matches = chains.count { |chain| chain.tags.any? { |tag| tag_names.include?(tag) } }

          return :always if matches == chains.size
          return :mixed if matches.positive?

          resolved ? :never : :unknown
        end

        #: (Array[String], *String) -> String?
        def closest_ancestor(local_ancestors, *tag_names)
          local = innermost(local_ancestors, tag_names)

          return local if local

          chains.each do |chain|
            match = innermost(chain.tags, tag_names)

            return match if match
          end

          nil
        end

        #: (Array[String], Array[String]) -> String?
        def innermost(chain, tag_names)
          chain.reverse.find { |tag| tag_names.include?(tag) }
        end
      end
    end
  end
end
