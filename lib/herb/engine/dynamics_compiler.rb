# frozen_string_literal: true
# typed: false

require_relative "../../herb"
require_relative "../engine"

module Herb
  class Engine
    # Compiles a template into Ruby that returns its dynamic values rather than its HTML.
    #
    # `Herb::Engine` answers "what does this template render". This answers "what did the template
    # evaluate to render it", which is the half that changes when state changes:
    #
    #     require "herb/engine/dynamics_compiler"
    #
    #     source = Herb::Engine::DynamicsCompiler.new(%(<h1><%= @title %></h1>)).src
    #     view.instance_eval(source)
    #     #=> ["Hello"]
    #
    # The names follow Phoenix LiveView, which splits a rendered template into its `static` strings
    # and its `dynamic` values for the same reason. A template's statics never change between
    # renders, so anything re-rendering on a state change only has to send the dynamics.
    #
    # This is a separate compiler rather than an option on `Herb::Engine` because that class is a
    # drop-in for `Erubi::Engine` and has to keep answering the way Erubi does.
    #
    # ## One entry per tag, at a fixed index
    #
    # Every `<%= %>` in the template owns an index, decided while compiling and the same on every
    # render. Control flow contributes no entries of its own, so the length of the result is a fact
    # about the template rather than about the render:
    #
    #     <% if admin? %><%= secret %><% else %><%= public %><% end %>
    #     #=> ["s", nil]   when admin?
    #     #=> [nil, "p"]   otherwise
    #
    # A branch that did not run leaves its tags `nil`. Both branches keep their own indices, so a
    # condition flipping changes which entries are filled and never what the entries mean.
    #
    # ## Loops are the exception
    #
    # A tag inside a loop runs once per iteration, and how many iterations there are is only known
    # at render time. Its entry is therefore a list rather than a value:
    #
    #     <% names.each do |name| %><h1><%= name %></h1><% end %>
    #     #=> [["Marco", "Joe"]]
    #
    # The index still belongs to the tag. Only its shape depends on the render.
    #
    # ## Escaping
    #
    # A value carries the escaping of the place it was written, because that is where it is going
    # back to. The same expression is escaped differently in an attribute, in a `<script>`, and in
    # text, so the tree is left intact and the compiler decides as it normally would.
    #
    # ## Blocks
    #
    # A tag that takes a block, such as `<%= form_with do |f| %>`, is one entry holding everything
    # the block rendered. The helper decides where the block's output goes, so there is no position
    # in the template to attribute the pieces to.
    class DynamicsCompiler < Herb::Engine
      BUFFER = "__herb_dynamics" #: String
      BLOCK_BUFFER = "__herb_block" #: String

      # Records, while walking, which tag each expression belongs to and whether that tag sits
      # inside a loop. Both are decided by where the tag is written, so both are known here and
      # neither can be worked out from the token stream alone.
      class Compiler < Herb::Engine::Compiler
        #: (untyped, ?Hash[Symbol, untyped]) -> void
        def initialize(engine, options = {})
          super

          @loop_depth = 0
        end

        #: (untyped) -> void
        def visit_erb_iteration_block_node(node)
          within_loop { super }
        end

        #: (untyped) -> void
        def visit_erb_for_node(node)
          within_loop { super }
        end

        #: (untyped) -> void
        def visit_erb_while_node(node)
          within_loop { super }
        end

        #: (untyped) -> void
        def visit_erb_until_node(node)
          within_loop { super }
        end

        # Dynamics are a token type the base compiler does not know, so the dispatch is repeated
        # here rather than inherited. Everything else is handed over unchanged.
        #: () -> void
        def generate_output
          index = 0
          depth = 0

          optimize_tokens(@tokens).each do |type, value, context, extra|
            case type
            when :text then @engine.send(:add_text, value)
            when :code then @engine.send(:add_code, value)
            when :dynamic
              escaped, in_loop = extra

              @engine.send(:add_dynamic, value, context, index, in_loop, escaped)

              # A tag inside a block writes into the string that block returns, so it is part of
              # that block's single entry rather than an entry of its own.
              index += 1 if depth.zero?
            when :expr_block, :expr_block_escaped
              @engine.send(:add_dynamic_block, value, index, type == :expr_block_escaped)

              index += 1 if depth.zero?
              depth += 1
            when :expr_block_end
              depth -= 1

              @engine.send(:add_expression_block_end, value, escaped: extra)
            end
          end
        end

        private

        # The extras ride in the slot the base compiler already carries through its token
        # optimization, so nothing here depends on that implementation keeping a wider tuple.
        #: (String) -> void
        def add_expression(code)
          @tokens << [:dynamic, code, current_context, [false, in_loop?]]
          @last_trim_consumed_newline = false
        end

        #: (String) -> void
        def add_expression_escaped(code)
          @tokens << [:dynamic, code, current_context, [true, in_loop?]]
          @last_trim_consumed_newline = false
        end

        #: () -> bool
        def in_loop?
          @loop_depth.positive?
        end

        #: [T] () { () -> T } -> T
        def within_loop
          @loop_depth += 1

          yield
        ensure
          @loop_depth -= 1
        end
      end

      #: (String, ?Hash[Symbol, untyped]) -> void
      def initialize(input, properties = {})
        @block_depth = 0
        @dynamics_size = 0

        # `.each do` is only its own node, and so only recognisable as a loop, when the parser is
        # asked for iteration nodes. Without it every loop would look like an ordinary block.
        given = properties[:parser_options] || {} #: Hash[Symbol, untyped]
        parser_options = given.merge(iteration_nodes: true)

        super(
          input,
          properties.merge(
            bufvar: BUFFER,
            bufval: "::Array.new",
            postamble: "#{BUFFER}\n",
            parser_options: parser_options
          )
        )
      end

      #: () -> untyped
      def compiler_class
        Compiler
      end

      # Static markup is what this compiler exists to leave out. Inside a block it is kept, because
      # there the buffer is a String the block returns rather than the list of dynamics.
      #: (String) -> void
      def add_text(text)
        return if @block_depth.zero?

        super
      end

      # A tag writes to the index it was given. Inside a loop it appends there instead, because it
      # runs once per iteration and the entry holds all of them.
      #: (String, Symbol?, Integer, bool, bool) -> void
      def add_dynamic(code, context, index, in_loop, escaped)
        value = dynamic_value(code, context, escaped)

        return add_block_dynamic(value) unless @block_depth.zero?

        claim(index)

        target = in_loop ? "(#{BUFFER}[#{index}] ||= ::Array.new) << " : "#{BUFFER}[#{index}] = "

        @src << "; " << target << value
      end

      # A tag that takes a block owns an index like any other, so the tags after it keep theirs.
      #: (String, Integer, bool) -> void
      def add_dynamic_block(code, index, escaped)
        @_in_expression_block = true
        @_expression_block_open_paren = true

        opening = escaped ? "#{@escapefunc}((" : "("

        # A block inside another block is part of what that one renders, so it goes into its
        # string rather than taking an entry of its own.
        if @block_depth.zero?
          claim(index)

          @src << "; #{BUFFER}[#{index}] = #{opening}#{code}"
        else
          @src << "; #{@bufvar} << #{opening}#{code}"
        end

        open_block
      end

      #: (String, ?escaped: bool) -> void
      def add_expression_block_end(code, escaped: false)
        @src << "; " << @bufvar

        close_block

        super
      end

      # Assigning by index only grows the array as far as the tags that ran, so a template whose
      # last tag sat in a branch that was skipped would come back short. The length is a fact about
      # the template, so it is set once the walk has counted the tags.
      #: (String) -> void
      def add_postamble(postamble)
        @src << "; #{BUFFER}[#{@dynamics_size - 1}] ||= nil\n" if @dynamics_size.positive?

        super
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

      #: (Integer) -> void
      def claim(index)
        @dynamics_size = index + 1 if index >= @dynamics_size
      end

      # Where a tag was written decides how it is escaped, so an attribute, a `<script>`, and
      # ordinary text each get their own function even for the same expression.
      #: (String, Symbol?, bool) -> String
      def dynamic_value(code, context, escaped)
        escapefunc = context_escape_function(context)

        return "#{escapefunc}((#{code}))" if escapefunc
        return "#{@escapefunc}((#{code}))" if escaped

        "(#{code}).to_s"
      end

      # Inside a block the buffer is a String being assembled, so a tag appends to it the way it
      # would in a normal template. The block as a whole is what becomes one dynamic.
      #: (String) -> void
      def add_block_dynamic(value)
        @src << "; " << @bufvar << " << " << value << ";"
      end

      # Everything the engine emits goes through `@bufvar`, so a block only has to point it
      # somewhere else. Every other path, including the escaping ones, then works unchanged.
      #: () -> void
      def open_block
        @block_depth += 1
        @bufvar = "#{BLOCK_BUFFER}#{@block_depth}"

        @src << "; " << @bufvar << " = ::String.new;"
      end

      #: () -> void
      def close_block
        @block_depth -= 1
        @bufvar = @block_depth.zero? ? BUFFER : "#{BLOCK_BUFFER}#{@block_depth}"
      end
    end
  end
end
