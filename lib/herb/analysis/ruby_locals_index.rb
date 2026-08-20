# frozen_string_literal: true

require "prism"

require_relative "ruby_locals_index/local"
require_relative "ruby_locals_index/named_reference"
require_relative "ruby_locals_index/offset_table"
require_relative "ruby_locals_index/reference_collector"

module Herb
  module Analysis
    class RubyLocalsIndex
      KEYWORD_KIND = "keyword" #: String

      attr_reader :locals #: Array[Local]
      attr_reader :assignment_names #: Set[String]

      #: (String) -> RubyLocalsIndex
      def self.from_source(source)
        document = ::Herb.parse(source, prism_program: true, strict_locals: true).value

        from_document(document, source)
      end

      #: (Herb::AST::DocumentNode, String) -> RubyLocalsIndex
      def self.from_document(document, source)
        program = document.deserialized_prism_node

        return new([]) unless program

        offsets = OffsetTable.new(source)
        references = ReferenceCollector.new(program)

        new(
          strict_locals(document, references, offsets) + block_locals(document, references, offsets),
          references.assignments.to_set(&:name)
        )
      end

      #: (Array[Local], ?Set[String]) -> void
      def initialize(locals, assignment_names = Set.new)
        @locals = locals
        @assignment_names = assignment_names
      end

      #: (Integer, Integer) -> Local?
      def at(line, column)
        candidates = @locals.select do |local|
          local.locations.any? { |location| self.class.covers?(location, line, column) }
        end

        candidates.min do |a, b|
          self.class.encloses?(b.declaration, a.declaration) ? -1 : 1
        end
      end

      #: (String) -> Local?
      def find(name)
        @locals.find { |local| local.name == name }
      end

      #: () -> Set[String]
      def names
        @locals.to_set(&:name)
      end

      #: (Herb::Location, Integer, Integer) -> bool
      def self.covers?(location, line, column)
        return false if line < location.start.line || line > location.end.line
        return false if line == location.start.line && column < location.start.column
        return false if line == location.end.line && column > location.end.column

        true
      end

      #: (Herb::Location, Herb::Location) -> bool
      def self.encloses?(outer, inner)
        covers?(outer, inner.start.line, inner.start.column) && covers?(outer, inner.end.line, inner.end.column)
      end

      #: (Herb::AST::DocumentNode, ReferenceCollector, OffsetTable) -> Array[Local]
      def self.strict_locals(document, references, offsets)
        declarations(document).map do |name, location|
          usages = references.bare_calls.select { |call| call.name == name }.map { |call| offsets.location_for(call) }

          Local.new(name, location, usages)
        end
      end

      #: (Herb::AST::DocumentNode) -> Array[[String, Herb::Location]]
      def self.declarations(document)
        document.children.flat_map do |child|
          next [] unless child.is_a?(AST::ERBStrictLocalsNode)

          child.locals.to_a.filter_map { |local| declaration_for(local) }
        end
      end

      #: (Herb::AST::Node) -> [String, Herb::Location]?
      def self.declaration_for(local)
        return nil unless local.is_a?(AST::RubyParameterNode)
        return nil unless local.kind == KEYWORD_KIND

        name = local.name&.value
        start = local.name&.location&.start

        return nil unless name && start

        [name, Location.from(start.line, start.column, start.line, start.column + name.length)]
      end

      #: (Herb::AST::DocumentNode, ReferenceCollector, OffsetTable) -> Array[Local]
      def self.block_locals(document, references, offsets)
        blocks = block_locations(document)

        (references.parameters + references.assignments).map do |reference|
          location = offsets.location_for(reference)
          scope = innermost_enclosing(blocks, location)

          Local.new(reference.name, location, reads_in_scope(reference, references, offsets, scope))
        end
      end

      #: (NamedReference, ReferenceCollector, OffsetTable, Herb::Location?) -> Array[Herb::Location]
      def self.reads_in_scope(reference, references, offsets, scope)
        references
          .local_reads
          .select { |read| read.name == reference.name }
          .map { |read| offsets.location_for(read) }
          .select { |usage| scope.nil? || encloses?(scope, usage) }
      end

      #: (Herb::AST::DocumentNode) -> Array[Herb::Location]
      def self.block_locations(document)
        found = [] #: Array[Herb::Location]

        walk = lambda do |node|
          found << node.location if block_node?(node) && node.location

          node.compact_child_nodes.each { |child| walk.call(child) }
        end

        walk.call(document)

        found
      end

      #: (Herb::AST::Node) -> bool
      def self.block_node?(node)
        node.is_a?(AST::ERBBlockNode) || node.is_a?(AST::ERBIterationBlockNode)
      end

      #: (Array[Herb::Location], Herb::Location) -> Herb::Location?
      def self.innermost_enclosing(locations, inner)
        locations.select { |location| encloses?(location, inner) }.min { |a, b| encloses?(b, a) ? -1 : 1 }
      end

      private_class_method :strict_locals, :declarations, :declaration_for, :block_locals, :reads_in_scope, :block_locations, :block_node?, :innermost_enclosing
    end
  end
end
