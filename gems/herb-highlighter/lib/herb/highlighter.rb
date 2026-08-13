# frozen_string_literal: true

require "json"

require_relative "highlighter/version"

begin
  major, minor, = RUBY_VERSION.split(".")
  require_relative "highlighter/#{major}.#{minor}/herb_highlighter"
rescue LoadError
  require_relative "highlighter/herb_highlighter"
end

require_relative "highlighter/executable"

module Herb
  class Highlighter
    attr_reader :theme #: String

    def self.highlight(content, theme: default_theme, path: "", **)
      new(theme).highlight(content, path: path, **)
    end

    def self.highlight_file(path, theme: default_theme, **)
      new(theme).highlight_file(path, **)
    end

    def self.highlight_diff(original, modified, theme: default_theme, path: "", **)
      new(theme).highlight_diff(original, modified, path: path, **)
    end

    def self.themes
      theme_names
    end

    def initialize(theme = self.class.default_theme)
      _initialize(theme.to_s)
    end

    def highlight(content, path: "", **options)
      _highlight(path.to_s, content.to_s, JSON.generate(options))
    end

    def highlight_file(path, **options)
      _highlight_file(path.to_s, JSON.generate(options))
    end

    def highlight_diagnostic(content, diagnostic, path: "", **options)
      _highlight_diagnostic(path.to_s, JSON.generate(diagnostic), content.to_s, JSON.generate(options))
    end

    def highlight_diff(original, modified, path: "", **options)
      _highlight_diff(path.to_s, original.to_s, modified.to_s, JSON.generate(options))
    end

    def highlight_diff_hunks(hunks, path: "", **options)
      _highlight_diff_hunks(path.to_s, JSON.generate(hunks), JSON.generate(options))
    end

    def custom_theme?
      !self.class.bundled_theme?(theme)
    end

    def inspect
      "#<#{self.class.name} theme=#{theme.inspect}>"
    end
  end
end
