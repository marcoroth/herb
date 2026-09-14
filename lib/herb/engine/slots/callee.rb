# frozen_string_literal: true
# typed: true

require "pathname"

module Herb
  class Engine
    module Slots
      # The state interface of a partial, read at a caller's compile.
      #
      # A render that binds states names the partial by its literal path, so the caller can
      # open that file, compile it with a throwaway visitor and learn which region states it
      # declares and of what kind. That is what lets a binding to a state the partial never
      # declared, or of the wrong kind, fail the caller's compile instead of a render.
      #
      # Lookups are memoized by path and modification time. A partial that renders a caller
      # that renders it again would compile forever, so a path already being read answers nil
      # and the caller skips the interface check for that one render.
      #
      class Callee
        Declared = Data.define(
          :name,    #: String
          :kind,    #: Symbol
          :derived, #: bool
          :counted  #: bool
        )

        COMPILING = :herb_slots_callee_compiling #: Symbol
        CACHE_LIMIT = 256 #: Integer

        @cache = {} #: Hash[[String, Float], Callee?]
        @lock = Mutex.new #: Mutex

        #: (Pathname | String) -> Callee?
        def self.for(path)
          pathname = path.is_a?(Pathname) ? path : Pathname.new(path)

          return nil unless pathname.file?

          key = [pathname.to_s, pathname.mtime.to_f] #: [String, Float]

          @lock.synchronize do
            return @cache.fetch(key) if @cache.key?(key)
          end

          compiling = (Fiber[COMPILING] ||= []) #: Array[String]

          return nil if compiling.include?(pathname.to_s)

          compiling.push(pathname.to_s)

          callee = begin
            new(pathname)
          rescue StandardError
            nil
          ensure
            compiling.pop
          end

          @lock.synchronize do
            @cache.clear if @cache.size >= CACHE_LIMIT
            @cache[key] = callee
          end

          callee
        end

        #: () -> void
        def self.reset!
          @lock.synchronize { @cache.clear }
        end

        attr_reader :path #: Pathname
        attr_reader :diagnostics #: Array[Herb::Diagnostic]

        #: (Pathname) -> void
        def initialize(path)
          @path = path
          @declared = {} #: Hash[String, Declared]

          visitor = Visitor.new(mode: :client, mark: false, fatal: false, deliver: :none)

          Herb::Engine.new(path.read, visitors: [visitor], filename: path.to_s)

          @diagnostics = visitor.diagnostics

          visitor.state_entries.each do |entry|
            next unless entry[:scope] == :region

            name = entry[:name].to_s

            @declared[name] = Declared.new(
              name: name,
              kind: entry[:kind],
              derived: !entry[:derived].nil?,
              counted: visitor.counted_state?(name)
            )
          end
        end

        #: (String) -> Declared?
        def declaration(name)
          @declared[name]
        end

        #: () -> Array[String]
        def names
          @declared.keys
        end

        #: () -> Array[Herb::Diagnostic]
        def errors
          @diagnostics.select(&:error?)
        end
      end
    end
  end
end
