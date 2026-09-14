# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      module Components
        # A deferred block the client requests immediately on mount, so expensive
        # content loads in parallel with the page instead of blocking it.
        #
        class Async < Deferred
          NAME = "Async" #: String

          private

          #: () -> String
          def mode
            "async"
          end
        end
      end
    end
  end
end
