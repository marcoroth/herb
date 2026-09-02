# frozen_string_literal: true
# typed: true

require_relative "../configuration"

module Herb
  module Dev
    # Watches a project's templates and says which one changed.
    #
    # Cruise reports raw filesystem events, and most of them are noise. This keeps the last
    # content it saw for every template, filters events through the project's include and
    # exclude patterns, and emits one normalized event per change that actually changed
    # something, carrying both the previous and the current source so nothing downstream has
    # to read the file again.
    #
    #     watcher = Herb::Dev::Watcher.new(config: config, root: root) do |event|
    #       pipeline.handle_event(event)
    #     end
    #
    #     watcher.run    # blocks, for the CLI
    #     watcher.spawn  # returns a Thread, for an embedded host
    #
    class Watcher
      KINDS = ["created", "modified", "removed"].freeze #: Array[String]

      Event = Data.define(
        :kind,          #: Symbol
        :path,          #: String
        :relative_path, #: String
        :previous,      #: String?
        :current        #: String?
      )

      attr_reader :file_states #: Hash[String, String]
      attr_reader :watch_paths #: Array[String]

      #: (config: Herb::Configuration, root: String, ?watch_paths: Array[String]?) { (Event) -> void } -> void
      def initialize(config:, root:, watch_paths: nil, &on_event)
        @config = config
        @root = root
        @on_event = on_event
        @watch_paths = resolve_watch_paths(watch_paths) #: Array[String]
        @file_states = {} #: Hash[String, String]
        @include_patterns = config.file_include_patterns
        @exclude_patterns = config.file_exclude_patterns
        @thread = nil #: Thread?
        @stopped = false
      end

      #: (?String) -> Integer
      def index(path = @root)
        @config.find_files(path).each do |file_path|
          @file_states[file_path] = File.read(file_path)
        rescue StandardError
          nil
        end

        @file_states.size
      end

      #: () -> void
      def run
        Herb.ensure_installed("cruise")

        Cruise.watch(*@watch_paths, only: KINDS) do |raw|
          break if @stopped

          handle(raw)
        end
      end

      #: () -> Thread
      def spawn
        @thread = Thread.new { run }
        @thread.name = "herb-dev-watcher"

        @thread
      end

      #: () -> void
      def stop
        @stopped = true
        @thread&.kill
        @thread = nil
      end

      private

      #: (Array[String]?) -> Array[String]
      def resolve_watch_paths(paths)
        return [@root] if paths.nil?

        candidates = Array(paths).filter_map do |path|
          expanded = File.expand_path(path.to_s, @root)

          next unless File.directory?(expanded)
          next unless expanded == @root || expanded.start_with?("#{@root}/")

          expanded
        end.uniq.sort

        return [@root] if candidates.empty?
        return [@root] if candidates.include?(@root)

        candidates.reject do |path|
          candidates.any? { |other| other != path && path.start_with?("#{other}/") }
        end
      end

      #: (Cruise::Event) -> void
      def handle(raw)
        path = raw.path
        relative_path = path.delete_prefix("#{@root}/")

        return if @config.path_excluded?(relative_path, @exclude_patterns)
        return unless @config.path_included?(relative_path, @include_patterns)

        event = normalize(raw.kind, path, relative_path)

        @on_event.call(event) if event
      end

      #: (String, String, String) -> Event?
      def normalize(kind, path, relative_path)
        if kind == "removed"
          previous = @file_states.delete(path)

          return Event.new(kind: :removed, path: path, relative_path: relative_path, previous: previous, current: nil)
        end

        return nil unless File.exist?(path)

        current = File.read(path)
        previous = @file_states[path]
        @file_states[path] = current

        return Event.new(kind: :added, path: path, relative_path: relative_path, previous: nil, current: current) if previous.nil?
        return nil if previous == current

        Event.new(kind: :changed, path: path, relative_path: relative_path, previous: previous, current: current)
      rescue StandardError
        nil
      end
    end
  end
end
