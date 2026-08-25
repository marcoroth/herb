# frozen_string_literal: true
# typed: true

module Herb
  class Visitor
    # Lets a visitor declare the parser options the AST it is handed has to carry, so that
    # whoever parses can satisfy them before visiting.
    #
    #     class PrismProgramVisitor < Herb::Visitor
    #       required_parser_option prism_program: true
    #       recommended_parser_option strict: false
    #     end
    #
    # A required option is one the visitor cannot work without, and a recommended one is a soft
    # requirement it only works better with. `Herb::Visitor.parser_options_for` resolves both for
    # a set of visitors, raising on a conflicting requirement and warning on a conflicting
    # recommendation.
    #
    # `Herb::Visitor` includes this, so every visitor has it. Anything else that is passed to
    # `Herb::Engine` as a visitor can include it too.
    module ParserOptionRequirements
      #: (untyped) -> void
      def self.included(base)
        super

        base.extend(ClassMethods)
      end

      module ClassMethods
        #: (**untyped) -> void
        def required_parser_option(**options)
          declared_parser_options(:required).merge!(options.transform_keys(&:to_sym))
        end

        #: (**untyped) -> void
        def recommended_parser_option(**options)
          declared_parser_options(:recommended).merge!(options.transform_keys(&:to_sym))
        end

        #: () -> Hash[Symbol, untyped]
        def required_parser_options
          declared_parser_options(:required).dup
        end

        #: () -> Hash[Symbol, untyped]
        def recommended_parser_options
          declared_parser_options(:recommended).dup
        end

        #: (untyped) -> void
        def inherited(subclass)
          super

          subclass.required_parser_option(**required_parser_options)
          subclass.recommended_parser_option(**recommended_parser_options)
        end

        #: (Array[untyped], ?Hash[Symbol, untyped]) -> Hash[Symbol, untyped]
        def parser_options_for(visitors, parser_options = {})
          options = parser_options.transform_keys(&:to_sym)

          apply_required_parser_options(visitors, options)
          apply_recommended_parser_options(visitors, options)

          options
        end

        private

        #: (Array[untyped], Hash[Symbol, untyped]) -> void
        def apply_required_parser_options(visitors, options)
          each_declared_parser_option(visitors, :required_parser_options) do |visitor, name, value|
            current = options[name]

            if options.key?(name) && current != value
              Kernel.raise(
                ArgumentError,
                "#{describe(visitor)} requires the `#{name}` parser option to be #{value.inspect}, but it is set to #{current.inspect}"
              )
            end

            options[name] = value
          end
        end

        #: (Array[untyped], Hash[Symbol, untyped]) -> void
        def apply_recommended_parser_options(visitors, options)
          each_declared_parser_option(visitors, :recommended_parser_options) do |visitor, name, value|
            current = options[name]

            unless options.key?(name)
              options[name] = value

              next
            end

            next if current == value

            Kernel.warn "[Herb] #{describe(visitor)} recommends the `#{name}` parser option to be #{value.inspect}, but it is set to #{current.inspect}"
          end
        end

        #: (Symbol) -> Hash[Symbol, untyped]
        def declared_parser_options(kind)
          store = @declared_parser_options ||= {} #: Hash[Symbol, Hash[Symbol, untyped]]

          store[kind] ||= {}
        end

        #: (Array[untyped], Symbol) { (untyped, Symbol, untyped) -> void } -> void
        def each_declared_parser_option(visitors, reader)
          visitors.each do |visitor|
            next unless visitor.respond_to?(reader)

            visitor.public_send(reader).each do |name, value|
              yield(visitor, name.to_sym, value)
            end
          end
        end

        #: (untyped) -> String
        def describe(visitor)
          visitor.class.name || visitor.class.to_s
        end
      end

      #: () -> Hash[Symbol, untyped]
      def required_parser_options
        declaring_class.required_parser_options
      end

      #: () -> Hash[Symbol, untyped]
      def recommended_parser_options
        declaring_class.recommended_parser_options
      end

      #: (untyped) -> untyped
      def self.class_of(object)
        object.class
      end

      private

      #: () -> untyped
      def declaring_class
        ParserOptionRequirements.class_of(self)
      end
    end
  end
end
