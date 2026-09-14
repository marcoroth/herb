# frozen_string_literal: true

require_relative "../../visitor"
require_relative "../../visitor/context_aware"
require_relative "../../visitor/diagnostics"

module Herb
  class Engine
    module Validators
      # A visitor that reads the tree and reports what it finds without rewriting anything.
      #
      # There is nothing here a visitor cannot do on its own. Reporting comes from
      # `Herb::Visitor::Diagnostics` and is open to any visitor, so a validator from somewhere else
      # can include the mixins rather than subclass this. What this adds is the default a validator
      # is expected to carry, which is that a finding refuses to compile unless a caller says
      # otherwise:
      #
      #     Herb::Engine::Validators::SecurityValidator.new(fatal: false)
      #
      class Base < Herb::Visitor
        include Herb::Visitor::ContextAware
        include Herb::Visitor::Diagnostics

        #: (?fatal: bool) -> void
        def initialize(fatal: true)
          super
        end

        #: () -> String
        def inspect
          "#<#{self.class.name} fatal=#{fatal?}>"
        end
      end
    end
  end
end
