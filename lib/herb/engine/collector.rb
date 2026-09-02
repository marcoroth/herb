# frozen_string_literal: true

require "pathname"

module Herb
  class Engine
    # What a set of templates says about itself, gathered without rendering any of them.
    #
    # Compiling a template settles things a host wants to know before a request arrives. A
    # collector compiles files for that and nothing else, and a subclass says what to keep from
    # each one. Which files to give it, and where what it gathers goes, is the job of whatever
    # integrates Herb with a framework.
    #
    # A file that will not compile is recorded in #failures and the run carries on, so one broken
    # template does not cost a host the rest of them.
    #
    class Collector
      Failure = Data.define(:file, :error)

      attr_reader :failures #: Array[Failure]

      #: (?project_path: (String | Pathname)?, **untyped) -> void
      def initialize(project_path: nil, **options)
        @project_path = Pathname.new(project_path || Dir.pwd).expand_path
        @options = options
        @failures = [] #: Array[Failure]
      end

      #: ((String | Pathname), ?String?) -> untyped
      def add(file, source = nil)
        raise NotImplementedError, "#{self.class} has to say what it keeps from a compiled template"
      end

      #: ((String | Pathname), ?String) -> Array[untyped]
      def add_all(root, glob = "**/*.html.erb")
        Pathname.glob(Pathname.new(root).expand_path.join(glob).to_s).sort.filter_map { |file| add(file) }
      end

      private

      #: [T] ((String | Pathname), String?, untyped) { (untyped) -> T? } -> T?
      def compile(file, source, visitor)
        Engine.new(source || File.read(file), **engine_options(file, visitor))

        yield visitor
      rescue StandardError => e
        @failures << Failure.new(file: file.to_s, error: e)

        nil
      end

      #: ((String | Pathname), untyped) -> Hash[Symbol, untyped]
      def engine_options(file, visitor)
        @options.merge(
          filename: Pathname.new(file).expand_path.to_s,
          project_path: @project_path.to_s,
          visitors: [*@options[:visitors], visitor]
        )
      end
    end
  end
end
