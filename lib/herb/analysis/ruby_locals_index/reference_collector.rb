# frozen_string_literal: true

require "prism"

require_relative "named_reference"

module Herb
  module Analysis
    class RubyLocalsIndex
      class ReferenceCollector
        attr_reader :local_reads #: Array[NamedReference]
        attr_reader :bare_calls #: Array[NamedReference]
        attr_reader :parameters #: Array[NamedReference]
        attr_reader :assignments #: Array[NamedReference]

        #: (Prism::Node) -> void
        def initialize(program)
          @local_reads = []
          @bare_calls = []
          @parameters = []
          @assignments = []

          walk(program)
        end

        private

        #: (Prism::Node) -> void
        def walk(node)
          record(node)

          node.compact_child_nodes.each { |child| walk(child) }
        end

        #: (Prism::Node) -> void
        def record(node)
          record_read(node)
          record_binding(node)
        end

        #: (Prism::Node) -> void
        def record_read(node)
          case node
          when Prism::LocalVariableReadNode
            add(@local_reads, node.name, node.location)
          when Prism::CallNode
            add(@bare_calls, node.name, node.message_loc) if bare_call?(node)
          end
        end

        #: (Prism::Node) -> void
        def record_binding(node)
          case node
          when Prism::RequiredParameterNode
            add(@parameters, node.name, node.location)
          when Prism::OptionalParameterNode, Prism::BlockParameterNode, Prism::RestParameterNode
            add(@parameters, node.name, node.name_loc)
          when Prism::LocalVariableTargetNode
            add(@assignments, node.name, node.location)
          when Prism::LocalVariableWriteNode, Prism::LocalVariableAndWriteNode,
               Prism::LocalVariableOrWriteNode, Prism::LocalVariableOperatorWriteNode
            add(@assignments, node.name, node.name_loc)
          end
        end

        #: (Prism::CallNode) -> bool
        def bare_call?(node)
          node.receiver.nil? && node.arguments.nil? && node.block.nil? && !node.name.to_s.end_with?("=")
        end

        #: (Array[NamedReference], Symbol?, Prism::Location?) -> void
        def add(references, name, location)
          return unless name && location

          references << NamedReference.new(name.to_s, location.start_offset, location.length)
        end
      end
    end
  end
end
