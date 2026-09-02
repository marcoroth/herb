# frozen_string_literal: true
# typed: true

require_relative "../visitor/stack"
require_relative "validators/base"
require_relative "validators/security_validator"
require_relative "validators/nesting_validator"
require_relative "validators/accessibility_validator"
require_relative "validators/render_validator"

module Herb
  class Engine
    # The validators Herb ships, and one way to ask for the ones a project has switched on.
    #
    # Nothing here runs unless a caller asks for it. `Herb::Engine` compiles whatever passes it is
    # given and holds no opinion about validation, so wanting the usual set means saying so:
    #
    #     Herb::Engine.new(source, visitors: Herb::Engine::Validators.all(fatal: false))
    #
    # Reading which ones are switched on lives here rather than in the engine, so that a caller
    # that already knows what it wants never has to consult configuration at all.
    #
    module Validators
      ALL = {
        security: SecurityValidator,
        nesting: NestingValidator,
        accessibility: AccessibilityValidator,
        render: RenderValidator,
      }.freeze #: Hash[Symbol, untyped]

      #: (?fatal: bool, **untyped) -> Herb::Visitor::Stack
      def self.all(fatal: true, **overrides)
        enabled = Herb.configuration.enabled_validators(overrides)

        ALL.each_with_object(Visitor::Stack.new) do |(name, validator), stack|
          stack.use(validator.new(fatal: fatal)) if enabled[name]
        end
      end
    end
  end
end
