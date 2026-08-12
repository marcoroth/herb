# frozen_string_literal: true

require_relative "../partial_declaration"

module Herb
  module Analysis
    class RenderGraph
      InferredSignature = Data.define(:locals, :call_site_count, :keyword_rest)

      class InferredSignature
        #: () -> String
        def strict_locals_declaration
          parameters = locals.map { |local| local.required ? "#{local.name}:" : "#{local.name}: nil" }
          parameters << "**" if keyword_rest

          "<%# locals: (#{parameters.join(", ")}) %>"
        end
      end
    end
  end
end
