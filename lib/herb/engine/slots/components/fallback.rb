# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      module Components
        # The markup a `<Fragment>` shows while its content is stale.
        #
        # A fallback only means something inside a `<Fragment>`, which consumes
        # it during its own transform, so a fallback reaching its own transform
        # stands outside one and errors.
        #
        class Fallback < Base
          NAME = "Fallback" #: String

          #: () -> Array[untyped]
          def transform
            error("`<Fallback>` sits outside a `<Fragment>`, so there is nothing for it to stand in for.", @element.location, suggestion: "Wrap the content it replaces and the `<Fallback>` together in a `<Fragment>`.")

            []
          end
        end
      end
    end
  end
end
