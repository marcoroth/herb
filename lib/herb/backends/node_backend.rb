# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

require_relative "../backend"
require_relative "../lint_result"

require "json"

begin
  require "nodo"
rescue LoadError
  # Will be handled in perform_load
end

module Herb
  module Backends
    class NodeBackend < Backend
      attr_reader :nodo, :herb_node

      protected

      def perform_load
        begin
          require "nodo"
        rescue LoadError
          raise LoadError, "Node backend requires the 'nodo' gem. Please add it to your Gemfile or install it with: gem install nodo"
        end

        @herb_node_class = Herb::Backends::HerbNode
        @herb_node = @herb_node_class.new
      end

      def perform_lex(source)
        result_json = @herb_node.lex(source)

        parse_lex_result(result_json)
      end

      def perform_lex_file(path)
        result_json = @herb_node.lexFile(path)

        parse_lex_result(result_json)
      end

      def perform_parse(source, options)
        result_json = @herb_node.parse(source, convert_options(options))

        parse_parse_result(result_json)
      end

      def perform_parse_file(path, options)
        result_json = @herb_node.parseFile(path, convert_options(options))

        parse_parse_result(result_json)
      end

      def perform_extract_ruby(source)
        @herb_node.extractRuby(source)
      end

      def perform_extract_html(source)
        @herb_node.extractHTML(source)
      end

      def perform_format(source, options)
        @herb_node.format(source, convert_options(options))
      end

      def perform_lint(source, options)
        result_json = @herb_node.lint(source, convert_options(options))

        parse_lint_result(result_json)
      end

      def perform_print_node(node, options)
        node_json = node.to_json

        @herb_node.printNode(node_json, convert_options(options))
      end

      def backend_version
        version = @herb_node.version

        %(herb gem v#{VERSION}, node backend (via nodo), #{version})
      end

      private

      def convert_options(options)
        options.transform_keys { |key| key.to_s.gsub("_", "") }
      end

      def parse_lex_result(json_string)
        data = JSON.parse(json_string, symbolize_names: true)

        ::Herb::LexResult.from_hash(data)
      end

      def parse_parse_result(json_string)
        data = JSON.parse(json_string, symbolize_names: true)

        ::Herb::ParseResult.from_hash(data)
      end

      def parse_lint_result(json_string)
        data = JSON.parse(json_string, symbolize_names: true)

        ::Herb::LintResult.from_hash(data)
      end
    end

    # Only define HerbNode if Nodo is available
    if defined?(Nodo)
      class HerbNode < Nodo::Core
        require Herb: "@herb-tools/node-wasm"
        require HerbCore: "@herb-tools/core"
        require HerbFormatter: "@herb-tools/formatter"
        require HerbLinter: "@herb-tools/linter"
        require HerbPrinter: "@herb-tools/printer"

        script <<~JS
          let herbInstance = null;

          async function ensureLoaded() {
            if (!herbInstance) {
              herbInstance = await Herb.Herb.load();
            }

            return herbInstance;
          }
        JS

        function :lex, <<~JS
          async (source) => {
            const herb = await ensureLoaded();
            const result = herb.lex(source);

            return JSON.stringify(result);
          }
        JS

        function :lexFile, <<~JS
          async (path) => {
            const herb = await ensureLoaded();
            const result = herb.lexFile(path);

            return JSON.stringify(result);
          }
        JS

        function :parse, <<~JS
          async (source, options = {}) => {
            const herb = await ensureLoaded();
            const result = herb.parse(source, options);

            return JSON.stringify(result);
          }
        JS

        function :parseFile, <<~JS
          async (path, options = {}) => {
            const herb = await ensureLoaded();
            const result = herb.parseFile(path, options);

            return JSON.stringify(result);
          }
        JS

        function :extractRuby, <<~JS
          async (source) => {
            const herb = await ensureLoaded();

            return herb.extractRuby(source);
          }
        JS

        function :extractHTML, <<~JS
          async (source) => {
            const herb = await ensureLoaded();

            return herb.extractHTML(source);
          }
        JS

        function :version, <<~JS
          async () => {
            const herb = await ensureLoaded();

            return herb.version;
          }
        JS

        function :format, <<~JS
          async (source, options = {}) => {
            const herb = await ensureLoaded();

            return new HerbFormatter.Formatter(herb).format(source, options);
          }
        JS

        function :lint, <<~JS
          async (source, options = {}) => {
            const herb = await ensureLoaded();
            const result = new HerbLinter.Linter(herb).lint(source, options);

            return JSON.stringify(result);
          }
        JS

        function :printNode, <<~JS
          async (json, options = {}) => {
            const herb = await ensureLoaded();
            const serializedNode = JSON.parse(json);

            const node = HerbCore.fromSerializedNode(serializedNode);

            if (options.format === true) {
              const defaultOptions = {
                indentWidth: 2,
                maxLineLength: 80,
                ...options
              };

              const formatPrinter = new HerbFormatter.FormatPrinter("", defaultOptions);

              return formatPrinter.print(node);
            } else {
              return HerbPrinter.IdentityPrinter.print(node, options);
            }
          }
        JS
      end
    end
  end
end
