module Herb
	class FormatVisitor < Visitor
			attr_reader :output

		def initialize(indent_size: 2, max_line_length: 80, void_elements_style: :self_closing, attribute_quotes: :double, erb_spacing: :compact)
			@indent_size = indent_size
			@max_line_length = max_line_length
			@void_elements_style = void_elements_style
			@attribute_quotes = attribute_quotes
			@erb_spacing = erb_spacing
			@output = []
		end

		def visit_html_element_node(node)
			puts "Element node"
			super
		end

		def visit_html_open_tag_node(node)
			puts "HTML OpenTagNode #{node.tag_name.value}"
			@output << "<#{node.tag_name.value}"
			super
			@output << ">"
		end

		def visit_html_attribute_node(node)
			puts "HTML AttributeNode"
			visit(node.name)
			@output << "="
			@output << "\""
			visit(node.value)
			@output << "\""
		end

		def visit_html_attribute_name_node(node)
			super
			puts "HTML AttributeNameNode #{node.name.value}"
			@output << " #{node.name.value}"
		end

		def visit_html_attribute_value_node(node)
			super
			puts "HTML AttributeValueNode #{node.children.length}"
		end

		def visit_html_close_tag_node(node)
			puts "HTML CloseTagNode #{node.tag_name.value}"
			@output << "</#{node.tag_name.value}>"
		end

		def visit_html_text_node(node)
	    puts "HTML TextNode #{node.content}"
			@output << node.content
	  end
	end

  class Formatter
  	def self.format_file!(path)
   		content = File.read(path)
   	  result = Herb.parse_file(path)

      # output = Herb::Formatter.new.format(result.value)
      #

      visitor = FormatVisitor.new
      visitor.visit(result.value)

      File.write(path, visitor.output.join("\n"))
   	end

    attr_reader :options

    def initialize(options = {})
      @options = {
        indent_size: 2,
        max_line_length: 80,
        void_elements_style: :self_closing, # :self_closing or :html5
        attribute_quotes: :double,          # :double or :single
        erb_spacing: :compact              # :compact or :spaced
      }.merge(options)

      @indent_level = 0
      @current_line = ""
      @output = []
    end

    def format(cst)
      @output = []
      @indent_level = 0
      @current_line = ""

      visit(cst)

      # Handle any remaining text in the buffer
      append_line if @current_line.strip.length > 0

      @output.join("\n")
    end

    private

    # Helper methods

    def indent
      " " * (@indent_level * options[:indent_size])
    end

    def start_line
      if @current_line.strip.length > 0
        append_line
      end

      @current_line = indent
    end

    def append(text)
      @current_line += text.to_s

      # Handle line wrapping if needed
      if @current_line.length > options[:max_line_length]
        # Try to wrap at a sensible position
        # This is a simplified approach - a more complex formatter would
        # have better logic for line breaking
        append_line
        @current_line = indent + "  " # Extra indent for continuation
      end
    end

    def append_line
      @output << @current_line.rstrip
      @current_line = ""
    end

    def has_significant_content?(body)
      return false unless body && !body.empty?

      # Check if content has more than just whitespace
      body.any? do |child|
        if child.is_a?(HTMLTextNode)
          child.content.strip.length > 0
        else
          true
        end
      end
    end
  end
end
