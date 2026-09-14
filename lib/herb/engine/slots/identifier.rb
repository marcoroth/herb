# frozen_string_literal: true

require "digest"

module Herb
  class Engine
    module Slots
      # What a template is called on the wire. Markers, the values payload and the dependency map all
      # name a template, and they only name the same one when they all follow this rule.
      #
      class Identifier
        STRATEGIES = [:path, :digest].freeze #: Array[Symbol]

        #: ((Symbol | ^(String) -> String)) -> void
        def initialize(strategy = :path)
          raise ArgumentError, "unknown identifier #{strategy.inspect}, expected one of #{STRATEGIES.inspect} or a callable" if strategy.is_a?(Symbol) && !STRATEGIES.include?(strategy)

          @strategy = strategy
        end

        #: (String) -> String
        def call(relative_path)
          case @strategy
          when :path
            relative_path
          when :digest
            Digest::SHA256.hexdigest(relative_path).slice(0, 12).to_s
          else
            @strategy.call(relative_path)
          end
        end
      end
    end
  end
end
