# frozen_string_literal: true

require_relative "../instrumentation"

module Herb
  class Engine
    class Instrumentation
      class QueryCollector
        EVENT = "sql.active_record"
        KEY = :queries
        IGNORED_NAMES = ["SCHEMA", "TRANSACTION"].freeze

        #: () ?{ () -> untyped } -> untyped
        def attach(&block)
          return subscribe unless block
          return yield unless notifications

          notifications.subscribed(method(:handle_event), EVENT, &block)
        end

        #: () -> void
        def detach
          return unless @subscriber && notifications

          notifications.unsubscribe(@subscriber)

          @subscriber = nil
        end

        #: (*untyped) -> void
        def handle_event(*arguments)
          payload = arguments.last

          return unless payload.is_a?(Hash)
          return if payload[:cached]
          return if IGNORED_NAMES.include?(payload[:name])

          Instrumentation.record(KEY, payload[:sql].to_s)

          nil
        end

        private

        #: () -> void
        def subscribe
          return unless notifications

          @subscriber ||= notifications.subscribe(EVENT, method(:handle_event))

          nil
        end

        def notifications
          return nil unless defined?(::ActiveSupport::Notifications)

          ::ActiveSupport::Notifications
        end
      end
    end
  end
end
