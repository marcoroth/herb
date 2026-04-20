# frozen_string_literal: true
# typed: false

require "erb"
require "fileutils"
require "yaml"

module Herb
  module Template
    def self.underscore(name)
      name
        .gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2')
        .gsub(/([a-z\d])([A-Z])/, '\1_\2')
    end

    ALWAYS_INVISIBLE_FIELD_CLASSES = ["PrismContextField", "AnalyzedRubyField"].freeze
    CONDITIONALLY_INVISIBLE_FIELD_CLASSES = ["PrismSerializedField", "PrismNodeField"].freeze
    ALL_INVISIBLE_FIELD_CLASSES = (ALWAYS_INVISIBLE_FIELD_CLASSES + CONDITIONALLY_INVISIBLE_FIELD_CLASSES).freeze

    class Field
      attr_reader :name, :options

      def initialize(name:, **options)
        @name = name
        @options = options
      end

      def always_invisible?
        ALWAYS_INVISIBLE_FIELD_CLASSES.include?(self.class.name.split("::").last)
      end

      def conditionally_invisible?
        CONDITIONALLY_INVISIBLE_FIELD_CLASSES.include?(self.class.name.split("::").last)
      end

      def invisible?
        ALL_INVISIBLE_FIELD_CLASSES.include?(self.class.name.split("::").last)
      end
    end

    class FieldVisibility
      attr_reader :field, :prism_field_name

      def initialize(field:, static_last:, dynamic_last:, prism_field_name:)
        @field = field
        @static_last = static_last
        @dynamic_last = dynamic_last
        @prism_field_name = prism_field_name
      end

      def static_last?
        @static_last
      end

      def dynamic_last?
        @dynamic_last
      end

      def symbol
        @static_last ? "└── " : "├── "
      end

      def prefix
        @static_last ? "    " : "│   "
      end
    end

    class ArrayField < Field
      def initialize(kind:, **)
        @kind = kind
        super(**)
      end

      def ruby_type
        if specific_kind
          if specific_kind.end_with?("Node")
            "Array[Herb::AST::#{specific_kind}]"
          else
            "Array[#{specific_kind}]"
          end
        elsif union_kind
          "Array[(#{union_kind.map { |k| "Herb::AST::#{k}" }.join(" | ")})]"
        else
          "Array"
        end
      end

      def c_type
        "hb_array_T*"
      end

      def c_item_type
        if specific_kind
          "AST_#{Template.underscore(specific_kind).upcase}_T*"
        else
          "void*"
        end
      end

      def specific_kind
        @kind unless @kind.is_a?(Array)
      end

      def union_kind
        @kind if @kind.is_a?(Array)
      end
    end

    class NodeField < Field
      def initialize(kind:, **)
        @kind = kind
        super(**)
      end

      def c_type
        if specific_kind
          "struct AST_#{Template.underscore(specific_kind).upcase}_STRUCT*"
        else
          "AST_NODE_T*"
        end
      end

      def ruby_type
        if specific_kind
          "Herb::AST::#{specific_kind}"
        elsif union_kind
          "(#{union_kind.map { |k| "Herb::AST::#{k}" }.join(" | ")})"
        else
          "Herb::AST::Node"
        end
      end

      def specific_kind
        @kind unless @kind.is_a?(Array)
      end

      def union_kind
        @kind if @kind.is_a?(Array)
      end

      def union_type_name
        return nil unless union_kind

        union_kind.sort.join("Or")
      end

      def rust_type
        if specific_kind && specific_kind != "Node"
          "Option<Box<#{specific_kind}>>"
        elsif union_kind
          "Option<#{union_type_name}>"
        else
          "Option<Box<AnyNode>>"
        end
      end

      def java_type
        specific_kind || "Node" # Java uses base type for union_kind, could use sealed interface in future
      end
    end

    class BorrowedNodeField < NodeField
    end

    class TokenField < Field
      def ruby_type
        "Herb::Token"
      end

      def c_type
        "token_T*"
      end
    end

    class TokenTypeField < Field
      def ruby_type
        "String"
      end

      def c_type
        "token_type_T"
      end
    end

    class StringField < Field
      def ruby_type
        "String"
      end

      def c_type
        "hb_string_T"
      end
    end

    class PositionField < Field
      def ruby_type
        "Herb::Position"
      end

      def c_type
        "position_T"
      end
    end

    class LocationField < Field
      def ruby_type
        "Herb::Location"
      end

      def c_type
        "location_T*"
      end
    end

    class IntegerField < Field
      def ruby_type
        "Integer"
      end

      def c_type
        "const int"
      end
    end

    class SizeTField < Field
      def ruby_type
        "Integer"
      end

      def c_type
        "size_t"
      end
    end

    class BooleanField < Field
      def ruby_type
        "bool"
      end

      def c_type
        "bool"
      end
    end

    class PrismNodeField < Field
      def ruby_type
        "String"
      end

      def c_type
        "herb_prism_node_T"
      end

      def rust_type
        "Option<Vec<u8>>"
      end

      def java_type
        "byte[]"
      end

      def js_type
        "Uint8Array | null"
      end
    end

    class PrismContextField < Field
      def ruby_type
        "nil"
      end

      def c_type
        "herb_prism_context_T*"
      end
    end

    class VoidPointerField < Field
      def ruby_type
        "nil"
      end

      def c_type
        "void*"
      end
    end

    class AnalyzedRubyField < Field
      def ruby_type
        "nil"
      end

      def c_type
        "analyzed_ruby_T*"
      end
    end

    class PrismSerializedField < Field
      def ruby_type
        "String"
      end

      def c_type
        "prism_serialized_T"
      end

      def java_type
        "byte[]"
      end

      def rust_type
        "Option<Vec<u8>>"
      end

      def js_type
        "Uint8Array | null"
      end
    end

    class ElementSourceField < Field
      def ruby_type
        "String"
      end

      def c_type
        "hb_string_T"
      end
    end

    module ConfigType
      private

      def normalize_kind(kind, type, name, field_name)
        if kind
          kind = [kind] unless kind.is_a?(Array)

          kind = kind.first if kind.size == 1
        elsif type < NodeField
          raise "Missing kind in config.yml for field #{name}##{field_name}"
        end

        kind
      end

      def field_type_for(name)
        case name
        when "array"            then ArrayField
        when "node"             then NodeField
        when "borrowed_node"    then BorrowedNodeField
        when "token"            then TokenField
        when "token_type"       then TokenTypeField
        when "string"           then StringField
        when "position"         then PositionField
        when "location"         then LocationField
        when "size_t"           then SizeTField
        when "boolean"          then BooleanField
        when "prism_node"       then PrismNodeField
        when "prism_context"    then PrismContextField
        when "analyzed_ruby"    then AnalyzedRubyField
        when "prism_serialized" then PrismSerializedField
        when "element_source"   then ElementSourceField
        when "void*"            then VoidPointerField
        else raise("Unknown field type: #{name.inspect}")
        end
      end
    end

    class ErrorType
      include ConfigType

      attr_reader :name, :type, :struct_type, :struct_name, :human, :fields, :message_template, :message_arguments

      def initialize(config)
        @name = config.fetch("name")
        @message_template = config.dig("message", "template")
        @message_arguments = config.dig("message", "arguments")

        camelized = Template.underscore(@name)
        @type = camelized.upcase
        @struct_type = "#{camelized.upcase}_T"
        @struct_name = "#{camelized.upcase}_STRUCT"
        @human = camelized.downcase

        @fields = config.fetch("fields", []).map do |field|
          field_name = field.fetch("name")
          type = field_type_for(field.fetch("type"))
          kind = normalize_kind(field.fetch("kind", nil), type, @name, field_name)

          type.new(name: field_name, kind: kind)
        end
      end

      def c_type
        @struct_type
      end
    end

    class NodeType
      include ConfigType

      attr_reader :name, :type, :struct_type, :struct_name, :human, :fields

      def initialize(config)
        @name = config.fetch("name")
        camelized = Template.underscore(@name)
        @type = "AST_#{camelized.upcase}"
        @struct_type = "AST_#{camelized.upcase}_T"
        @struct_name = "AST_#{camelized.upcase}_STRUCT"
        @human = camelized.downcase

        @fields = config.fetch("fields", []).map do |field|
          field_name = field.fetch("name")
          type = field_type_for(field.fetch("type"))
          kind = normalize_kind(field.fetch("kind", nil), type, @name, field_name)

          type.new(name: field_name, kind: kind)
        end
      end

      def c_type
        @struct_type
      end

      def field_visibilities
        @field_visibilities ||= begin
          prism_fields = @fields.select(&:conditionally_invisible?)
          last_prism_field_name = prism_fields.last&.name

          @fields.each_with_index.map do |field, index|
            remaining = @fields[(index + 1)..] || []
            all_remaining_always_invisible = remaining.all?(&:always_invisible?)
            all_remaining_invisible = remaining.all?(&:invisible?)
            any_remaining_conditionally_invisible = remaining.any?(&:conditionally_invisible?)

            static_last = all_remaining_always_invisible
            dynamic_last = !static_last && all_remaining_invisible && any_remaining_conditionally_invisible

            FieldVisibility.new(
              field: field,
              static_last: static_last,
              dynamic_last: dynamic_last,
              prism_field_name: dynamic_last ? last_prism_field_name : nil
            )
          end
        end
      end

      def field_visibility(index)
        field_visibilities[index]
      end
    end

    def self.escape_string(string)
      string.to_s.gsub(/["\\]/) do |char|
        case char
        when "\\" then "\\\\"
        when '"'  then '\\"'
        else char
        end
      end
    end

    class HelperArgument
      attr_reader :name, :position, :type, :optional, :default, :splat, :description

      def initialize(config)
        @name = config.fetch("name")
        @position = config.fetch("position")
        @type = Array(config.fetch("type"))
        @optional = config.fetch("optional", false)
        @default = config.fetch("default", nil)
        @splat = config.fetch("splat", false)
        @description = config.fetch("description", "")
      end

      def type_display
        @type.join(" | ")
      end

      def escaped_description
        Template.escape_string(@description)
      end

      def escaped_default
        @default ? Template.escape_string(@default) : nil
      end
    end

    class HelperOption
      attr_reader :name, :type, :maps_to, :description

      def initialize(config)
        @name = config.fetch("name")
        @type = Array(config.fetch("type"))
        @maps_to = config.fetch("maps_to", nil)
        @description = config.fetch("description", "")
      end

      def type_display
        @type.join(" | ")
      end

      def escaped_description
        Template.escape_string(@description)
      end
    end

    class HelperImplicitAttribute
      attr_reader :name, :source, :source_with_block, :wrapper, :skip_wrapping_for,
                  :wrapper_quotes_arg

      def initialize(config)
        @name = config.fetch("name")
        @source = config.fetch("source")
        @source_with_block = config.fetch("source_with_block", nil)
        @wrapper = config.fetch("wrapper")
        @wrapper_quotes_arg = config.fetch("wrapper_quotes_arg", false)
        @skip_wrapping_for = config.fetch("skip_wrapping_for", [])
      end
    end

    class HelperContent
      attr_reader :source, :arg_position, :skip_if_hash, :to_s_suffix_when_single

      def initialize(config)
        @source = config.fetch("source")
        @arg_position = config.fetch("arg_position", nil)
        @skip_if_hash = config.fetch("skip_if_hash", false)
        @to_s_suffix_when_single = config.fetch("to_s_suffix_when_single", false)
      end

      def null?
        false
      end

      def first_arg?
        @source == "first_arg"
      end

      def block_or_arg?
        @source == "block_or_arg"
      end
    end

    class HelperSpecialBehavior
      attr_reader :type, :config

      def initialize(config)
        if config.is_a?(String)
          @type = config
          @config = {}
        else
          @type = config.fetch("type")
          @config = config
        end
      end

      def implied_attribute?
        @type == "implied_attribute"
      end

      def wrap_body?
        @type == "wrap_body"
      end

      def multiple_elements?
        @type == "multiple_elements"
      end

      def size_to_dimensions?
        @type == "size_to_dimensions"
      end

      def remove_non_html_options?
        @type == "remove_non_html_options"
      end

      def [](key)
        @config[key.to_s]
      end

      def to_s
        @type
      end
    end

    class HelperTagInfo
      attr_reader :name, :is_void, :preferred, :detect_style, :implicit_attribute

      def initialize(config)
        @name = config.fetch("name")
        @is_void = config.fetch("is_void", false)
        @preferred = config.fetch("preferred", false)
        @detect_style = config.fetch("detect_style", nil)

        implicit_config = config.fetch("implicit_attribute", nil)
        @implicit_attribute = implicit_config ? HelperImplicitAttribute.new(implicit_config) : nil
      end

      def preferred?
        @preferred
      end

      def implicit_attribute?
        !@implicit_attribute.nil?
      end

      def call_name_detect?
        @detect_style == "call_name"
      end

      def receiver_call_detect?
        @detect_style == "receiver_call"
      end
    end

    class HelperType
      attr_reader :name, :source, :gem, :output, :visibility, :supports_block,
                  :supported, :description, :signature, :documentation_url, :tag,
                  :content, :attributes_arg, :attributes_arg_with_block,
                  :transform_style, :custom_transform,
                  :arguments, :options, :special_behaviors, :aliases

      def initialize(config)
        @name = config.fetch("name")
        @source = config.fetch("source")
        @gem = config.fetch("gem")
        @output = config.fetch("output", "html")
        @visibility = config.fetch("visibility", "public")
        @supports_block = config.fetch("supports_block", false)
        @supported = config.fetch("supported", false)
        @description = config.fetch("description", "").strip
        @signature = config.fetch("signature")
        @documentation_url = config.fetch("documentation_url")

        tag_config = config.fetch("tag", nil)
        @tag = tag_config ? HelperTagInfo.new(tag_config) : nil

        content_config = config.fetch("content", nil)
        @content = content_config ? HelperContent.new(content_config) : nil

        @attributes_arg = config.fetch("attributes_arg", nil)
        @attributes_arg_with_block = config.fetch("attributes_arg_with_block", nil)
        @transform_style = config.fetch("transform_style", "generic")
        @custom_transform = config.fetch("custom_transform", nil)

        @arguments = (config.fetch("arguments", []) || []).map { |arg| HelperArgument.new(arg) }
        @options = (config.fetch("options", []) || []).map { |opt| HelperOption.new(opt) }

        raw_behaviors = config.fetch("special_behaviors", []) || []
        @special_behaviors = raw_behaviors.map { |b| HelperSpecialBehavior.new(b) }
        @aliases = config.fetch("aliases", []) || []
      end

      def tag_name
        @tag&.name
      end

      def void?
        @tag&.is_void || false
      end

      def preferred_for_tag
        @tag&.preferred || false
      end

      def detect_style
        @tag&.detect_style
      end

      def implicit_attribute
        @tag&.implicit_attribute
      end

      # "ActionView::Helpers::UrlHelper#link_to" => "UrlHelper"
      def module_name
        source.split("#").first.split("::").last
      end

      # "ActionView::Helpers::UrlHelper#link_to" => "url_helper"
      def module_key
        module_name.gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2').gsub(/([a-z\d])([A-Z])/, '\1_\2').downcase
      end

      # "link_to" => "link_to", "current_page?" => "current_page_p", "uncacheable!" => "uncacheable_bang"
      def safe_name
        name.gsub("?", "_p").gsub("!", "_bang")
      end

      # "link_to" => "LINK_TO", "current_page?" => "CURRENT_PAGE_P", "content_for?" => "CONTENT_FOR_P"
      def constant_name
        safe_name.upcase
      end

      # "link_to" => "LinkTo", "current_page?" => "CurrentPage"
      def camel_case_name
        safe_name.split("_").map(&:capitalize).join
      end

      # "link_to" => "linkTo", "current_page?" => "currentPage"
      def lower_camel_case_name
        parts = safe_name.split("_")

        parts.first + parts[1..].map(&:capitalize).join
      end

      def escaped_description
        Template.escape_string(@description)
      end

      def escaped_signature
        Template.escape_string(@signature)
      end

      def public?
        @visibility == "public"
      end

      def internal?
        @visibility == "internal"
      end

      def tag?
        !@tag.nil?
      end

      def preferred_for_tag?
        @tag&.preferred || false
      end

      def supported?
        @supported
      end

      def static_tag_name?
        !tag_name.nil?
      end

      def implicit_attribute?
        !implicit_attribute.nil?
      end

      def call_name_detect?
        @tag&.call_name_detect? || false
      end

      def receiver_call_detect?
        @tag&.receiver_call_detect? || false
      end

      def html_output?
        @output == "html"
      end

      def text_output?
        @output == "text"
      end

      def url_output?
        @output == "url"
      end

      def boolean_output?
        @output == "boolean"
      end

      def void_output?
        @output == "void"
      end

      def content?
        !@content.nil?
      end

      def generic_transform?
        @transform_style == "generic"
      end

      def custom_transform?
        @transform_style == "custom"
      end
    end

    class PrintfMessageTemplate
      MAX_STRING_SIZE = 128

      # Estimated sizes for different format specifiers
      ESTIMATED_SIZES = {
        "%s" => MAX_STRING_SIZE, # Strings are truncated
        "%d" => 11,  # INT_MAX is 10 digits + sign
        "%u" => 10,  # UINT_MAX fits in 10 digits
        "%zu" => 20,  # Large enough for size_t
        "%llu" => 20, # Large enough for long long unsigned
        "%ld" => 20, # Large enough for long int
        "%f" => 32,  # Floating point with precision
        "%lf" => 32, # Long double
      }.freeze

      def self.estimate_buffer_size(template)
        base_length = template.length
        total_size = base_length

        format_specifiers = template.scan(/%(?:zu|llu|lf|ld|[sdulf])/)

        format_specifiers.each_with_index do |specifier, _i|
          estimated_size = ESTIMATED_SIZES[specifier] || 16 # Default extra buffer
          total_size += estimated_size
        end

        total_size += 1 # Null terminator
        total_size
      end
    end

    def self.heading_for(file, template_file)
      case File.extname(file)
      when ".rb", ".rbs"
        <<~HEADING
          # frozen_string_literal: true
          # typed: true

          # NOTE: This file is generated by the templates/template.rb script and should not be
          # modified manually. See #{template_file}

        HEADING
      else
        <<~HEADING
          // NOTE: This file is generated by the templates/template.rb script and should not
          // be modified manually. See #{template_file}

        HEADING
      end
    end

    def self.check_gitignore(name)
      file = Pathname.new(name)
      file = file.absolute? ? file.relative_path_from(File.expand_path("../", __dir__)).to_s : file.to_s
      return if gitignore_lines.include?(file)

      puts "[WARNING]: make sure to add `#{file}` to the `.gitignore`"
      puts
    end

    def self.render(template_file)
      template_file_display = template_file.delete_prefix("#{File.expand_path("../", __dir__)}/")

      name = Pathname.new(template_file)
      name = if name.absolute?
               template_file.gsub(
                 "#{__dir__}/",
                 __dir__.delete_suffix("templates").to_s
               )
             else
               name.to_s.delete_prefix("templates/")
             end

      name = name.delete_suffix(".erb")

      destination = if Pathname.new(name).absolute?
                      Pathname.new(name)
                    else
                      Pathname.new(
                        File.expand_path("../#{name}", __dir__)
                      )
                    end

      template_file = Pathname.new(template_file)
      template_path = if template_file.absolute?
                        template_file
                      else
                        Pathname(
                          File.expand_path("../#{template_file}", __dir__)
                        )
                      end

      rendered_template = read_template(template_path.to_s).result_with_hash({ nodes: nodes, errors: errors, union_kinds: union_kinds, helpers: helpers })
      content = heading_for(name, template_file) + rendered_template

      check_gitignore(name)

      if File.exist?(destination)
        existing_content = File.read(destination, encoding: Encoding::UTF_8)

        if existing_content == content
          puts "[unchanged] #{destination}"
          return
        end
      end

      puts "Rendering #{template_file_display} → #{destination}"

      FileUtils.mkdir_p(File.dirname(destination))
      File.write(destination, content)
    rescue SyntaxError => e
      puts
      puts "Error while rendering #{template_file}:"
      puts e
      puts
    end

    def self.read_template(path)
      content = File.read(path, encoding: Encoding::UTF_8)

      ERB.new(content, trim_mode: "-").tap do |erb|
        erb.filename = path
      end
    end

    def self.gitignore_lines
      @gitignore_lines ||= File.readlines(".gitignore").map(&:chomp)
    rescue Errno::ENOENT
      puts "[Herb Templates] Couldn't find .gitignore"
      []
    end

    def self.nodes
      (config.dig("nodes", "types") || []).map { |node| NodeType.new(node) }
    end

    # Collect all unique union kinds from node fields
    def self.union_kinds
      union_kinds_set = Set.new

      nodes.each do |node|
        node.fields.each do |field|
          if field.respond_to?(:union_kind) && field.union_kind
            union_kinds_set.add(field.union_kind.sort)
          end
        end
      end

      union_kinds_set.to_a.sort
    end

    def self.errors
      (config.dig("errors", "types") || []).map { |node| ErrorType.new(node) }
    end

    def self.helpers
      Dir.glob("config/action_view_helpers/**/*.yml").map do |file|
        HelperType.new(YAML.load_file(file))
      end
    end

    def self.config
      YAML.load_file("config.yml")
    end
  end
end
