# frozen_string_literal: true
# typed: true

require "prism"

module Herb
  # Answers what Ruby a span of a template holds, out of the one Prism program the parser built
  # for the whole document. `extract_ruby` blanks the HTML in place, so a Prism byte offset and a
  # template byte offset are the same number, which is what lets a `Herb::Location` address Ruby.
  #
  #     program = Herb::RubyProgram.for(document)
  #     program.resolve(node.content.location)&.nodes #=> [#<Prism::CallNode>]
  #
  # The document has to have been parsed with the `prism_program` parser option, and `for` answers
  # `nil` when it was not. `Herb::Locate` is the same question asked of the HTML tree, and
  # `Herb::Analysis::RubyLocalsIndex::OffsetTable` walks the other way, from a Prism offset back
  # to a `Herb::Location`.
  #
  class RubyProgram
    Resolved = Data.define(
      :nodes,  #: Array[untyped]
      :offset, #: Integer
      :source  #: String
    )

    #: (untyped) -> RubyProgram?
    def self.for(document)
      return nil unless document.respond_to?(:source) && document.respond_to?(:deserialized_prism_node)

      source = document.source
      program = document.deserialized_prism_node

      return nil unless source.is_a?(String) && program

      new(source, program)
    end

    #: (String, untyped) -> void
    def initialize(source, program)
      @source = source
      @lines = source.lines
      @starts = [0] #: Array[Integer]

      @lines.each { |line| @starts << (@starts.fetch(-1) + line.bytesize) }

      @nodes = flatten(program)
    end

    #: (Herb::Location?) -> Resolved?
    def resolve(location)
      return nil unless location

      from = offset_of(location.start)
      to = offset_of(location.end)

      return nil unless from && to && from < to

      Resolved.new(nodes: enclosed(from, to), offset: from, source: @source.byteslice(from, to - from).to_s)
    end

    private

    #: (untyped) -> Array[untyped]
    def flatten(program)
      found = [] #: Array[untyped]
      queue = [program] #: Array[untyped]

      until queue.empty?
        node = queue.shift

        found << node unless node.is_a?(Prism::StatementsNode) || node.is_a?(Prism::ProgramNode)
        queue.concat(node.compact_child_nodes)
      end

      found.sort_by { |node| [node.location.start_offset, -node.location.end_offset] }
    end

    #: (Integer, Integer) -> Array[untyped]
    def enclosed(from, to)
      found = [] #: Array[untyped]
      index = @nodes.bsearch_index { |node| node.location.start_offset >= from } || @nodes.length
      reach = from

      while (node = @nodes[index])
        location = node.location

        break if location.start_offset >= to

        if location.start_offset >= reach && location.end_offset <= to
          found << node
          reach = location.end_offset
        end

        index += 1
      end

      found
    end

    #: (untyped) -> Integer?
    def offset_of(position)
      start = @starts[position.line - 1]
      line = @lines[position.line - 1]

      return nil unless start && line

      start + line[0, position.column].to_s.bytesize
    end
  end
end
