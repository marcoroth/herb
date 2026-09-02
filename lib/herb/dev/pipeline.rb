# frozen_string_literal: true
# typed: true

require_relative "classifier"
require_relative "protocol"

module Herb
  module Dev
    # Turns one watcher event into the messages the browsers need.
    #
    # The pipeline holds what it learned about every file so far. The version a file last
    # compiled to says whether an edit changed the template's shape, the slot entries feed
    # the remap, and the error state decides when a clean compile has to say so out loud.
    # Parse errors and compile diagnostics live in the same state machine, so a template
    # that stops compiling behaves exactly like one that stops parsing.
    #
    # The compiler is looked up per event. A host that registers one after the pipeline
    # started is picked up on the next change.
    #
    class Pipeline
      STATES = [:ok, :parse_error, :diagnostics].freeze #: Array[Symbol]

      Failure = Struct.new(:mode, :manifest, :version, :slot_entries, :statics, :static_markup, :diagnostics)

      #: (server: untyped, ?configuration: Herb::Configuration?, ?compiler: ^() -> Herb::Dev::_Compiler?) -> void
      def initialize(server:, configuration: nil, compiler: -> { Herb::Dev.compiler })
        @server = server
        @classifier = Classifier.new(configuration: configuration)
        @compiler = compiler
        @versions = {} #: Hash[String, String?]
        @slot_entries = {} #: Hash[String, Array[Hash[Symbol, untyped]]]
        @state_manifests = {} #: Hash[String, untyped]
        @statics = {} #: Hash[String, Hash[String, String]?]
        @file_state = {} #: Hash[String, Symbol]
        @on_classified = nil #: untyped
      end

      #: () { (untyped, Classifier::Classification?) -> void } -> void
      def on_classified(&block)
        @on_classified = block
      end

      #: () -> bool
      def compiles?
        !@compiler.call.nil?
      end

      #: (Watcher::Event) -> void
      def handle_event(event)
        case event.kind
        when :removed
          handle_removed(event)
        when :added
          handle_added(event)
        when :changed
          handle_changed(event)
        end
      end

      private

      #: (Watcher::Event) -> void
      def handle_removed(event)
        file = event.relative_path
        was_errored = @file_state[file] && @file_state[file] != :ok
        from = @versions[file]

        @versions.delete(file)
        @slot_entries.delete(file)
        @state_manifests.delete(file)
        @statics.delete(file)
        @file_state.delete(file)

        broadcast(Protocol.schema(file: file, mode: nil, from: from, to: nil)) if was_errored

        notify(event, nil)
      end

      #: (Watcher::Event) -> void
      def handle_added(event)
        notify(event, nil)
      end

      #: (Watcher::Event) -> void
      def handle_changed(event)
        file = event.relative_path
        classification = @classifier.call(event.previous.to_s, event.current.to_s)

        case classification.kind
        when :parse_error
          @file_state[file] = :parse_error

          broadcast(Protocol.error(file: file, source: event.current.to_s, errors: classification.errors))
        when :none, :whitespace
          nil
        else
          handle_content_change(event, classification)
        end

        notify(event, classification)
      end

      #: (Watcher::Event, Classifier::Classification) -> void
      def handle_content_change(event, classification)
        compiler = @compiler.call

        return handle_without_compiler(event, classification) unless compiler

        file = event.relative_path
        compiled = compile(compiler, event)

        return handle_without_compiler(event, classification) if compiled == :unsupported

        broadcast(schema_for(file, event, compiled, classification))
        broadcast(invalidate_for(file, classification, compiled))

        remember(file, compiled)
      end

      #: (Herb::Dev::_Compiler, Watcher::Event) -> untyped
      def compile(compiler, event)
        result = compiler.call(event.current.to_s, event.relative_path)

        result || :unsupported
      rescue StandardError => e
        failure(e)
      end

      #: (StandardError) -> untyped
      def failure(error)
        diagnostic = {
          message: "#{error.class}: #{error.message}",
          severity: :error,
          origin: "Herb Dev Server",
        }

        Failure.new(nil, nil, nil, nil, nil, nil, [diagnostic])
      end

      #: (String, Watcher::Event, untyped, Classifier::Classification) -> Hash[Symbol, untyped]
      def schema_for(file, event, compiled, classification)
        diagnostics = (compiled.diagnostics || []).map { |diagnostic|
          diagnostic.respond_to?(:to_h) ? diagnostic.to_h : diagnostic
        }

        Protocol.schema(
          file: file,
          mode: compiled.mode,
          from: @versions[file],
          to: compiled.version,
          manifest: compiled.manifest,
          static_markup: compiled.static_markup,
          statics: compiled.statics,
          changed_statics: changed_statics_for(file, compiled),
          remap: remap_for(file, compiled, classification),
          diagnostics: diagnostics,
          source: event.current
        )
      end

      #: (String, Classifier::Classification, untyped) -> Hash[Symbol, untyped]
      def invalidate_for(file, classification, compiled)
        Protocol.invalidate(
          file: file,
          version: compiled.version,
          node_path: classification.node_path,
          scope: scope_for(file, classification, compiled)
        )
      end

      #: (String, Classifier::Classification, untyped) -> Symbol
      def scope_for(file, classification, compiled)
        return :static if classification.kind == :static

        unchanged = compiled.version && compiled.version == @versions[file]

        return :state if unchanged && @state_manifests.key?(file) && @state_manifests[file] != states_of(compiled)

        :fetch
      end

      #: (untyped) -> untyped
      def states_of(compiled)
        manifest = compiled.manifest

        manifest.is_a?(Hash) ? manifest["states"] : nil
      end

      #: (String, untyped, Classifier::Classification) -> Hash[String, untyped]?
      def remap_for(file, compiled, classification)
        previous = @slot_entries[file]
        current = compiled.slot_entries

        return nil unless previous && current
        return { "slots" => current.to_h { |entry| [entry[:index].to_s, entry[:index]] } } if compiled.version == @versions[file]

        Protocol.remap(previous, current, classification.operations)
      end

      #: (String, untyped) -> Array[String]?
      def changed_statics_for(file, compiled)
        previous = @statics[file]
        current = compiled.statics

        return nil unless previous && current

        current.keys.reject { |key| previous[key] == current[key] }
      end

      #: (String, untyped) -> void
      def remember(file, compiled)
        @versions[file] = compiled.version
        @slot_entries[file] = compiled.slot_entries
        @state_manifests[file] = states_of(compiled)
        @statics[file] = compiled.statics
        @file_state[file] = (compiled.diagnostics || []).empty? ? :ok : :diagnostics
      end

      #: (Watcher::Event, Classifier::Classification) -> void
      def handle_without_compiler(event, classification)
        file = event.relative_path

        if @file_state[file] == :parse_error
          broadcast(Protocol.schema(file: file, mode: nil, from: nil, to: nil))
        end

        @file_state[file] = :ok

        message = Protocol.invalidate(
          file: file,
          version: nil,
          node_path: classification.node_path,
          scope: classification.kind == :static ? :static : :fetch
        )

        broadcast(message)
      end

      #: (Hash[Symbol, untyped]) -> void
      def broadcast(message)
        @server.broadcast(message, to: :browsers)
      end

      #: (Watcher::Event, Classifier::Classification?) -> void
      def notify(event, classification)
        @on_classified&.call(event, classification)
      end
    end
  end
end
