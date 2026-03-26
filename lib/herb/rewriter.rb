# frozen_string_literal: true
# rbs_inline: enabled

module Herb
  class Rewriter < Visitor
    include AST::NodeBuilder

    #: () -> void
    def initialize
      super

      #: Hash[Herb::AST::Node, Herb::AST::Node]
      @replacements = {}.compare_by_identity
      @in_attribute = false #: bool
      @in_html_comment = false #: bool
    end

    #: () -> String
    def self.transformer_name
      raise NotImplementedError, "#{name} must implement .transformer_name"
    end

    #: () -> Array[String]
    def self.matches
      []
    end

    #: () -> String
    def self.description
      ""
    end

    #: (Herb::AST::Node, Herb::Rewriter::MatchContext) -> Herb::AST::Node?
    def transform(_erb_node, _match_context)
      nil
    end

    #: (Herb::AST::DocumentNode) -> void
    def visit_document_node(node)
      super
      apply_pending_replacements(node) if @replacements.any?
    end

    #: (Herb::AST::HTMLAttributeNode) -> void
    def visit_html_attribute_node(node)
      @in_attribute = true
      super
      @in_attribute = false
    end

    #: (Herb::AST::HTMLCommentNode) -> void
    def visit_html_comment_node(node)
      @in_html_comment = true
      super
      @in_html_comment = false
    end

    #: (Herb::AST::ERBContentNode) -> void
    def visit_erb_content_node(node)
      return super unless self.class.matches.any?

      prism_node = node.deserialized_prism_node
      return super unless prism_node.is_a?(Prism::CallNode)

      method_name = prism_node.name.to_s
      return super unless self.class.matches.include?(method_name)

      context = MatchContext.new(
        erb_node: node,
        prism_node: prism_node,
        method_name: method_name
      )

      result = transform(node, context)
      @replacements[node] = result if result

      super
    end

    #: (Herb::AST::ERBBlockNode) -> void
    def visit_erb_block_node(node)
      return super unless self.class.matches.any?

      prism_node = node.deserialized_prism_node
      return super unless prism_node.is_a?(Prism::CallNode)

      method_name = prism_node.name.to_s
      return super unless self.class.matches.include?(method_name)

      context = MatchContext.new(
        erb_node: node,
        prism_node: prism_node,
        method_name: method_name,
        body: node.body || []
      )

      result = transform(node, context)
      @replacements[node] = result if result

      super
    end

    private

    #: (Herb::AST::Node) -> void
    def apply_pending_replacements(node)
      node.child_nodes.each do |child|
        next unless child

        replacement = @replacements.delete(child)

        if replacement
          replace_child(node, child, replacement)
        else
          apply_pending_replacements(child)
        end
      end
    end

    #: (Herb::AST::Node, Herb::AST::Node, Herb::AST::Node) -> void
    def replace_child(parent, old_child, new_child)
      parent.class.instance_methods(false).each do |method|
        next unless method.to_s.end_with?("=")

        field_name = method.to_s.chomp("=").to_sym
        next unless parent.respond_to?(field_name)

        value = parent.send(field_name)

        if value.is_a?(Array)
          index = value.index(old_child)
          value[index] = new_child if index
        elsif value.equal?(old_child)
          parent.send(method, new_child)
        end
      end
    end
  end
end
