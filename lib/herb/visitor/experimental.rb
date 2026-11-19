# frozen_string_literal: true

module Herb
  class Visitor
    # Says once, for the life of a process, that a visitor is not settled yet.
    #
    #     class ComponentVisitor < Visitor
    #       extend Experimental
    #
    #       experimental "The Component-Transform Visitor is experimental. Its output and API may change."
    #     end
    #
    # The notice goes out when the first one is built, so a host that never reaches for the visitor
    # never hears about it.
    #
    module Experimental
      #: (String) -> void
      def experimental(notice)
        @notice = notice
      end

      #: (*untyped, **untyped) ?{ (?) -> untyped } -> untyped
      def new(*, **, &)
        announce_experimental if @notice

        super
      end

      private

      #: () -> void
      def announce_experimental
        fresh = {} #: Hash[Module, bool]
        announced = Thread.main.thread_variable_get(:herb_experimental_notices) || Thread.main.thread_variable_set(:herb_experimental_notices, fresh)

        return if announced[self]

        announced[self] = true

        warn "[Herb] #{@notice}"
      end
    end
  end
end
