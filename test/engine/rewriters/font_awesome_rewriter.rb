# frozen_string_literal: true

module Herb
  module Rewriters
    class FontAwesomeRewriter < Rewriter
      def self.transformer_name
        "font-awesome"
      end

      def self.description
        "Transforms fa() and fa_icon() helper calls to FontAwesome <i> elements"
      end

      def self.matches
        ["fa", "fa_icon"]
      end

      def transform(_erb_node, context)
        icon = context.first_string_argument
        return nil unless icon

        keyword_arguments = context.keyword_arguments
        classes = ["fa", "fa-#{icon}"]

        if keyword_arguments["class"]
          extra_class = extract_static_value(keyword_arguments["class"])
          classes << extra_class if extra_class
        end

        attributes = [build_attribute("class", classes.join(" "))]

        keyword_arguments.each do |key, value_node|
          next if key == "class"

          static_value = extract_static_value(value_node)

          if static_value
            attributes << build_attribute(key.tr("_", "-"), static_value)
          else
            ruby_source = value_node.location.slice
            attributes << build_attribute_with_erb(key.tr("_", "-"), ruby_source)
          end
        end

        build_element(
          tag_name: "i",
          attributes: attributes,
          body: context.body,
          element_source: "FontAwesome"
        )
      end

      private

      def extract_static_value(prism_value_node)
        case prism_value_node
        when Prism::StringNode, Prism::SymbolNode then prism_value_node.unescaped
        when Prism::TrueNode then "true"
        when Prism::FalseNode then "false"
        when Prism::IntegerNode then prism_value_node.value.to_s
        end
      end
    end
  end
end
