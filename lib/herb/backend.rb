# frozen_string_literal: true

module Herb
  class Backend
    attr_reader :loaded

    def initialize
      @loaded = false
    end

    def load
      return self if @loaded

      perform_load
      @loaded = true
      self
    end

    def loaded?
      @loaded
    end

    def lex(source)
      ensure_loaded!
      perform_lex(source)
    end

    def lex_file(path)
      ensure_loaded!
      perform_lex_file(path)
    end

    def parse(source, options = {})
      ensure_loaded!
      perform_parse(source, options)
    end

    def parse_file(path, options = {})
      ensure_loaded!
      perform_parse_file(path, options)
    end

    def extract_ruby(source)
      ensure_loaded!
      perform_extract_ruby(source)
    end

    def extract_html(source)
      ensure_loaded!
      perform_extract_html(source)
    end

    def version
      ensure_loaded!
      backend_version
    end

    def format(source, options = {})
      ensure_loaded!
      perform_format(source, options)
    end

    def format_file(path, options = {})
      ensure_loaded!
      perform_format_file(path, options)
    end

    def lint(source, options = {})
      ensure_loaded!
      perform_lint(source, options)
    end

    def lint_file(path, options = {})
      ensure_loaded!
      perform_lint_file(path, options)
    end

    def print_node(node, options = {})
      ensure_loaded!
      perform_print_node(node, options)
    end

    def backend_name
      self.class.name.split("::").last.sub(/Backend$/, "").downcase
    end

    protected

    def perform_load
      raise NotImplementedError, "#{self.class}#perform_load must be implemented"
    end

    def perform_lex(source)
      raise NotImplementedError, "#{self.class}#perform_lex must be implemented"
    end

    def perform_lex_file(path)
      raise NotImplementedError, "#{self.class}#perform_lex_file must be implemented"
    end

    def perform_parse(source, options)
      raise NotImplementedError, "#{self.class}#perform_parse must be implemented"
    end

    def perform_parse_file(path, options)
      raise NotImplementedError, "#{self.class}#perform_parse_file must be implemented"
    end

    def perform_extract_ruby(source)
      raise NotImplementedError, "#{self.class}#perform_extract_ruby must be implemented"
    end

    def perform_extract_html(source)
      raise NotImplementedError, "#{self.class}#perform_extract_html must be implemented"
    end

    def backend_version
      raise NotImplementedError, "#{self.class}#backend_version must be implemented"
    end

    def perform_format(source, options)
      raise NotImplementedError,
            "#{self.class}#perform_format not implemented. This backend does not support formatting."
    end

    def perform_format_file(path, options)
      source = File.read(path, encoding: "UTF-8")
      perform_format(source, options)
    end

    def perform_lint(source, options)
      raise NotImplementedError, "#{self.class}#perform_lint not implemented. This backend does not support linting."
    end

    def perform_lint_file(path, options)
      source = File.read(path, encoding: "UTF-8")
      perform_lint(source, options)
    end

    def perform_print_node(node, options)
      raise NotImplementedError,
            "#{self.class}#perform_print_node not implemented. This backend does not support node printing."
    end

    private

    def ensure_loaded!
      raise "Backend not loaded. Call #load first." unless loaded?
    end
  end
end
