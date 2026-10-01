# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      module Components
        # A deferred block the client requests when it nears the viewport, and
        # never requests for content the reader never reaches.
        #
        class Lazy < Deferred
          NAME = "Lazy" #: String

          private

          #: () -> String
          def mode
            "lazy"
          end
        end
      end
    end
  end
end
