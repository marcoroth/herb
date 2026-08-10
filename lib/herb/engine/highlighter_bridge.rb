# frozen_string_literal: true

require "json"
require "open3"
require "tempfile"

module Herb
  class Engine
    class HighlighterBridge
      FRAGMENT_SEPARATOR = "----herb-fragment-3f1b0c----"

      MONOREPO_BIN = File.expand_path(
        "../../../javascript/packages/highlighter/bin/herb-highlight",
        __dir__ || "."
      )

      # @rbs!
      #   def self.stylesheet_cache: () -> Hash[String, String]?
      #   def self.stylesheet_cache=: (Hash[String, String]?) -> Hash[String, String]?

      class << self
        attr_accessor :stylesheet_cache

        #: () -> bool
        def node_available?
          return @node_available if defined?(@node_available)

          @node_available = begin
            _stdout, _stderr, status = Open3.capture3("node", "--version")
            status.success?
          rescue StandardError
            false
          end
        end
      end

      #: (?enabled: bool, ?highlighter_path: String?) -> void
      def initialize(enabled: true, highlighter_path: nil)
        @enabled = enabled
        @explicit_path = highlighter_path
      end

      #: () -> bool
      def available?
        @enabled && !path.nil?
      end

      #: () -> String?
      def path
        return @path if defined?(@path)

        @path = discover_path
      end

      #: (source: String, errors: Array[untyped], filename: untyped, ?context_lines: Integer) -> String?
      def ansi_diagnostics(source:, errors:, filename:, context_lines: 2)
        return nil unless available?

        with_tempfiles(source, errors) do |source_path, diagnostics_path|
          output = run([
                         "--diagnostics", diagnostics_path,
                         "--split-diagnostics",
                         "--context-lines", context_lines.to_s,
                         source_path
                       ])

          relabel_ansi(output, source_path, filename)
        end
      end

      #: (source: String, line: Integer, filename: untyped, ?context_lines: Integer) -> String?
      def ansi_focus(source:, line:, filename:, context_lines: 2)
        return nil unless available?

        with_tempfiles(source) do |source_path, _diagnostics_path|
          output = run([
                         "--focus", line.to_s,
                         "--context-lines", context_lines.to_s,
                         source_path
                       ])

          relabel_ansi(output, source_path, filename)
        end
      end

      #: (source: String, errors: Array[untyped], filename: untyped, ?context_lines: Integer, ?messages: String, ?markers: String) -> Array[String]
      def html_fragments(source:, errors:, filename:, context_lines: 2, messages: "both", markers: "spans", line_numbers: "css") # rubocop:disable Metrics/ParameterLists
        return [] unless available?

        fragments = with_tempfiles(source, errors) do |source_path, diagnostics_path|
          args = [
            "--format", "html",
            "--html-markers", markers,
            "--diagnostics", diagnostics_path,
            "--split-diagnostics",
            "--html-fragment-separator=#{FRAGMENT_SEPARATOR}",
            "--context-lines", context_lines.to_s
          ]

          args << "--html-messages" << "hover" if messages == "both"
          args << "--html-line-numbers" << "element" if line_numbers == "element"
          args << source_path

          output = run(args)
          next [] unless output

          relabeled = relabel_html(output, source_path, filename) || output

          relabeled.split(FRAGMENT_SEPARATOR).map(&:strip).reject(&:empty?)
        end

        fragments || []
      end

      #: (?String theme) -> String?
      def stylesheet(theme = "onedark")
        cache = (self.class.stylesheet_cache ||= {})
        return cache[theme] if cache.key?(theme)

        return nil unless available?

        output = run(["--emit-css", theme])
        cache[theme] = output if output

        output
      end

      #: (Array[untyped] errors) -> Array[Hash[Symbol, untyped]]
      def diagnostics_for(errors)
        errors.map { |error| diagnostic_for(error) }
      end

      private

      #: () -> String?
      def discover_path
        return nil unless @enabled

        if @explicit_path
          return @explicit_path if File.exist?(@explicit_path)

          return nil
        end

        return MONOREPO_BIN if File.executable?(MONOREPO_BIN) && self.class.node_available?

        find_in_path("herb-highlight")
      end

      #: (String name) -> String?
      def find_in_path(name)
        ENV.fetch("PATH", "").split(File::PATH_SEPARATOR).each do |directory|
          candidate = File.join(directory, name)

          return candidate if File.file?(candidate) && File.executable?(candidate)
        end

        nil
      end

      #: (String source, ?Array[untyped]? errors) { (untyped, untyped) -> untyped } -> untyped
      def with_tempfiles(source, errors = nil)
        source_file = Tempfile.new(["herb_source", ".html.erb"])
        source_file.write(source)
        source_file.close

        diagnostics_file = nil

        if errors
          diagnostics_file = Tempfile.new(["herb_diagnostics", ".json"])
          diagnostics_file.write(JSON.pretty_generate(diagnostics_for(errors)))
          diagnostics_file.close
        end

        yield source_file.path, diagnostics_file&.path
      rescue StandardError
        nil
      ensure
        source_file&.unlink
        diagnostics_file&.unlink
      end

      #: (Array[untyped] args) -> String?
      def run(args)
        stdout, _stderr, status = Open3.capture3(path.to_s, *args.map(&:to_s))

        return nil unless status.success?
        return nil if stdout.strip.empty?

        stdout
      rescue StandardError
        nil
      end

      #: (String? output, String tmp_path, untyped display_name) -> String?
      def relabel_ansi(output, tmp_path, display_name)
        return nil unless output
        return output unless display_name

        output.gsub(tmp_path, display_name.to_s)
      end

      #: (String? output, String tmp_path, untyped display_name) -> String?
      def relabel_html(output, tmp_path, display_name)
        return nil unless output
        return output unless display_name

        output.gsub(escape_html(tmp_path), escape_html(display_name.to_s))
      end

      #: (untyped error) -> Hash[Symbol, untyped]
      def diagnostic_for(error)
        if error.is_a?(Hash)
          location = error[:location]
          {
            message: error[:message],
            location: {
              start: {
                line: location&.start&.line || 1,
                column: location&.start&.column || 1,
              },
              end: {
                line: location&.end&.line || location&.start&.line || 1,
                column: location&.end&.column || location&.start&.column || 1,
              },
            },
            severity: error[:severity] || "error",
            code: error[:code] || "UnknownError",
            source: error[:source] || "herb-validator",
          }
        else
          severity = case error
                     when Herb::Errors::RubyParseError
                       error.level == "error" ? "error" : "warning"
                     else
                       "error"
                     end

          {
            message: error.message,
            location: {
              start: {
                line: error.location&.start&.line || 1,
                column: error.location&.start&.column || 1,
              },
              end: {
                line: error.location&.end&.line || error.location&.start&.line || 1,
                column: error.location&.end&.column || error.location&.start&.column || 1,
              },
            },
            severity: severity,
            code: error.class.name.split("::").last.gsub(/Error$/, ""),
            source: "herb-compiler",
          }
        end
      end

      #: (untyped text) -> String
      def escape_html(text)
        text.to_s
            .gsub("&", "&amp;")
            .gsub("<", "&lt;")
            .gsub(">", "&gt;")
            .gsub('"', "&quot;")
            .gsub("'", "&#39;")
      end
    end
  end
end
