# frozen_string_literal: true

require_relative "../backend"

module Herb
  module Backends
    class WASMBackend < Backend
      protected

      def perform_load
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def perform_lex(source)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def perform_lex_file(path)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def perform_parse(source, options)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def perform_parse_file(path, options)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def perform_extract_ruby(source)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def perform_extract_html(source)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Native or Node backends."
      end

      def backend_version
        "wasm (not implemented)"
      end

      def perform_format(source, options)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Node backend for formatting."
      end

      def perform_lint(source, options)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Node backend for linting."
      end

      def perform_print_node(node, options)
        raise NotImplementedError, "WASM backend is not yet implemented. Please use the Node backend for printing."
      end
    end
  end
end
