# frozen_string_literal: true

module Herb
  module Analysis
    class RenderGraph
      CallFrame = Data.define(:file, :ancestors, :ancestor_attributes, :via, :location)
    end
  end
end
