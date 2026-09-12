# frozen_string_literal: true

require_relative "../../runtime/session"

module Herb
  class Engine
    module Slots
      class Dependencies
        # The state map a page is driven by, carried once for the response it belongs to.
        #
        # A map is built from the template an action rendered, so there is one for a page however
        # many templates it is made of. The host decides which template that is and hands the map
        # over as it renders:
        #
        #     ::Herb::Engine::Slots::Dependencies::Channel.record(json)
        #
        # Where it lands is the middleware's business, which is what keeps a host from splicing
        # markup into a response itself.
        #
        class Channel
          NAME = :slot_dependencies #: Symbol
          ATTRIBUTE = "data-herb-dependencies" #: String
          ANCHOR = :body #: Symbol

          #: () -> String?
          attr_reader :json

          #: (String) -> String
          def self.tag(json)
            %(<template #{ATTRIBUTE}>#{json}</template>)
          end

          #: (String) -> void
          def self.record(json)
            Runtime::Session.current.channel(NAME) { new }.add(json)

            nil
          end

          #: () -> void
          def initialize
            @json = nil #: String?
          end

          #: (String) -> void
          def add(json)
            @json ||= json

            nil
          end

          #: () -> Symbol
          def anchor
            ANCHOR
          end

          #: () -> bool
          def empty?
            @json.nil? || @json.empty?
          end

          #: () -> String
          def to_html
            return "" if empty?

            self.class.tag(@json.to_s)
          end
        end
      end
    end
  end
end
