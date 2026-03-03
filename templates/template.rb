# frozen_string_literal: true
# typed: false

require "erb"
require "fileutils"
require "yaml"

module Herb
  module Template
    class Field
      attr_reader :name, :options

      def initialize(name:, **options)
        @name = name
        @options = options
      end
    end

    class ArrayField < Field
      def initialize(kind:, **options)
        @kind = kind
        super(**options)
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
          "AST_#{specific_kind.gsub(/(?<=[a-zA-Z])(?=[A-Z][a-z])/, "_").upcase}_T*"
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
      def initialize(kind:, **options)
        @kind = kind
        super(**options)
      end

      def c_type
        if specific_kind
          "struct AST_#{specific_kind.gsub(/(?<=[a-zA-Z])(?=[A-Z][a-z])/, "_").upcase}_STRUCT*"
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
        "const char*"
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
        "Prism::Node"
      end

      def c_type
        "pm_node_t*"
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

    class ElementSourceField < Field
      def ruby_type
        "String"
      end

      def c_type
        "element_source_t"
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
        when "array"          then ArrayField
        when "node"           then NodeField
        when "borrowed_node"  then BorrowedNodeField
        when "token"          then TokenField
        when "token_type"     then TokenTypeField
        when "string"         then StringField
        when "position"       then PositionField
        when "location"       then LocationField
        when "size_t"         then SizeTField
        when "boolean"        then BooleanField
        when "prism_node"     then PrismNodeField
        when "analyzed_ruby"  then AnalyzedRubyField
        when "element_source" then ElementSourceField
        when "void*"          then VoidPointerField
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

        camelized = @name.gsub(/(?<=[a-zA-Z])(?=[A-Z][a-z])/, "_")
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
        camelized = @name.gsub(/(?<=[a-zA-Z])(?=[A-Z][a-z])/, "_")
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

      rendered_template = read_template(template_path.to_s).result_with_hash({ nodes: nodes, errors: errors, union_kinds: union_kinds })
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

    def self.config
      YAML.load_file("config.yml")
    end
  end
end
