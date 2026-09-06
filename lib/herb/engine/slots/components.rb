# frozen_string_literal: true
# typed: true

require_relative "components/base"
require_relative "components/fragment"
require_relative "components/fallback"
require_relative "components/deferred"
require_relative "components/async"
require_relative "components/lazy"

module Herb
  class Engine
    module Slots
      # The compile-time components a slots template may use.
      #
      # A component is a capitalized wrapper tag the slots visitor recognizes and
      # transforms away before any slot is recorded, so the rendered page never
      # carries the tag itself. Each built-in lives in its own file under
      # `components/` and registers here by name.
      #
      module Components
        NAME = /\A[A-Z][A-Za-z0-9]*\z/ #: Regexp
        REGISTRY = { Fragment::NAME => Fragment, Fallback::NAME => Fallback, Async::NAME => Async, Lazy::NAME => Lazy }.freeze #: Hash[String, singleton(Base)]
        BUILT_IN = REGISTRY.keys.freeze #: Array[String]

        #: (String?) -> bool
        def self.component?(tag_name)
          return false if tag_name.nil?

          tag_name.match?(NAME) && tag_name.match?(/[a-z]/)
        end

        #: (String) -> singleton(Base)?
        def self.for(tag_name)
          REGISTRY[tag_name]
        end

        #: (untyped, ?String?) -> bool
        def self.element?(node, name = nil)
          return false unless node.is_a?(Herb::AST::HTMLElementNode)

          tag_name = node.tag_name&.value

          return false unless component?(tag_name)

          name.nil? || tag_name == name
        end
      end
    end
  end
end
