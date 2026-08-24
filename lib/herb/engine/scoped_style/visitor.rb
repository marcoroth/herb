# frozen_string_literal: true
# typed: false

require "digest"

require_relative "../../visitor"
require_relative "../context_aware"
require_relative "../diagnostics"
require_relative "channel"
require_relative "../visitor_context"

module Herb
  class Engine
    module ScopedStyle
      # Scopes a `<style scoped>` block to the markup written in the same file.
      #
      #     require "herb/engine/scoped_style/visitor"
      #
      #     Herb::Engine.new(source, filename: path, visitors: [
      #       Herb::Engine::ScopedStyle::Visitor.new(transform: transform)
      #     ])
      #
      # A file holding a scoped block is given a scope attribute, and the block's selectors are
      # rewritten to require it. There is no single root element to write, because a file is scoped
      # as a whole. A file with five sibling roots and a file with none behave the same way.
      #
      # Where the attribute goes depends on what the file can be sure of. A file that renders nothing
      # owns everything under its roots, so the attribute goes on the roots alone and the selectors
      # match within them. A file that renders something does not, so every element it wrote carries
      # the attribute and the selectors match only those.
      #
      # The second form is not a fallback that could be avoided with a better selector. Narrowing by
      # ancestor cannot stop at a nested scope, because an element inside one is still a descendant
      # of the one outside it, and CSS has no way to say otherwise. Only an attribute on the element
      # itself distinguishes them.
      #
      # A file is scoped as a whole, so markup an inlined partial brought with it belongs to the
      # partial and not to the template it landed in. `Herb::Engine::Origin` is what says so, which
      # is why this has to run after `InlineRenderVisitor` and before `SlotVisitor`, whose parked
      # markup a client rebuilds from and which therefore has to already carry the attribute.
      #
      # Rewriting the selectors is somebody else's job. `transform` is anything answering `call` with
      # the block's CSS and the selector to narrow it by:
      #
      #     transform.call(".title { color: red }", scope: "[data-herb-scope-1a2b3c4d]")
      #     #=> ".title[data-herb-scope-1a2b3c4d] { color: red }"
      #
      # `LightningCSS::Transformer` answers that, so it can be handed over as it is:
      #
      #     Herb::Engine::ScopedStyle::Visitor.new(transform: LightningCSS::Transformer.new(minify: true))
      #
      # `scope` is the selector each rule has to be narrowed by, appended to what the rule already
      # matches. A file that renders nothing is given the ancestor form instead, which is the same
      # operation on the transform's side:
      #
      #     scope: ":where([data-herb-scope-1a2b3c4d], [data-herb-scope-1a2b3c4d] *)"
      #
      # Without one, a block is left exactly as it was written and reported. Scoping the markup while
      # leaving the CSS alone would turn a scoped block into a global one.
      #
      # `deliver` says where the narrowed CSS goes. `:inline` leaves the block where it was written,
      # which needs nothing else installed and writes the block again on every render of the file it
      # was written in. `:hoist` takes the block out and registers the CSS with the session the page
      # is collecting into, which writes it once however many times the file renders, and needs
      # `Herb::Engine::Report::Middleware` to put it on the page.
      #
      class Visitor < Herb::Visitor
        include ContextAware
        include Diagnostics

        ARRAY_PROPERTIES = [:children, :body, :statements].freeze #: Array[Symbol]
        NODE_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

        ATTRIBUTE_PREFIX = "data-herb-scope-" #: String
        SCOPED_ATTRIBUTE = "scoped" #: String
        UNSCOPABLE_ELEMENTS = ["style", "script"].freeze #: Array[String]
        OPEN_TAGS = [Herb::AST::HTMLOpenTagNode, Herb::AST::ERBOpenTagNode].freeze #: Array[untyped]
        DIGEST_LENGTH = 8 #: Integer

        required_parser_option track_locations: true
        required_parser_option render_nodes: true

        # @rbs!
        #   def self.experimental_warning_issued: () -> bool
        #   def self.experimental_warning_issued=: (bool) -> bool

        class << self
          attr_accessor :experimental_warning_issued #: bool
        end

        self.experimental_warning_issued = false

        DELIVERIES = [:inline, :hoist, :none].freeze #: Array[Symbol]

        Pending = Data.define(:node, :open_tag, :attribute, :css, :file, :container)

        #: (?transform: untyped, ?deliver: Symbol) -> void
        def initialize(transform: nil, deliver: :inline)
          super()

          raise ArgumentError, "deliver has to be one of #{DELIVERIES.join(", ")}, got #{deliver.inspect}" unless DELIVERIES.include?(deliver)

          @deliver = deliver
          @transform = transform
          @scopes = {} #: Hash[String, String]
          @styles = {} #: Hash[String, String]
          @elements = {} #: Hash[String, Integer]
          @openings = {} #: Hash[String, Integer]
          @depth = {} #: Hash[String, Integer]
          @pending = [] #: Array[Array[untyped]]
          @stack = [] #: Array[String]

          return if self.class.experimental_warning_issued

          self.class.experimental_warning_issued = true

          warn "[Herb] Scoped styles are experimental. Their output and API may change."
        end

        #: () -> Hash[String, String]
        def styles
          @styles.dup
        end

        #: (Herb::AST::DocumentNode) -> void
        def visit_document_node(node)
          @stack = [context.relative_file_path]
          @scopes = {} #: Hash[String, String]
          @styles = {} #: Hash[String, String]
          @elements = Hash.new(0) #: Hash[String, Integer]
          @openings = Hash.new(0) #: Hash[String, Integer]
          @depth = Hash.new(0) #: Hash[String, Integer]
          @pending = [] #: Array[Array[untyped]]

          collect(node)
          narrow

          super

          report_empty_scopes
        end

        #: (Herb::AST::ERBBlockNode) -> void
        def visit_erb_block_node(node)
          entered = enter(node)

          super
        ensure
          leave if entered
        end

        #: (Herb::AST::HTMLElementNode) -> void
        def visit_html_element_node(node)
          file = current_file
          scope = @scopes[file]
          open_tag = node.open_tag

          attributes = scope && scopable?(node) ? attribute_children(open_tag) : nil

          if attributes && scope
            @elements[file] += 1

            attributes << attribute_node(scope) if @depth[file].zero? || @openings[file].positive?
          end

          @depth[file] += 1

          super
        ensure
          @depth[file] -= 1
        end

        #: () -> String
        def inspect
          parts = [] #: Array[String]
          parts << "transform=#{@transform.class}" if @transform
          parts << "deliver=#{@deliver}" unless @deliver == :inline

          return "#<#{self.class.name}>" if parts.empty?

          "#<#{self.class.name} #{parts.join(" ")}>"
        end

        private

        #: () -> String
        def current_file
          @stack.last #: as String
        end

        #: (Herb::AST::Node) -> Herb::Engine::Origin::Entry?
        def enter(node)
          entry = origin.of(node)

          @stack.push(entry.file) if entry

          entry
        end

        #: () -> void
        def leave
          @stack.pop

          nil
        end

        #: (Herb::AST::Node, ?Array[untyped]?) -> void
        def collect(node, container = nil)
          @openings[current_file] += 1 if origin.of(node)

          entered = enter(node)

          @openings[current_file] += 1 if opens_the_file?(node)

          scope_style(node, container) if node.is_a?(Herb::AST::HTMLElementNode)

          ARRAY_PROPERTIES.each do |property|
            children = property_of(node, property)

            next unless children.is_a?(Array)

            children.each { |child| collect(child, children) if child.is_a?(Herb::AST::Node) }
          end

          NODE_PROPERTIES.each do |property|
            child = property_of(node, property)

            collect(child) if child.is_a?(Herb::AST::Node)
          end

          leave if entered

          nil
        end

        #: (Herb::AST::Node) -> bool
        def opens_the_file?(node)
          node.is_a?(Herb::AST::ERBRenderNode) || node.is_a?(Herb::AST::ERBYieldNode)
        end

        #: (Herb::AST::Node, Symbol) -> untyped
        def property_of(node, property)
          node.send(property) if node.respond_to?(property)
        end

        #: (Herb::AST::HTMLElementNode, Array[untyped]?) -> void
        def scope_style(node, container)
          return unless node.tag_name&.value&.downcase == "style"

          open_tag = node.open_tag

          return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

          attribute = scoped_attribute(open_tag)

          return unless attribute
          return unless scopable_file?(node)

          css = static_css(node)

          return dynamic_style(node) unless css
          return untransformed_style(node) unless @transform

          @pending << Pending.new(
            node: node,
            open_tag: open_tag,
            attribute: attribute,
            css: css,
            file: current_file,
            container: container
          )

          scope_for(current_file)

          nil
        end

        #: () -> void
        def narrow
          @pending.each do |pending|
            scope = @scopes[pending.file] #: as String
            narrowed = @transform.call(pending.css, scope: scope_selector(pending.file, scope)).to_s
            place(pending, scope, narrowed)

            @styles[scope] = narrowed
          end

          nil
        end

        #: (Pending, String, String) -> void
        def place(pending, scope, narrowed)
          index = @deliver == :inline ? nil : position_of(pending)

          if index.nil?
            pending.node.body.replace([literal_node(narrowed)])
            remove_attribute(pending.open_tag, pending.attribute)
          elsif @deliver == :hoist
            pending.container[index] = register_node(scope, narrowed)
          else
            pending.container.delete_at(index)
          end

          nil
        end

        #: (Pending) -> Integer?
        def position_of(pending)
          container = pending.container

          return nil unless container

          container.index { |child| child.equal?(pending.node) }
        end

        #: (String, String) -> Herb::AST::ERBContentNode
        def register_node(scope, narrowed)
          Herb::AST::ERBContentNode.build(
            tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%"),
            content: Herb::Token.from(
              "TOKEN_ERB_CONTENT",
              " ::Herb::Engine::ScopedStyle::Channel.record(#{scope.dump}, #{narrowed.dump}) "
            ),
            tag_closing: Herb::Token.from("TOKEN_ERB_END", "%>"),
            valid: true
          )
        end

        #: (Herb::AST::HTMLOpenTagNode, Herb::AST::HTMLAttributeNode) -> void
        def remove_attribute(open_tag, attribute)
          children = open_tag.children
          index = children.index(attribute)

          return unless index

          children.delete_at(index)

          preceding = index.positive? ? children[index - 1] : nil

          children.delete_at(index - 1) if preceding.is_a?(Herb::AST::WhitespaceNode)

          nil
        end

        #: (Herb::AST::HTMLOpenTagNode) -> Herb::AST::HTMLAttributeNode?
        def scoped_attribute(open_tag)
          (open_tag.children || []).each do |child|
            next unless child.is_a?(Herb::AST::HTMLAttributeNode)

            return child if attribute_name(child) == SCOPED_ATTRIBUTE
          end

          nil
        end

        #: (Herb::AST::HTMLAttributeNode) -> String?
        def attribute_name(node)
          children = node.name&.children

          return nil unless children

          name = children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join

          name.empty? ? nil : name.downcase
        end

        #: (Herb::AST::HTMLElementNode) -> String?
        def static_css(node)
          children = node.body || []

          return nil unless children.all?(Herb::AST::LiteralNode)

          children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join
        end

        #: (Herb::AST::HTMLElementNode) -> bool
        def scopable_file?(node)
          return true unless current_file == VisitorContext::UNKNOWN_FILE_PATH

          warning(
            "A `<style scoped>` block needs the path of the file it was written in, and this template was compiled without one. Compile it with `filename:` to scope it.",
            node.location,
            code: "scoped-style-without-a-file"
          )

          false
        end

        #: (Herb::AST::HTMLElementNode) -> void
        def dynamic_style(node)
          warning(
            "A `<style scoped>` block built with ERB has no CSS to read at compile time, so it was left as it was written and still applies to the whole page.",
            node.location,
            code: "scoped-style-built-with-erb"
          )

          nil
        end

        #: (Herb::AST::HTMLElementNode) -> void
        def untransformed_style(node)
          warning(
            "A `<style scoped>` block was found, and #{self.class.name} was given no `transform` to narrow its selectors with, so it was left as it was written and still applies to the whole page.",
            node.location,
            code: "scoped-style-without-a-transform"
          )

          nil
        end

        #: (String, String) -> String
        def scope_selector(file, scope)
          return "[#{scope}]" if @openings[file].positive?

          ":where([#{scope}], [#{scope}] *)"
        end

        #: (String) -> String
        def scope_for(file)
          @scopes[file] ||= "#{ATTRIBUTE_PREFIX}#{Digest::SHA256.hexdigest(file)[0, DIGEST_LENGTH]}"
        end

        #: (untyped) -> Array[untyped]?
        def attribute_children(open_tag)
          return nil unless OPEN_TAGS.any? { |type| open_tag.is_a?(type) }

          open_tag.children
        end

        #: (Herb::AST::HTMLElementNode) -> bool
        def scopable?(node)
          !UNSCOPABLE_ELEMENTS.include?(node.tag_name&.value&.downcase)
        end

        #: (String) -> Herb::AST::HTMLAttributeNode
        def attribute_node(name)
          Herb::AST::HTMLAttributeNode.build(
            name: Herb::AST::HTMLAttributeNameNode.build(children: [literal_node(name)]),
            equals: nil,
            value: nil
          )
        end

        #: (String) -> Herb::AST::LiteralNode
        def literal_node(content)
          Herb::AST::LiteralNode.build(content: content.dup)
        end

        #: () -> void
        def report_empty_scopes
          @scopes.each_key do |file|
            next unless @elements[file].zero?

            warning(
              "The `<style scoped>` block in #{file} has no markup to apply to, because nothing in the file it was written in is an element.",
              nil,
              code: "scoped-style-without-markup"
            )
          end

          nil
        end
      end
    end
  end
end
