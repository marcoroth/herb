# frozen_string_literal: true
# typed: true

require "json"

require_relative "../diagnostic"

module Herb
  class Engine
    # The description of a page that the Herb dev tools read: what rendered, and what is wrong with
    # it. The tools find it as a single inert JSON script tag in the document.
    #
    #     <script type="application/json" data-herb-diagnostics>
    #       { "version": 1, "diagnostics": [] }
    #     </script>
    #
    # A reader that does not recognize `version` ignores the whole payload, so it only moves when a
    # change is one an older reader cannot survive. Adding a field is not one of those.
    class DiagnosticsReport
      VERSION = 1 #: Integer
      MAX_DIAGNOSTICS = 200 #: Integer
      ATTRIBUTE = "data-herb-diagnostics" #: String

      attr_reader :sources #: Hash[String, String]

      #: (?max_diagnostics: Integer) -> void
      def initialize(max_diagnostics: MAX_DIAGNOSTICS)
        @max_diagnostics = max_diagnostics
        @diagnostics = {} #: Hash[Array[untyped], Herb::Diagnostic]
        @sources = {} #: Hash[String, String]
      end

      #: (Herb::Diagnostic) -> Herb::Diagnostic
      def add(diagnostic)
        @diagnostics[diagnostic.key] ||= diagnostic

        @diagnostics.shift while @diagnostics.size > @max_diagnostics

        diagnostic
      end

      #: (untyped) -> DiagnosticsReport
      def concat(diagnostics)
        Array(diagnostics).each { |diagnostic| add(diagnostic) }

        self
      end

      #: (String, String?) -> void
      def source(template, source)
        @sources[template] = source if source
      end

      #: () -> Array[Herb::Diagnostic]
      def diagnostics
        @diagnostics.values
      end

      #: () -> bool
      def empty?
        @diagnostics.empty?
      end

      #: () -> Hash[Symbol, untyped]
      def to_h
        {
          version: VERSION,
          diagnostics: diagnostics.map(&:to_h),
          sources: sources,
        }
      end

      alias to_hash to_h

      #: (?untyped) -> String
      def to_json(state = nil)
        to_h.to_json(state)
      end

      #: () -> String
      def to_html
        %(<script type="application/json" #{ATTRIBUTE} data-count="#{@diagnostics.size}">#{escaped_json}</script>)
      end

      private

      #: () -> String
      def escaped_json
        to_json.gsub("<", "\\u003c")
      end
    end
  end
end
