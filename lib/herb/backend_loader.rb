# frozen_string_literal: true

module Herb
  class BackendLoader
    BACKENDS = {
      native: "backends/native_backend",
      node: "backends/node_backend",
    }.freeze

    DEFAULT_PRIORITY = [:native, :node].freeze

    class << self
      def load(backend_name = nil)
        backend_name ||= detect_backend

        case backend_name.to_sym
        when :native
          load_native_backend
        when :node
          load_node_backend
        else
          raise ArgumentError, "Unknown backend: #{backend_name}. Available backends: #{BACKENDS.keys.join(", ")}"
        end
      end

      def detect_backend
        if ENV["HERB_BACKEND"]
          backend = ENV["HERB_BACKEND"]&.downcase&.to_sym

          return backend if BACKENDS.key?(backend)

          warn "Warning: Unknown HERB_BACKEND '#{ENV["HERB_BACKEND"]}'. Falling back to auto-detection."
        end

        DEFAULT_PRIORITY.each do |backend_name|
          backend = test_backend(backend_name)
          return backend_name if backend
        rescue LoadError, StandardError
          # Try next backend
        end

        raise "No suitable Herb backend found. Please install required dependencies."
      end

      def available_backends
        backends = [] #: Array[Herb::Backend]

        BACKENDS.each_key do |name|
          backend = test_backend(name)
          backends << name if backend
        rescue LoadError, NotImplementedError, StandardError
          # Backend not available, skip it
        end

        backends
      end

      private

      def load_native_backend
        require_relative BACKENDS[:native]
        backend = Herb::Backends::NativeBackend.new
        backend.load
        backend
      rescue LoadError => e
        raise LoadError, "Native backend not available. The C extension may not be compiled.\n#{e.message}"
      end

      def load_node_backend
        require_relative BACKENDS[:node]
        backend = Herb::Backends::NodeBackend.new
        backend.load
        backend
      rescue LoadError => e
        raise LoadError, "Node backend not available. Please install the 'nodo' gem.\n#{e.message}"
      end

      def test_backend(backend_name)
        backend = case backend_name
                  when :native
                    require_relative BACKENDS[:native]
                    Herb::Backends::NativeBackend.new
                  when :node
                    require_relative BACKENDS[:node]
                    Herb::Backends::NodeBackend.new
                  end

        backend&.load
        backend
      rescue NotImplementedError
        nil
      end
    end
  end
end
