# frozen_string_literal: true
# typed: false

require_relative "herb/range"
require_relative "herb/position"
require_relative "herb/location"

require_relative "herb/token"
require_relative "herb/token_list"

require_relative "herb/result"
require_relative "herb/lex_result"
require_relative "herb/parse_result"

require_relative "herb/ast"
require_relative "herb/ast/node"
require_relative "herb/ast/nodes"

require_relative "herb/errors"
require_relative "herb/warnings"
require_relative "herb/diagnostic"
require_relative "herb/lint_offense"
require_relative "herb/lint_result"

require_relative "herb/cli"
require_relative "herb/project"

require_relative "herb/version"

require_relative "herb/visitor"

require_relative "herb/backend"
require_relative "herb/backend_loader"

module Herb
  class << self
    def load_backend(backend_name = nil)
      @backend = BackendLoader.load(backend_name)
      self
    end

    def backend_loaded?
      @backend&.loaded?
    end

    def ensure_backend!
      load_backend unless backend_loaded?
    end

    def lex(source)
      ensure_backend!
      @backend.lex(source)
    end

    def lex_file(path)
      ensure_backend!
      @backend.lex_file(path)
    end

    def parse(source, backend: nil, **options)
      if backend
        self.backend(backend).parse(source, options)
      else
        ensure_backend!
        @backend.parse(source, options)
      end
    end

    def parse_file(path, backend: nil, **options)
      if backend
        self.backend(backend).parse_file(path, options)
      else
        ensure_backend!
        @backend.parse_file(path, options)
      end
    end

    def extract_ruby(source)
      ensure_backend!
      @backend.extract_ruby(source)
    end

    def extract_html(source)
      ensure_backend!
      @backend.extract_html(source)
    end

    def version
      ensure_backend!
      @backend.version
    end

    def format(source, backend: :node, **options)
      self.backend(backend).format(source, options)
    end

    def format_file(path, backend: :node, **options)
      self.backend(backend).format_file(path, options)
    end

    def lint(source, backend: :node, **options)
      self.backend(backend).lint(source, options)
    end

    def lint_file(path, backend: :node, **options)
      self.backend(backend).lint_file(path, options)
    end

    def print_node(node, backend: :node, **options)
      self.backend(backend).print_node(node, options)
    end

    def available_backends
      BackendLoader.available_backends
    end

    def switch_backend(backend_name)
      @backend = BackendLoader.load(backend_name)
      self
    end

    def current_backend
      @backend&.backend_name
    end

    def backend(backend_name)
      BackendLoader.load(backend_name)
    end
  end

  unless ENV["HERB_NO_AUTOLOAD"]
    begin
      Herb.load_backend
    rescue StandardError
      # Backend loading failed, but that's okay - methods will fail when called
    end
  end
end
