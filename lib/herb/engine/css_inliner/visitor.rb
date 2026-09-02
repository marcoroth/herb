# frozen_string_literal: true

require_relative "../../visitor/context_aware"
require_relative "../../visitor/diagnostics"
require_relative "inliner"

module Herb
  class Engine
    module CSSInliner
      # Writes the CSS a template rendered into `style` attributes on the markup it applies to.
      #
      #     Herb::Engine.new(source, filename: path, visitors: [
      #       Herb::Engine::CSSInliner::Visitor.new(stylesheets: ["app/assets/email.css"])
      #     ])
      #
      # A `style` attribute is the only way to say something an email client reads, and this is how a
      # stylesheet gets there. The CSS is matched against the markup once the file has rendered, not
      # when it is compiled, because that is the first moment the markup exists.
      #
      # Every `<style>` block the template rendered is inlined, whoever wrote it. A block the author
      # wrote by hand, and a block `ScopedStyle::Visitor` narrowed, are both read out of the markup
      # by the inliner itself. `stylesheets` are files read when the template is compiled and carried
      # in the compiled template, so nothing reads a file to render one and the CSS a template was
      # compiled against cannot change under it.
      #
      # Because it inlines every block it finds, this belongs in a stack that wants all of its CSS on
      # the elements. That is what an email wants. A page that meant a `<style>` block to stay a
      # `<style>` block does not.
      #
      # What a template holds when this runs is what it decides about, so it has to run after anything
      # that rewrites the blocks, which the stack checks. A `ScopedStyle::Visitor` delivering anywhere
      # other than `:inline` takes its block out of the markup, and reading a template before that
      # happens is reading a block that will not be there to inline.
      #
      class Visitor < Herb::Visitor
        include Herb::Visitor::ContextAware
        include Herb::Visitor::Diagnostics

        AT_RULES = /@(?:media|supports|keyframes|font-face|container|layer)\b/ #: Regexp
        STATEFUL = /::?(?:hover|focus|active|visited|target|before|after|placeholder|marker|selection)\b/ #: Regexp

        #: () -> bool
        def self.reads_style_blocks?
          true
        end

        #: (?stylesheets: Array[String]) -> void
        def initialize(stylesheets: [])
          super()

          @stylesheets = stylesheets #: Array[String]
          @css = nil #: String?
          @blocks = [] #: Array[String?]
        end

        #: (Herb::AST::DocumentNode) -> void
        def visit_document_node(node)
          @blocks = [] #: Array[String?]

          super
        end

        #: (Herb::AST::HTMLElementNode) -> void
        def visit_html_element_node(node)
          @blocks << block_css(node) if node.tag_name&.value&.downcase == "style"

          super
        end

        #: (Herb::AST::DocumentNode) -> void
        def finish(node)
          @css = read_stylesheets

          report_missing_inliner

          return if @css.nil? || @css.empty?

          children = node.children

          return unless children.is_a?(Array)

          @blocks << @css

          children.unshift(literal_node("<style>#{@css}</style>"))

          nil
        end

        #: (String) -> String
        def postamble(carried)
          return carried if @blocks.empty?

          "::Herb::Engine::CSSInliner.inline((#{carried.strip}), keep: #{keeping?})\n"
        end

        #: () -> String
        def inspect
          return "#<#{self.class.name}>" if @stylesheets.empty?

          "#<#{self.class.name} stylesheets=#{@stylesheets.join(", ")}>"
        end

        private

        #: () -> void
        def report_missing_inliner
          return unless CSSInliner.inliner == false

          warning(
            "#{self.class.name} writes CSS onto the markup with the `css_inline` gem, which is not installed, so the markup is left with the blocks it was written with. Add `css_inline` to write it onto the elements.",
            nil,
            code: "css-inliner-without-an-inliner"
          )

          nil
        end

        #: (Herb::AST::HTMLElementNode) -> String?
        def block_css(node)
          children = node.body || []

          return nil unless children.all?(Herb::AST::LiteralNode)

          children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join
        end

        #: () -> bool
        def keeping?
          return true if @blocks.any?(&:nil?)

          @blocks.compact.any? { |css| css.match?(AT_RULES) || css.match?(STATEFUL) }
        end

        #: (String) -> Herb::AST::LiteralNode
        def literal_node(content)
          Herb::AST::LiteralNode.build(content: content.dup)
        end

        #: () -> String?
        def read_stylesheets
          return "" if @stylesheets.empty?

          @stylesheets.filter_map { |stylesheet| read_stylesheet(stylesheet) }.join("\n")
        end

        #: (String) -> String
        def resolve(stylesheet)
          return stylesheet if Pathname.new(stylesheet).absolute? || context.project_path.nil?

          File.join(context.project_path.to_s, stylesheet)
        end

        #: (String) -> String?
        def read_stylesheet(stylesheet)
          path = resolve(stylesheet)

          File.read(path)
        rescue SystemCallError, IOError => e
          warning(
            "A stylesheet `#{self.class.name}` was told to inline could not be read, so the markup it applies to was left without it. It failed with `#{e.message}`.",
            nil,
            code: "css-inliner-stylesheet-that-could-not-be-read"
          )

          nil
        end
      end
    end
  end
end
