# frozen_string_literal: true

require_relative "../report/session"

module Herb
  class Engine
    module ScopedStyle
      # The CSS every scoped block on a page narrowed, collected once however many times the files
      # holding them rendered.
      #
      # A template compiled with `deliver: :hoist` registers here as it renders:
      #
      #     ::Herb::Engine::ScopedStyle::Channel.record("data-herb-scope-1a2b3c4d", ".title[data-herb-scope-1a2b3c4d]{color:red}")
      #
      # It is a channel on the session the page is collecting into, so it registers itself the first
      # time anything records, and nothing in `Report` or `Session` has to know it exists.
      #
      class Channel
        NAME = :scoped_style #: Symbol
        ATTRIBUTE = "data-herb-scoped-styles" #: String
        ANCHOR = :head #: Symbol

        #: (String, String) -> void
        def self.record(scope, css)
          Report::Session.current.channel(NAME) { new }.add(scope, css)

          nil
        end

        #: () -> void
        def initialize
          @styles = {} #: Hash[String, String]
        end

        #: (String, String) -> void
        def add(scope, css)
          @styles[scope] ||= css

          nil
        end

        #: () -> Hash[String, String]
        def styles
          @styles.dup
        end

        #: () -> Symbol
        def anchor
          ANCHOR
        end

        #: () -> bool
        def empty?
          @styles.empty?
        end

        #: () -> String
        def to_html
          return "" if empty?

          %(<style #{ATTRIBUTE} data-count="#{@styles.size}">#{@styles.values.join("\n")}</style>)
        end
      end
    end
  end
end
