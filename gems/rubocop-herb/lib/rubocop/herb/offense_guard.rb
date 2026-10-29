# frozen_string_literal: true

module RuboCop
  module Herb
    # Drops offenses that point at markup and autocorrections that would edit it.
    module OffenseGuard
      def add_offense(node_or_range, message: nil, severity: nil, &block)
        source = processed_source
        return super unless source.is_a?(TemplateSource) && !is_a?(::RuboCop::Cop::Lint::Syntax)
        return unless source.anchored_in_ruby?(range_from_node_or_range(node_or_range))
        return super unless block

        super do |corrector|
          candidate = ::RuboCop::Cop::Corrector.new(corrector.source_buffer)
          yield(candidate)

          corrector.merge!(candidate) if candidate.as_replacements.all? { |range, _| source.within_ruby?(range) }
        end
      end
    end
  end
end
