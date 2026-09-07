# frozen_string_literal: true
# typed: false

require_relative "../../../herb"
require_relative "../../engine"
require_relative "visitor"
require_relative "state_overrides"

module Herb
  class Engine
    module Slots
      # Compiles a template into Ruby that returns its dynamic values rather than its HTML.
      #
      # `Herb::Engine` answers "what does this template render". This answers "what did the template
      # evaluate to render it", which is the half that changes when state changes:
      #
      #     require "herb/engine/slots/dynamics_compiler"
      #
      #     source = Herb::Engine::Slots::DynamicsCompiler.new(%(<h1><%= @title %></h1>)).src
      #     view.instance_eval(source)
      #     #=> { template: "app/views/posts/index.html.erb", version: "fd3dfd36", slots: { 0 => "Hello" } }
      #
      # The names follow Phoenix LiveView, which splits a rendered template into its `static` strings
      # and its `dynamic` values for the same reason. A template's statics never change between
      # renders, so anything re-rendering on a state change only has to send the dynamics.
      #
      # This is a separate compiler rather than an option on `Herb::Engine` because that class is a
      # drop-in for `Erubi::Engine` and has to keep answering the way Erubi does.
      #
      # ## Values name the template they came from
      #
      # An index means nothing on its own, because it is a position in one template's numbering, and
      # it means something else in the next template. So the values arrive wrapped in the identifier
      # and version `Visitor` gave the markers, which is the same pair the page carries in
      # `<!--herb-region:ID:VERSION-->`. A client holding both can tell that they were compiled
      # together, and a version that no longer matches says the indices cannot be trusted.
      #
      # ## The shape follows the template, not the render
      #
      # Every insertion point owns an index, decided while compiling and the same on every render.
      # Control flow owns one too, because what it decided is itself a value that changes:
      #
      #     <% if admin? %><%= secret %><% else %><%= public %><% end %>
      #     #=> { 0 => { branch: 0, slots: { 1 => "s" } } }   when admin?
      #     #=> { 0 => { branch: 1, slots: { 2 => "p" } } }   otherwise
      #
      # Both branches keep their own indices, so a condition flipping changes which indices are
      # present and never what an index means.
      #
      # ## Absent means it did not run
      #
      # A key is missing when the code that would have filled it never ran, which is the same thing
      # the rendered markup says by not being there. Nothing has to be sent about a branch that was
      # not taken, and nothing can be learned about one either.
      #
      # A conditional and a collection are always present, because both are evaluated on every render
      # even when they produce nothing. A conditional that matched no branch is `{ branch: nil }` and
      # an empty collection is `{ items: {} }`, both of which the client has to be told.
      #
      # ## Collections group by item
      #
      # A collection holds its items in render order, each item carrying the slots inside it:
      #
      #     <% users.each do |user| %><%= user.first %> <%= user.last %><% end %>
      #     #=> { 0 => { items: { 1 => { 1 => "Marco", 2 => "Roth" },
      #                           2 => { 1 => "Joe",   2 => "Doe" } } } }
      #
      # Grouping the other way would give one list per slot and leave the client to zip them back
      # together, which it cannot do once an item is inserted rather than appended.
      #
      # An item is keyed by the key its template declares, through `herb-key` or `id` or a
      # `<%# herb:key %>` directive, which is what makes it survive being reordered. `Visitor`
      # decides what that key is and this evaluates it, so an item arrives under the same key the
      # marker around it carries. A collection that declares none falls back to position.
      #
      # ## A partial keeps its own values
      #
      # `<%= render "posts/card" %>` evaluates to that partial's own values, so the slot holding it
      # holds a whole payload rather than a string:
      #
      #     { template: "index.html.erb", version: "a1b2c3d4",
      #       slots: { 0 => { template: "_card.html.erb", version: "e5f6a7b8", slots: { 0 => "Marco" } } } }
      #
      # Nothing else would work, because the partial numbers its slots in its own template and the
      # page marks them out as their own region. Coercing it to a string would flatten a partial's
      # values into the markup they were meant to replace, and a partial rendering a partial is
      # ordinary, so this nests as deeply as the template does.
      #
      # ## Escaping
      #
      # A value carries the escaping of the place it was written, because that is where it is going
      # back to. The same expression is escaped differently in an attribute, in a `<script>`, and in
      # text, so the tree is left intact and the compiler decides as it normally would.
      #
      # ## Blocks
      #
      # A tag that takes a block, such as `<%= form_with do |f| %>`, owns an entry holding everything
      # the block rendered, because the helper wraps that output in markup of its own that only the
      # helper can produce. What the template wrote inside the block keeps its own indices alongside:
      #
      #     <%= form_with(model: @user) do |f| %><%= f.label %><% end %>
      #     #=> { 0 => "<form>Name</form>", 1 => "Name" }
      #
      # So a caller that can address slot 1 sends a value, and one that cannot falls back to slot 0
      # and the whole block. Slot 1 is inside slot 0, which the client already has to reason about
      # for conditionals and collections.
      #
      # A block yielding more than once is the exception, since one index cannot stand for the several
      # values its interior took. `each` and the other iterations are compiled as collections for that
      # reason, and a helper that yields repeatedly reports the last value its interior took.
      #
      class DynamicsCompiler < Herb::Engine
        BUFFER = "__herb_dynamics" #: String
        BLOCK_BUFFER = "__herb_block" #: String
        SLOT_BUFFER = "__herb_slot" #: String
        SCOPE_BUFFER = "__herb_scope" #: String
        ITEMS_BUFFER = "__herb_items" #: String
        KEY_BUFFER = "__herb_key" #: String
        OCCURRENCE_BUFFER = "__herb_occurrence" #: String

        BRANCHING_NODES = [
          "AST_ERB_IF_NODE",
          "AST_ERB_UNLESS_NODE",
          "AST_ERB_ELSE_NODE",
          "AST_ERB_WHEN_NODE",
          "AST_ERB_IN_NODE"
        ].freeze #: Array[String]

        class Compiler < Herb::Engine::Compiler
          #: (untyped, ?Hash[Symbol, untyped]) -> void
          def initialize(engine, options = {})
            super

            @slot_visitor = engine.slot_visitor
            @current_node = nil
            @current_attribute = nil
            @current_rcdata = nil
            @rendering = false
            @capturing_part = false
            @block_depth = 0

            branch_counts = {} #: Hash[Integer, Integer]
            branch_owner = {} #: Hash[untyped, Integer]

            @branch_counts = branch_counts
            @branch_owner = branch_owner.compare_by_identity
          end

          #: (untyped) -> void
          def visit_html_attribute_node(node)
            previous = @current_attribute
            @current_attribute = node

            super
          ensure
            @current_attribute = previous
          end

          #: (untyped) -> void
          def visit_html_element_node(node)
            index = @slot_visitor.index_for(node)
            previous = @current_rcdata
            slot = index ? @slot_visitor.slots[index] : nil #: untyped

            @current_rcdata = node if slot&.type == :raw_text_interpolation

            if slot&.type == :keyed
              @tokens << [:scope, "", nil, [:open_keyed, index, slot.key_expression]]

              begin
                super
              ensure
                @tokens << [:scope, "", nil, [:close_keyed, index]]
              end
            else
              super
            end
          ensure
            @current_rcdata = previous
          end

          #: (untyped) -> void
          def visit_erb_content_node(node)
            previous = @current_node
            @current_node = node

            super
          ensure
            @current_node = previous
          end

          #: (untyped) -> void
          def visit_erb_yield_node(node)
            previous = @current_node
            @current_node = node

            super
          ensure
            @current_node = previous
          end

          #: (untyped) -> void
          def visit_erb_render_node(node)
            previous = @current_node
            @current_node = node
            @rendering = node.end_node.nil?

            super
          ensure
            @current_node = previous
            @rendering = false
          end

          #: (untyped) { () -> void } -> void
          def visit_erb_control_node(node, &block)
            return super unless block
            return super unless branch?(node)

            index = @branch_owner[node]

            branched = lambda do
              @tokens << [:scope, "", nil, [:branch, index, next_branch(index)]]

              block.call
            end

            super(node, &branched)
          end

          #: (untyped) -> void
          def visit_erb_if_node(node)
            conditional(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_unless_node(node)
            conditional(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_case_node(node)
            conditional(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_case_match_node(node)
            conditional(node) { super }
          end

          #: (untyped) -> void
          def visit_erb_iteration_block_node(node)
            collection(node) do |index|
              visit_erb_control_node(node) do
                item(index) do
                  visit_all(node.body)

                  visit(node.rescue_clause)
                  visit(node.else_clause)
                  visit(node.ensure_clause)
                end

                visit(node.end_node)
              end
            end
          end

          #: (untyped) -> void
          def visit_erb_for_node(node)
            iteration(node, :statements)
          end

          #: (untyped) -> void
          def visit_erb_while_node(node)
            iteration(node, :statements)
          end

          #: (untyped) -> void
          def visit_erb_until_node(node)
            iteration(node, :statements)
          end

          #: (untyped) -> void
          def visit_erb_block_node(node)
            return super unless output_block?(node)

            opening = node.tag_opening.value

            check_for_escaped_erb_tag!(opening)

            should_escape = should_escape_output?(opening)
            index = claim(node)

            @tokens << [
              should_escape ? :expr_block_escaped : :expr_block,
              node.content.value.strip,
              current_context,
              index
            ]

            @last_trim_consumed_newline = false
            @trim_next_whitespace = true if right_trim?(node)

            @block_depth += 1

            begin
              visit_all(node.body)
            ensure
              @block_depth -= 1
            end

            visit_erb_block_end_node(node.end_node, escaped: should_escape)
          end

          #: () -> void
          def generate_output
            @engine.send(:capture_occurrence)

            optimize_tokens(@tokens).each do |type, value, context, extra|
              case type
              when :text then @engine.send(:add_text, value)
              when :code then @engine.send(:add_code, value)
              when :scope then @engine.send(:add_scope, *extra)
              when :dynamic
                index, escaped, nested = extra

                @engine.send(:add_dynamic, value, context, index, escaped, nested: nested)
              when :expr_block, :expr_block_escaped
                @engine.send(:add_dynamic_block, value, extra, type == :expr_block_escaped)
              when :expr_block_end
                @engine.send(:add_expression_block_end, value, escaped: extra)
              end
            end
          end

          private

          #: (untyped) -> Integer?
          def claim(node)
            return nil if @capturing_part

            @slot_visitor.index_for(@current_attribute || @current_rcdata || node)
          end

          #: (String) -> void
          def add_expression(code)
            @tokens << [:dynamic, code, current_context, [claim(@current_node), false, @rendering]]
            @last_trim_consumed_newline = false
          end

          #: (String) -> void
          def add_expression_escaped(code)
            @tokens << [:dynamic, code, current_context, [claim(@current_node), true, @rendering]]
            @last_trim_consumed_newline = false
          end

          #: (untyped) -> bool
          def output_block?(node)
            node.tag_opening.value.include?("=")
          end

          #: (untyped) -> bool
          def branch?(node)
            @branch_owner.key?(node)
          end

          #: (Integer) -> Integer
          def next_branch(index)
            count = @branch_counts[index] || 0
            @branch_counts[index] = count + 1

            count
          end

          #: (untyped) { () -> void } -> void
          def conditional(node)
            return yield if branch?(node)

            if @current_attribute || @current_rcdata
              return yield if @capturing_part

              index = claim(node)

              return yield unless index

              @capturing_part = true
              @tokens << [:scope, "", nil, [:part_open]]

              yield

              @tokens << [:scope, "", nil, [:part_close, index]]
              @capturing_part = false

              return
            end

            index = claim(node)

            return yield unless index

            own_branches(node, index)

            @tokens << [:scope, "", nil, [:open_conditional, index]]

            yield

            @tokens << [:scope, "", nil, [:close_conditional, index]]
          end

          #: (untyped, Integer) -> void
          def own_branches(node, index)
            return unless node

            @branch_owner[node] = index if BRANCHING_NODES.include?(node.type.to_s)

            [:subsequent, :else_clause, :conditions].each do |property|
              next unless node.respond_to?(property)

              value = node.send(property)

              case value
              when Array then value.each { |child| own_branches(child, index) }
              when nil then next
              else own_branches(value, index)
              end
            end
          end

          #: (untyped) { (Integer?) -> void } -> void
          def collection(node)
            index = claim(node)

            return yield(nil) unless index

            @tokens << [:scope, "", nil, [:open_collection, index]]

            yield(index)

            @tokens << [:scope, "", nil, [:close_collection, index]]
          end

          #: (Integer?) { () -> void } -> void
          def item(index)
            return yield unless index

            @tokens << [:scope, "", nil, [:item_begin, index, item_key(index)]]

            yield

            @tokens << [:scope, "", nil, [:item_end, index]]
          end

          #: (Integer) -> String?
          def item_key(index)
            @slot_visitor.slots[index]&.key_expression
          end

          #: (untyped, Symbol) -> void
          def iteration(node, part)
            collection(node) do |index|
              visit_erb_control_node(node) do
                item(index) do
                  visit_all(node.send(part) || [])
                end

                visit(node.end_node)
              end
            end
          end
        end

        class Prune < Herb::Visitor
          #: (Visitor, Integer) -> void
          def initialize(slot_visitor, index)
            super()

            @slot_visitor = slot_visitor
            @index = index
          end

          #: (untyped) -> void
          def visit_document_node(node)
            target = @slot_visitor.slot_nodes[@index]

            return unless target

            keep(node, target)
          end

          private

          #: (untyped, untyped) -> void
          def keep(node, target)
            Visitor::BRANCH_BODY_PROPERTIES.each do |property|
              next unless node.respond_to?(property)

              value = node.send(property)

              case value
              when Array
                if property == :conditions
                  value.each { |arm| keep(arm, target) if contains?(arm, target) }
                else
                  value.replace(value.select { |child| child.equal?(target) || contains?(child, target) || @slot_visitor.assignment_node?(child) })
                  value.each { |child| keep(child, target) if !child.equal?(target) && contains?(child, target) }
                end
              when Herb::AST::Node
                keep(value, target) if contains?(value, target)
              end
            end

            Visitor::BRANCH_CONTINUATION_PROPERTIES.each do |property|
              next unless node.respond_to?(property)

              continuation = node.send(property)

              keep(continuation, target) if continuation && contains?(continuation, target)
            end
          end

          #: (untyped, untyped) -> bool
          def contains?(node, target)
            return true if node.equal?(target)
            return false unless node.is_a?(Herb::AST::Node)

            node.compact_child_nodes.any? { |child| contains?(child, target) }
          end
        end

        attr_reader :slot_visitor #: Visitor

        #: (String, ?Hash[Symbol, untyped]) -> void
        def initialize(input, properties = {})
          @block_depth = 0
          @scopes = [] #: Array[Integer]
          @input = input
          @filename = properties[:filename]
          @slot_visitor = properties[:slot_visitor] || Visitor.new(mode: :server, mark: false)
          @slot_visitor.state_overrides!
          visitors = [*properties[:visitors], @slot_visitor]
          visitors << Prune.new(@slot_visitor, properties[:block]) if properties[:block]

          super(
            input,
            properties.merge(
              bufvar: BUFFER,
              bufval: "::Hash.new",
              postamble: "#{BUFFER}\n",
              visitors: visitors
            )
          )
        end

        #: () -> untyped
        def compiler_class
          Compiler
        end

        #: (String) -> void
        def add_text(text)
          return if @block_depth.zero?

          super
        end

        #: (Symbol, *untyped) -> void
        def add_scope(kind, *)
          send(:"scope_#{kind}", *)
        end

        #: (String, Symbol?, Integer?, bool, ?nested: bool) -> void
        def add_dynamic(code, context, index, escaped, nested: false)
          value = if index && boolean_presence?(index)
                    "!!(#{code})"
                  elsif nested
                    "(#{code})"
                  else
                    dynamic_value(code, context, escaped)
                  end

          unless @block_depth.zero?
            if index && boolean_presence?(index)
              attribute = @slot_visitor.slots[index].attribute.to_s.inspect

              return add_block_dynamic("(#{assignment(index, value)}) ? #{attribute} : \"\"")
            end

            if index && interpolated?(index)
              return add_block_dynamic("(#{assignment(index, value)}).fetch(-1)")
            end

            return add_block_dynamic(index ? assignment(index, value) : value)
          end
          return if index.nil?

          @src << "; " << assignment(index, value) << ";"
        end

        #: (Integer) -> bool
        def boolean_presence?(index)
          @slot_visitor.slots[index]&.type == :boolean_attribute
        end

        #: (String, Integer?, bool) -> void
        def add_dynamic_block(code, index, escaped)
          @_in_expression_block = true
          @_expression_block_open_paren = true

          opening = escaped ? "#{@escapefunc}((" : "("

          @src << if @block_depth.zero?
                    "; #{current_scope}[#{index}] = #{opening}#{code}"
                  else
                    "; #{@bufvar} << #{opening}#{code}"
                  end

          open_block
        end

        #: (String, ?escaped: bool) -> void
        def add_expression_block_end(code, escaped: false)
          @src << "; " << @bufvar

          close_block

          super
        end

        #: () -> String
        def inspect
          "#<#{self.class.name}>"
        end

        private

        #: (String) -> void
        def add_postamble(_postamble)
          super("{ template: #{@slot_visitor.identifier.inspect}, " \
                "version: #{@slot_visitor.version.inspect}, " \
                "occurrence: #{OCCURRENCE_BUFFER}#{region_seeds}, " \
                "slots: #{BUFFER} }\n")
        end

        #: () -> String
        def region_seeds
          names = @slot_visitor.seeded_region_states

          return "" if names.nil? || names.empty?

          pairs = names.map { |name| "#{name.inspect} => #{name}" }.join(", ")

          ", seeds: #{Markers.seeds_expression(pairs)}"
        end

        #: () -> void
        def capture_occurrence
          @src << "; #{OCCURRENCE_BUFFER} = #{@slot_visitor.occurrence_expression};"
        end

        #: () -> String
        def current_scope
          @scopes.empty? ? BUFFER : "#{SCOPE_BUFFER}#{@scopes.last}"
        end

        #: (Integer) -> void
        def scope_open_conditional(index)
          @src << "; #{SLOT_BUFFER}#{index} = nil;"
        end

        #: (Integer, Integer) -> void
        def scope_branch(index, branch)
          leave_scope(index)

          statics = payload_statics(index, branch)
          parked = statics ? " statics: #{statics.inspect}," : ""

          @src << "; #{SLOT_BUFFER}#{index} = { branch: #{branch},#{parked} slots: (#{SCOPE_BUFFER}#{index} = ::Hash.new) };"

          @scopes.push(index)
        end

        #: (Integer, Integer) -> String?
        def payload_statics(index, branch)
          server = @input.is_a?(String) && Visitor.directive_mode(@input) == :server
          withheld = branch.zero? && @slot_visitor.deferred_entries.key?(index)

          return nil unless server || withheld

          branch_statics["#{index}:#{branch}"]
        end

        #: () -> Hash[String, String]
        def branch_statics
          @branch_statics ||= begin
            visitor = Visitor.new(fatal: false)

            Herb::Engine.new(@input, visitors: [visitor], filename: @filename)

            visitor.statics || {}
          end
        end

        #: (Integer) -> void
        def scope_close_conditional(index)
          leave_scope(index)

          @src << "; #{current_scope}[#{index}] = (#{SLOT_BUFFER}#{index} || { branch: nil });"
        end

        #: (Integer) -> void
        def scope_open_collection(index)
          @src << "; #{ITEMS_BUFFER}#{index} = ::Hash.new;"
        end

        #: (Integer, ?String?) -> void
        def scope_item_begin(index, key = nil)
          @src << "; #{KEY_BUFFER}#{index} = (#{key}).to_s" if key
          @src << "; #{SCOPE_BUFFER}#{index} = ::Hash.new;"

          @scopes.push(index)
        end

        #: (Integer) -> void
        def scope_item_end(index)
          leave_scope(index)

          return unless keyed?(index)

          @src << item_seeds(index)
          @src << "; #{ITEMS_BUFFER}#{index}[#{KEY_BUFFER}#{index}.to_s] = #{SCOPE_BUFFER}#{index};"
        end

        #: (Integer) -> bool
        def keyed?(index)
          !@slot_visitor.slots[index]&.key_expression.nil?
        end

        #: (Integer) -> String
        def item_seeds(index)
          names = @slot_visitor.seeded_item_states[index]

          return "" if names.nil? || names.empty?

          pairs = names.map { |name| "#{name.inspect} => #{name}" }.join(", ")

          "; #{SCOPE_BUFFER}#{index}[:seeds] = #{Markers.seeds_expression(pairs)};"
        end

        #: (Integer) -> void
        def scope_close_collection(index)
          @src << "; #{current_scope}[#{index}] = { items: #{ITEMS_BUFFER}#{index}, order: #{ITEMS_BUFFER}#{index}.keys };"
        end

        #: (Integer, String) -> void
        def scope_open_keyed(index, key)
          @src << "; #{KEY_BUFFER}#{index} = (#{key}).to_s"
          @src << "; #{SCOPE_BUFFER}#{index} = ::Hash.new;"

          @scopes.push(index)
        end

        #: (Integer) -> void
        def scope_close_keyed(index)
          leave_scope(index)

          @src << "; #{current_scope}[#{index}] = { key: #{KEY_BUFFER}#{index}, slots: #{SCOPE_BUFFER}#{index} };"
        end

        #: (Integer) -> void
        def leave_scope(index)
          @scopes.pop if @scopes.last == index
        end

        #: (String, Symbol?, bool) -> String
        def dynamic_value(code, context, escaped)
          escapefunc = context_escape_function(context)

          return "#{escapefunc}((#{code}))" if escapefunc
          return "#{@escapefunc}((#{code}))" if escaped

          "(#{code}).to_s"
        end

        #: (Integer, String) -> String
        def assignment(index, value)
          if interpolated?(index)
            "(#{current_scope}[#{index}] ||= []) << #{value}"
          else
            "#{current_scope}[#{index}] = #{value}"
          end
        end

        #: (Integer) -> bool
        def interpolated?(index)
          @slot_visitor.slots[index]&.interpolated? || false
        end

        #: (String) -> void
        def add_block_dynamic(value)
          @src << "; " << @bufvar << " << (" << value << ");"
        end

        #: () -> void
        def scope_part_open
          open_block
        end

        #: (Integer) -> void
        def scope_part_close(index)
          buffer = @bufvar

          close_block

          @src << "; " << assignment(index, buffer) << ";"
        end

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
end
