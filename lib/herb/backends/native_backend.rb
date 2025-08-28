# frozen_string_literal: true

require_relative "../backend"

module Herb
  module Backends
    class NativeBackend < Backend
      protected

      def perform_load
        major, minor, _patch = RUBY_VERSION.split(".")

        require_relative "../../herb/#{major}.#{minor}/herb"
      rescue LoadError
        begin
          require_relative "../../herb/herb"
        rescue LoadError
          raise LoadError, "Native backend C extension not available. Please compile the extension with: bundle exec rake compile"
        end
      end

      def perform_lex(source)
        raise NotImplementedError, "Native C extension not loaded" unless respond_to?(:c_perform_lex, true)

        c_perform_lex(source)
      end

      def perform_lex_file(path)
        raise NotImplementedError, "Native C extension not loaded" unless respond_to?(:c_perform_lex_file, true)

        c_perform_lex_file(path)
      end

      def perform_parse(source, options)
        raise NotImplementedError, "Native C extension not loaded" unless respond_to?(:c_perform_parse, true)

        c_perform_parse(source, options)
      end

      def perform_parse_file(path, options)
        raise NotImplementedError, "Native C extension not loaded" unless respond_to?(:c_perform_parse_file, true)

        c_perform_parse_file(path, options)
      end

      def perform_extract_ruby(source)
        raise NotImplementedError, "Native C extension not loaded" unless respond_to?(:c_perform_extract_ruby, true)

        c_perform_extract_ruby(source)
      end

      def perform_extract_html(source)
        raise NotImplementedError, "Native C extension not loaded" unless respond_to?(:c_perform_extract_html, true)

        c_perform_extract_html(source)
      end

      def backend_version
        if respond_to?(:c_backend_version, true)
          c_backend_version
        else
          %(herb gem v#{Herb::VERSION}, native backend (C extension not loaded))
        end
      end

      def perform_format(source, options)
        raise NotImplementedError, "Formatting is not implemented in the native backend. Please use the Node backend: Herb.switch_backend(:node)"
      end

      def perform_lint(source, options)
        raise NotImplementedError, "Linting is not implemented in the native backend. Please use the Node backend: Herb.switch_backend(:node)"
      end

      def perform_print_node(node, options)
        raise NotImplementedError, "Node printing is not implemented in the native backend. Please use the Node backend: Herb.switch_backend(:node)"
      end
    end
  end
end
