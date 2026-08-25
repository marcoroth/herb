# frozen_string_literal: true

require "json"

require_relative "../report/session"

module Herb
  class Engine
    module SlotManifest
      # What every template on a page said about itself, collected once however many times those
      # templates rendered.
      #
      # A template compiled with `deliver: :hoist` registers here as it renders:
      #
      #     ::Herb::Engine::SlotManifest::Channel.record("app/views/posts/_card.html.erb:a1b2c3d4", "{...}")
      #
      # It is a channel on the session the page is collecting into, so it registers itself the first
      # time anything records, and nothing in `Report` or `Session` has to know it exists. A manifest
      # is decided when a file is compiled, so the first template to record a version says everything
      # there is to say about it and every later rendering costs nothing.
      #
      class Channel
        NAME = :slot_manifest #: Symbol
        ATTRIBUTE = "data-herb-manifests" #: String
        ANCHOR = :body #: Symbol

        #: (String, String) -> void
        def self.record(key, json)
          Report::Session.current.channel(NAME) { new }.add(key, json)

          nil
        end

        #: () -> void
        def initialize
          @manifests = {} #: Hash[String, String]
        end

        #: (String, String) -> void
        def add(key, json)
          @manifests[key] ||= json

          nil
        end

        #: () -> Hash[String, String]
        def manifests
          @manifests.dup
        end

        #: () -> Symbol
        def anchor
          ANCHOR
        end

        #: () -> bool
        def empty?
          @manifests.empty?
        end

        #: () -> String
        def to_html
          return "" if empty?

          body = @manifests.map { |key, json| "#{JSON.generate(key)}:#{json}" }.join(",")

          %(<template #{ATTRIBUTE} data-count="#{@manifests.size}">{#{body}}</template>)
        end
      end
    end
  end
end
