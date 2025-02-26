# frozen_string_literal: true

module ERBX
  class Node
    attr_reader :type, :children, :start, :end

    def initialize(type, children = [], start = nil, end_loc = nil)
      @type = type
      @children = children
      @start = start
      @end = end_loc
    end

    def to_hash
      {
        type: type,
        type_name: type_name,
        children: children.map(&:to_hash),
        start: start&.to_hash,
        end: self.end&.to_hash
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end
  end
end
