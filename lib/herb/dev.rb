# frozen_string_literal: true
# typed: true

require_relative "dev/watcher"
require_relative "dev/classifier"
require_relative "dev/protocol"
require_relative "dev/pipeline"
require_relative "dev/embedded"

module Herb
  # The development server: a file watcher, a websocket, and the pipeline between them.
  #
  # The dev server never compiles a template itself, because slot identity depends on the
  # visitor stack the application compiles with, and only the application knows that stack.
  # A host that does know it registers a compiler here:
  #
  #     Herb::Dev.compiler = ->(source, relative_path) { ... }
  #
  # The compiler returns nil for a file it cannot compile at all, and otherwise an object
  # answering `mode`, `manifest`, `version`, `slot_entries`, `statics`, `static_markup` and
  # `diagnostics`. Without one, the pipeline still classifies changes and tells browsers to
  # fetch, so everything degrades instead of breaking.
  #
  module Dev
    # @rbs!
    #   interface _Compiler
    #     def call: (String source, String relative_path) -> _CompiledSchema?
    #   end
    #
    #   interface _CompiledSchema
    #     def mode: () -> Symbol?
    #     def manifest: () -> Hash[String, untyped]?
    #     def version: () -> String?
    #     def slot_entries: () -> Array[Hash[Symbol, untyped]]?
    #     def statics: () -> Hash[String, String]?
    #     def static_markup: () -> String?
    #     def diagnostics: () -> Array[untyped]?
    #   end

    class << self
      # @rbs skip
      attr_accessor :compiler
    end

    # @rbs!
    #   attr_accessor self.compiler: _Compiler?

    # Starts the watcher and the websocket server inside the current process, for a host
    # that already runs the application, like a Rails server in development. Everything a
    # start would collide with makes it a no-op instead of an error, so a host can call it
    # unconditionally:
    #
    #     Rails.application.server { Herb::Dev.boot(Rails.root.to_s) }
    #
    #: (String, ?watch_paths: Array[String]?, ?environment: String?, ?logger: ^(String) -> void) -> Embedded?
    def self.boot(root, watch_paths: nil, environment: nil, logger: ->(message) { warn(message) })
      environment ||= ENV["RAILS_ENV"] || ENV["RACK_ENV"] || "development"

      return nil unless environment == "development"

      current = booted

      return current if current && current.pid == Process.pid

      require_relative "dev/server"

      begin
        Herb.ensure_installed("cruise")
      rescue StandardError
        logger.call("Herb dev server not started. The 'cruise' gem is required, add it to the Gemfile.")

        return nil
      end

      expanded = File.realpath(File.expand_path(root))
      existing = ServerEntry.find_by_project(expanded)

      if existing
        holder = existing.embedded? ? "inside another server for this app" : "as a standalone `herb dev`"

        logger.call("Herb dev server already running for this project #{holder} (PID: #{existing.pid}, port: #{existing.port}). Stop that process, then restart this server.")

        return nil
      end

      port = Server.find_available_port

      unless port
        logger.call("Herb dev server not started. No available ports found.")

        return nil
      end

      configuration = Herb::Configuration.load(expanded)
      server = Server.new(port: port, project_path: expanded, kind: "embedded")
      pipeline = Pipeline.new(server: server, configuration: configuration)

      server.on_client do |event, count|
        logger.call("Herb dev server client #{event} (#{count} #{count == 1 ? "connection" : "connections"} open)")
      end

      pipeline.on_classified do |event, classification|
        line = activity_line(event, classification)

        logger.call(line) if line
      end

      watcher = Watcher.new(config: configuration, root: expanded, watch_paths: watch_paths) do |event|
        pipeline.handle_event(event)
      end

      watcher.index
      server.start
      watcher.spawn

      @booted = Embedded.new(server, watcher, pipeline, Process.pid)

      at_exit { shutdown }

      watching = watcher.watch_paths.map { |path| path == expanded ? path : path.delete_prefix("#{expanded}/") }.join(", ")

      logger.call("Herb dev server watching #{watching} on ws://localhost:#{port}")

      @booted
    end

    #: (Watcher::Event, Classifier::Classification?) -> String?
    def self.activity_line(event, classification)
      file = event.relative_path

      case event.kind
      when :removed then "#{file} removed"
      when :added then "#{file} added"
      else
        return nil unless classification

        case classification.kind
        when :parse_error
          "#{file} has #{classification.errors.length} parse error#{"s" unless classification.errors.length == 1}"
        when :static, :dynamic
          "#{file} changed (#{classification.kind}, #{classification.operations.length} operation#{"s" unless classification.operations.length == 1})"
        end
      end
    end

    #: () -> Embedded?
    def self.booted
      @booted = nil if @booted && @booted.pid != Process.pid

      @booted
    end

    #: () -> void
    def self.shutdown
      booted&.stop

      @booted = nil
    end
  end
end
