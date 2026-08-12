# frozen_string_literal: true

require_relative "call_frame"

module Herb
  module Analysis
    class RenderGraph
      class AncestorChain
        attr_reader :tags #: Array[String]
        attr_reader :attributes #: Array[Hash[String, String]]?
        attr_reader :frames #: Array[CallFrame]

        attr_accessor :occurrences #: Integer

        #: (Array[String], Array[Hash[String, String]]?, Array[CallFrame], Integer) -> void
        def initialize(tags, attributes, frames, occurrences)
          @tags = tags
          @attributes = attributes
          @frames = frames
          @occurrences = occurrences
        end

        EMPTY = new([], nil, [], 1).freeze #: AncestorChain
      end
    end
  end
end
