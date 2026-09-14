# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      # The state values a render call hands the partial it renders.
      #
      # A caller's compile rewrites `render "card", state: { open: modal_open }` into a call
      # wrapped by `with`, so the values travel on a stack the partial's own state assignments
      # read through `StateOverrides.resolve`. Two tables ride on every frame. A bound value
      # aliases the partial's state to the caller's and wins over anything a client sent, since
      # the client cannot tell two render sites of one partial apart. A seeded value only sets
      # the partial's starting point, so a client that has since written the state wins over it.
      #
      # The stack lives in fiber storage, which a child fiber or thread inherits, so a render
      # that streams or captures still sees the frames its caller pushed.
      #
      module Bindings
        KEY = :herb_slots_bindings #: Symbol

        class UncoercibleSeedError < StandardError
        end

        #: (String, ?bound: Hash[String, untyped], ?seeded: Hash[String, untyped]) { () -> untyped } -> untyped
        def self.with(identifier, bound: {}, seeded: {})
          seeded.each { |name, value| check_seed(identifier, name, value) }

          stack = (Fiber[KEY] ||= []) #: Array[Hash[String, Hash[Symbol, Hash[String, untyped]]]]
          stack.push({ identifier => { bound: bound, seeded: seeded } })

          begin
            yield
          ensure
            stack.pop
          end
        end

        #: (String) -> Hash[Symbol, Hash[String, untyped]]?
        def self.current(identifier)
          stack = Fiber[KEY]

          return nil unless stack.is_a?(Array)

          stack.reverse_each do |frame|
            return frame[identifier] if frame.key?(identifier)
          end

          nil
        end

        #: (String, String, untyped) -> void
        def self.check_seed(identifier, name, value)
          return unless StateOverrides.coerce(value, :seeded) == :__herb_uncoercible

          raise UncoercibleSeedError, "`#{name}` on `#{identifier}` was seeded with #{value.class}, and a state holds a scalar. Pass the value as a local instead."
        end
      end
    end
  end
end
