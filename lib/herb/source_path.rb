# frozen_string_literal: true
# typed: true

require "pathname"

module Herb
  # A path, and optionally where in it something is.
  #
  #     Herb::SourcePath.new("app/views/posts/_card.html.erb", line: 8, column: 2).to_s
  #     #=> "app/views/posts/_card.html.erb:8:3"
  #
  #     Herb::SourcePath.parse("app/views/posts/_card.html.erb:8:3").position
  #     #=> #<Herb::Position (8:2)>
  #
  # `path:line:column` is what an editor linkifies, what a terminal makes clickable, and what
  # `data-herb-source` holds. Herb wrote it by hand in five places and they did not agree, because
  # the column the parser reports is 0-based and the column an editor shows is 1-based. Everything
  # that reads or writes one of these strings goes through here so that conversion happens once.
  #
  # A part that is not known is left out, so a path on its own stays a path:
  #
  #     Herb::SourcePath.new("index.html.erb").to_s        #=> "index.html.erb"
  #     Herb::SourcePath.new("index.html.erb", line: 8).to_s #=> "index.html.erb:8"
  #
  # A scheme is optional too, and turns the same reference into something an editor opens:
  #
  #     Herb::SourcePath.new(path, line: 8, column: 2, scheme: "vscode").to_s
  #     #=> "vscode://file/app/views/posts/_card.html.erb:8:3"
  #
  # A project turns the same reference into either form. A stamp and a diagnostic show the relative
  # path, and an editor scheme needs the absolute one:
  #
  #     reference = Herb::SourcePath.at(path, position, project_path: Rails.root)
  #
  #     reference.relative.to_s                    #=> "app/views/posts/_card.html.erb:8:3"
  #     reference.absolute.with_scheme("vscode").to_s
  #     #=> "vscode://file/Users/marco/blog/app/views/posts/_card.html.erb:8:3"
  #
  # Neither is guessed. `to_s` writes the path it was handed, so a caller says which one it wants.
  # An editor scheme names a file from the root, so call `absolute` before putting one on.
  #
  # Lines count from one and columns count from zero, which is what the parser reports and what
  # `Herb::Position` carries. Only `to_s` and `parse` speak the 1-based column an editor shows.
  #
  class SourcePath
    PATTERN = %r{
      \A
      (?:(?<scheme>[a-z][a-z0-9+.-]*)://file(?=/))?
      (?<path>.*?)
      (?::(?<line>\d+)(?::(?<column>\d+))?)?
      \z
    }ix #: Regexp

    FILE_SCHEME_SEPARATOR = "://file" #: String

    attr_reader :path #: Pathname
    attr_reader :project_path #: Pathname?
    attr_reader :line #: Integer?
    attr_reader :column #: Integer?
    attr_reader :scheme #: String?

    #: ((String | Pathname), ?project_path: (String | Pathname)?, ?line: Integer?, ?column: Integer?, ?scheme: String?) -> void
    def initialize(path, project_path: nil, line: nil, column: nil, scheme: nil)
      @path = self.class.coerce(path) #: Pathname
      @project_path = project_path.nil? ? nil : self.class.coerce(project_path)
      @line = line
      @column = line.nil? ? nil : column
      @scheme = scheme

      freeze
    end

    #: ((String | Pathname), Herb::Position?, ?project_path: (String | Pathname)?, ?scheme: String?) -> SourcePath
    def self.at(path, position, project_path: nil, scheme: nil)
      return new(path, project_path: project_path, scheme: scheme) unless position

      new(path, project_path: project_path, line: position.line, column: position.column, scheme: scheme)
    end

    #: ((String | Pathname)) -> Pathname
    def self.coerce(path)
      path.is_a?(Pathname) ? path : Pathname.new(path)
    end

    #: (String, ?project_path: (String | Pathname)?) -> SourcePath?
    def self.parse(string, project_path: nil)
      match = PATTERN.match(string.to_s)

      return nil unless match

      path = match[:path]

      return nil if path.nil? || path.empty?

      new(
        path,
        project_path: project_path,
        line: match[:line]&.to_i,
        column: reported_column(match[:column]),
        scheme: match[:scheme]
      )
    end

    #: (String?) -> Integer?
    def self.reported_column(column)
      return nil unless column

      [column.to_i - 1, 0].max
    end

    #: () -> Herb::Position?
    def position
      line = @line

      return nil unless line

      Position.new(line, column || 0)
    end

    #: () -> bool
    def position?
      !@line.nil?
    end

    #: ((String | Pathname)) -> SourcePath
    def with_path(path)
      self.class.new(path, project_path: project_path, line: line, column: column, scheme: scheme)
    end

    #: ((String | Pathname)?) -> SourcePath
    def with_project_path(project_path)
      self.class.new(path, project_path: project_path, line: line, column: column, scheme: scheme)
    end

    #: () -> bool
    def absolute?
      path.absolute?
    end

    #: () -> Pathname
    def absolute_path
      return path if path.absolute?

      project = project_path

      return path unless project

      project + path
    end

    #: () -> Pathname
    def relative_path
      project = project_path

      return path unless project

      absolute_path.relative_path_from(project)
    rescue ArgumentError
      path
    end

    #: () -> SourcePath
    def absolute
      with_path(absolute_path)
    end

    #: () -> SourcePath
    def relative
      with_path(relative_path)
    end

    #: (Herb::Position?) -> SourcePath
    def with_position(position)
      self.class.at(path, position, project_path: project_path, scheme: scheme)
    end

    #: (String?) -> SourcePath
    def with_scheme(scheme)
      self.class.new(path, project_path: project_path, line: line, column: column, scheme: scheme)
    end

    #: () -> String
    def to_s
      "#{prefix}#{written_path}#{suffix}"
    end

    #: () -> Pathname
    def to_pathname
      path
    end

    #: (untyped) -> bool
    def ==(other)
      other.is_a?(SourcePath) && to_s == other.to_s
    end

    alias eql? ==

    #: () -> Integer
    def hash
      to_s.hash
    end

    #: () -> String
    def inspect
      %(#<Herb::SourcePath #{self}>)
    end

    private

    #: () -> String
    def prefix
      scheme ? "#{scheme}#{FILE_SCHEME_SEPARATOR}" : ""
    end

    #: () -> String
    def written_path
      written = path.to_s

      return written unless scheme

      written.start_with?("/") ? written : "/#{written}"
    end

    #: () -> String
    def suffix
      return "" unless line

      column ? ":#{line}:#{column + 1}" : ":#{line}"
    end
  end
end
