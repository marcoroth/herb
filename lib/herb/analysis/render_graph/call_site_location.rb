# frozen_string_literal: true

module Herb
  module Analysis
    class RenderGraph
      CallSiteLocation = Data.define(:line, :column)

      class CallSiteLocation
        #: (Hash[String, untyped]?) -> CallSiteLocation?
        def self.from(data)
          return nil unless data

          new(line: data["line"], column: data["column"])
        end

        #: () -> Hash[String, Integer]
        def to_h
          { "line" => line, "column" => column }
        end
      end
    end
  end
end
