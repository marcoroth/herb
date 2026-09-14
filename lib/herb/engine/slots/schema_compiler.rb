# frozen_string_literal: true
# typed: true

require_relative "../../../herb"
require_relative "../../engine"
require_relative "visitor"

module Herb
  class Engine
    module Slots
      # Compiles a template into what a browser needs to know about its slots, without
      # rendering anything.
      #
      # Slot identity depends on every visitor that runs before the slot visitor, and only
      # the host knows its stack, so the host hands one over and this runs it. The stack
      # arrives as a builder returning fresh visitors, because a visitor is stateful and the
      # statics need a second compile:
      #
      #     result = Herb::Engine::Slots::SchemaCompiler.call(
      #       source,
      #       filename: "app/views/posts/index.html.erb",
      #       mode: :client,
      #       visitors: -> { [Herb::Engine::Validators::SecurityValidator.new(fatal: false)] }
      #     )
      #
      #     result.version        #=> "5d1e0c77"
      #     result.manifest       #=> what the page's manifest says
      #     result.static_markup  #=> the markup with every slot as an empty marker pair
      #
      # A nil `mode` means slots are off for this template. The stack still runs so its
      # diagnostics still flow, and everything slot-shaped comes back nil.
      #
      class SchemaCompiler
        Result = Data.define(
          :mode,          #: Symbol?
          :manifest,      #: Hash[String, untyped]?
          :version,       #: String?
          :slot_entries,  #: Array[Hash[Symbol, untyped]]?
          :statics,       #: Hash[String, String]?
          :static_markup, #: String?
          :diagnostics    #: Array[Herb::Diagnostic]
        )

        #: (String, filename: String, mode: Symbol?, ?visitors: ^() -> Array[::Herb::Visitor], ?engine: singleton(::Herb::Engine), ?options: Hash[Symbol, untyped]) -> Result
        def self.call(source, filename:, mode:, visitors: -> { [] }, engine: Herb::Engine, options: {})
          unless mode
            stack = visitors.call

            compile(engine, source, filename, stack, options)

            return Result.new(
              mode: nil,
              manifest: nil,
              version: nil,
              slot_entries: nil,
              statics: nil,
              static_markup: nil,
              diagnostics: collect(stack)
            )
          end

          slot_visitor = Visitor.new(mode: mode, mark: false, deliver: :none, fatal: false)
          stack = visitors.call + [slot_visitor]

          compile(engine, source, filename, stack, options)

          marking = Visitor.new(mode: mode, mark: true, deliver: :none, fatal: false, static_markup: true)

          compile(engine, source, filename, visitors.call + [marking], options)

          Result.new(
            mode: mode,
            manifest: slot_visitor.manifest,
            version: slot_visitor.version,
            slot_entries: slot_visitor.slot_entries,
            statics: marking.statics,
            static_markup: marking.static_markup,
            diagnostics: collect(stack)
          )
        end

        #: (singleton(::Herb::Engine), String, String, Array[::Herb::Visitor], Hash[Symbol, untyped]) -> void
        def self.compile(engine, source, filename, stack, options)
          engine.new(source, options.merge(filename: filename, visitors: stack))
        end

        #: (Array[::Herb::Visitor]) -> Array[Herb::Diagnostic]
        def self.collect(stack)
          stack.flat_map { |visitor| visitor.is_a?(Herb::Visitor::Diagnostics) ? visitor.diagnostics : [] }
        end
      end
    end
  end
end
