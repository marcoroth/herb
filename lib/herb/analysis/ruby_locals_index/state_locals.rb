# frozen_string_literal: true

require_relative "../../engine/slots/state_directives"

module Herb
  module Analysis
    class RubyLocalsIndex
      # Finds `herb:state` declarations so a state read indexes like a local instead of an
      # unknown name.
      module StateLocals
        module_function

        def locals(document, references, offsets, declared)
          known = declared.to_h { |name, _location| [name, :seeded] }

          directives(document).flat_map { |node, signature|
            declarations_in(node, signature, known).map do |declaration|
              Local.new(declaration.name, node.location, usages(declaration.name, references, offsets))
            end
          }
        end

        def directives(document)
          found = [] #: Array[[untyped, String]]

          walk = lambda do |node|
            signature = Herb::Engine::Slots::StateDirectives.signature_of(node)

            found << [node, signature] if signature

            node.child_nodes.each { |child| walk.call(child) if child } if node.respond_to?(:child_nodes)
          end

          walk.call(document)

          found
        end

        def declarations_in(node, signature, known)
          Herb::Engine::Slots::StateDirectives.parse(signature, known, visitor: Herb::Engine::Slots::StateDirectives::Silent, node: node)
        end

        def usages(name, references, offsets)
          references.bare_calls
                    .select { |call| call.name == name || call.name == "#{name}?" }
                    .map { |call| offsets.location_for(call) }
        end
      end
    end
  end
end
