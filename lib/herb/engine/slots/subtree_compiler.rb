# frozen_string_literal: true
# typed: false

require_relative "../../../herb"
require_relative "../../engine"

module Herb
  class Engine
    module Slots
      # Compiles a template into Ruby that renders one part of it rather than all of it.
      #
      # Re-rendering a region means running the template again and keeping only the piece that
      # changed. The piece cannot be compiled on its own, because what it renders depends on
      # everything the template did before reaching it:
      #
      #     require "herb/engine/slots/subtree_compiler"
      #
      #     source = Herb::Engine::Slots::SubtreeCompiler.new(template, node_path: [0, 1]).src
      #     view.instance_eval(source)
      #     #=> "<ul><li>Marco</li></ul>"
      #
      # ## Everything runs, only the target is kept
      #
      # A local assigned earlier, a helper called for its side effect, the loop the target sits
      # inside: all of it has to run for the target to render the same as it would have. So nothing
      # is skipped. What changes is where the output goes.
      #
      # The engine writes every append through one buffer variable, so the target's output is
      # collected by pointing that variable at the buffer being returned while the target renders and
      # at a sink the rest of the time. Escaping, blocks, and control flow then need no special
      # handling, because none of them know which buffer they are writing to.
      #
      # Pruning the work that only fed discarded output is a separate question, and answering it
      # needs to know which expressions the target actually depends on. Running everything is the
      # answer that is correct without that analysis.
      #
      # ## Addressing
      #
      # The target is named by `node_path`, the same path `Visitor` records for a slot and
      # `Herb::ActionView::TemplateDependencies` reports for a node, so a caller that has one from
      # either has one that works here.
      #
      # The path indexes a document's children, an element's body, and the bodies of the ERB nodes
      # that branch or repeat. It does not descend into an open tag, so an attribute is not
      # addressable, and the body of an `else` or a `when` is indexed as part of the node it hangs
      # off rather than on its own. Both match `Visitor`, and both are worth changing in the two
      # places at once rather than in either alone.
      #
      class SubtreeCompiler < Herb::Engine
        BUFFER = "__herb_subtree" #: String
        SINK = "__herb_sink" #: String

        INDEXED_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]

        class TargetNotFound < Herb::Engine::CompilationError
          #: (Array[Integer]) -> void
          def initialize(node_path)
            super("No node at node_path #{node_path.inspect}")
          end
        end

        class Compiler < Herb::Engine::Compiler
          #: (untyped, ?Hash[Symbol, untyped]) -> void
          def initialize(engine, options = {})
            super

            @target = options[:node_path]
            @path = [] #: Array[Integer]
            @found = false

            indexed = {} #: Hash[untyped, bool]
            @indexed = indexed.compare_by_identity
          end

          #: () -> bool
          def found?
            @found
          end

          #: (untyped) -> void
          def visit_document_node(node)
            return indexing(node.children) { super } unless @target.empty?

            @found = true

            @tokens << [:subtree, "", nil, :enter]
            indexing(node.children) { super }
            @tokens << [:subtree, "", nil, :leave]
          end

          #: (untyped) -> void
          def visit_html_element_node(node)
            indexing(node.body) { super }
          end

          #: (untyped) -> void
          def visit_html_conditional_element_node(node)
            indexing(node.body) { super }
          end

          #: (untyped) -> void
          def visit_erb_if_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_unless_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_case_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_block_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_iteration_block_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_while_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_until_node(node)
            branching(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_for_node(node)
            branching(node) { super }
          end

          #: (Array[untyped]) -> void
          def visit_all(nodes)
            return super unless @indexed.key?(nodes)

            nodes.each_with_index do |child, index|
              @path.push(index)

              if @path == @target
                @found = true

                @tokens << [:subtree, "", nil, :enter]
                visit(child)
                @tokens << [:subtree, "", nil, :leave]
              else
                visit(child)
              end

              @path.pop
            end
          end

          #: () -> void
          def generate_output
            optimize_tokens(@tokens).each do |type, value, context, escaped|
              case type
              when :text then @engine.send(:add_text, value)
              when :code then @engine.send(:add_code, value)
              when :subtree then @engine.send(:add_subtree_boundary, escaped)
              when :expr, :expr_escaped
                indicator = indicator_for(type)

                if context_aware_context?(context)
                  @engine.send(:add_context_aware_expression, indicator, value, context)
                else
                  @engine.send(:add_expression, indicator, value)
                end
              when :expr_block, :expr_block_escaped
                @engine.send(:add_expression_block, indicator_for(type), value)
              when :expr_block_end
                @engine.send(:add_expression_block_end, value, escaped: escaped)
              end
            end
          end

          private

          #: (*untyped) { () -> void } -> void
          def indexing(*arrays)
            marked = arrays.select { |array| array.is_a?(Array) }
            marked.each { |array| @indexed[array] = true }

            yield
          end

          #: (untyped) { () -> void } -> void
          def branching(node, &)
            arrays = INDEXED_PROPERTIES.filter_map { |property|
              node.send(property) if node.respond_to?(property)
            }

            indexing(*arrays, &)
          end
        end

        attr_reader :node_path #: Array[Integer]

        #: (String, ?Hash[Symbol, untyped]) -> void
        def initialize(input, properties = {})
          @node_path = properties[:node_path] || []
          @found = false

          given = properties[:parser_options] || {} #: Hash[Symbol, untyped]
          parser_options = given.merge(iteration_nodes: true)

          super(
            input,
            properties.merge(
              bufvar: SINK,
              preamble: "#{BUFFER} = ::String.new; #{SINK} = ::String.new;",
              postamble: "#{BUFFER}\n",
              parser_options: parser_options
            )
          )
        end

        #: () -> untyped
        def compiler_class
          Compiler
        end

        #: () -> String
        def inspect
          "#<#{self.class.name}>"
        end

        protected

        #: (Symbol) -> void
        def add_subtree_boundary(boundary)
          entering = boundary == :enter

          @found = true if entering
          @bufvar = entering ? BUFFER : SINK
        end

        #: (String) -> void
        def add_postamble(postamble)
          raise TargetNotFound, node_path unless @found

          super
        end
      end
    end
  end
end
