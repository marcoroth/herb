# frozen_string_literal: true
# typed: false

require_relative "herb/colors"
require_relative "herb/range"
require_relative "herb/position"
require_relative "herb/location"

require_relative "herb/token"
require_relative "herb/token_list"

require_relative "herb/result"
require_relative "herb/lex_result"
require_relative "herb/parser_options"
require_relative "herb/parse_result"
require_relative "herb/diff"
require_relative "herb/backend"

require_relative "herb/ast/node"
require_relative "herb/ast/nodes"
require_relative "herb/ast/erb_content_node"
require_relative "herb/ast/helpers"
require_relative "herb/ast/erb_render_node"

require_relative "herb/errors"
require_relative "herb/warnings"
require_relative "herb/diagnostic"

require_relative "herb/version"
require_relative "herb/visitor"

begin
  major, minor, _patch = RUBY_VERSION.split(".") #: [String, String, String]

  if RUBY_PATCHLEVEL == -1
    require_relative "herb/herb"
  else
    begin
      require_relative "herb/#{major}.#{minor}/herb"
    rescue LoadError
      require_relative "herb/herb"
    end
  end
rescue LoadError => e
  raise LoadError, <<~MESSAGE
    Failed to load the Herb native extension.

    Tried to load: #{e.message.split(" -- ").last}

    This can happen when:
      1. You're using a preview/development version of Ruby (RUBY_PATCHLEVEL=#{RUBY_PATCHLEVEL})
      2. The native extension wasn't compiled during gem installation
      3. Required build tools (C compiler) were missing during installation

    To fix, try reinstalling with source compilation:
      gem install herb --platform ruby

    If compilation fails, install a C compiler first:
      - macOS:          xcode-select --install
      - Ubuntu/Debian:  apt-get install build-essential
      - Fedora/RHEL:    dnf install make gcc
      - Alpine:         apk add build-base
  MESSAGE
end

module Herb
  #: (String input, ?track_whitespace: bool, ?track_locations: bool, ?analyze: bool, ?strict: bool, ?action_view_helpers: bool, ?transform_conditionals: bool, ?dot_notation_tags: bool, ?render_nodes: bool, ?strict_locals: bool, ?herb_directives: bool, ?iteration_nodes: bool, ?prism_nodes: bool, ?prism_nodes_deep: bool, ?prism_program: bool, ?html: bool, ?erb_openers: Array[String], ?arena_stats: bool) -> ParseResult
  def self.parse(...)
    Backend.parse(...)
  end

  #: (String input, ?erb_openers: Array[String], ?arena_stats: bool) -> LexResult
  def self.lex(...)
    Backend.lex(...)
  end

  #: (String source, ?semicolons: bool, ?comments: bool, ?preserve_positions: bool, ?custom_tags: bool, ?erb_openers: Array[String]) -> String
  def self.extract_ruby(...)
    Backend.extract_ruby(...)
  end

  #: (String source) -> String
  def self.extract_html(...)
    Backend.extract_html(...)
  end

  #: (String old_source, String new_source, ?track_whitespace_changes: bool) -> Herb::Diff::Result
  def self.diff(...)
    Backend.diff(...)
  end

  #: (?arena_stats: bool) -> untyped
  def self.arena_stats(...)
    Backend.arena_stats(...)
  end

  #: (String source) -> untyped
  def self.leak_check(...)
    Backend.leak_check(...)
  end

  #: () -> String
  def self.version
    Backend.version
  end

  #: (String path, ?arena_stats: bool) -> LexResult
  def self.lex_file(path, arena_stats: ParserOptions::DEFAULT_CAPTURE_ARENA_STATS)
    lex(File.read(path), arena_stats: arena_stats)
  end

  #: (String path, ?track_whitespace: bool, ?track_locations: bool, ?analyze: bool, ?strict: bool, ?action_view_helpers: bool, ?transform_conditionals: bool, ?strict_locals: bool, ?herb_directives: bool, ?prism_nodes: bool, ?prism_nodes_deep: bool, ?prism_program: bool, ?arena_stats: bool) -> ParseResult
  def self.parse_file(path, track_locations: ParserOptions::DEFAULT_TRACK_LOCATIONS, track_whitespace: ParserOptions::DEFAULT_TRACK_WHITESPACE, analyze: ParserOptions::DEFAULT_ANALYZE, strict: ParserOptions::DEFAULT_STRICT, action_view_helpers: ParserOptions::DEFAULT_ACTION_VIEW_HELPERS, transform_conditionals: ParserOptions::DEFAULT_TRANSFORM_CONDITIONALS, strict_locals: ParserOptions::DEFAULT_STRICT_LOCALS, herb_directives: ParserOptions::DEFAULT_HERB_DIRECTIVES, prism_nodes: ParserOptions::DEFAULT_PRISM_NODES, prism_nodes_deep: ParserOptions::DEFAULT_PRISM_NODES_DEEP, prism_program: ParserOptions::DEFAULT_PRISM_PROGRAM, arena_stats: ParserOptions::DEFAULT_CAPTURE_ARENA_STATS)
    parse(File.read(path), track_locations: track_locations, track_whitespace: track_whitespace, analyze: analyze, strict: strict, action_view_helpers: action_view_helpers, transform_conditionals: transform_conditionals, strict_locals: strict_locals, herb_directives: herb_directives, prism_nodes: prism_nodes, prism_nodes_deep: prism_nodes_deep, prism_program: prism_program, arena_stats: arena_stats)
  end

  #: (String source) -> Prism::ParseResult
  def self.parse_ruby(source)
    require "prism"

    Prism.parse(source)
  end

  #: () -> Array[String]
  def self.default_erb_openings
    @default_erb_openings ||= Backend.default_erb_openings.freeze
  end

  def self.configuration(project_path = nil)
    require_relative "herb/configuration"

    @configuration ||= Configuration.load(project_path)
  end

  def self.configure(project_path = nil)
    require_relative "herb/configuration"

    @configuration = Configuration.load(project_path)
  end

  def self.reset_configuration!
    @configuration = nil
  end

  #: (*String gems) -> void
  def self.ensure_installed(*gems)
    missing = gems.reject do |name|
      require name
      true
    rescue LoadError
      false
    end

    return if missing.empty?

    require "bundler/inline"

    verbose = $VERBOSE
    $VERBOSE = nil

    begin
      gemfile(true, quiet: true) do # steep:ignore
        source "https://rubygems.org" # steep:ignore
        missing.each { |name| gem name }
      end
    ensure
      $VERBOSE = verbose
    end
  end
end
