# frozen_string_literal: true

module Herb
  class Configuration
    # Lossless mutation of `.herb.yml` backed by yerba.
    #
    # Every write is expressed as a partial config hash that gets merged into the
    # existing document node-by-node, so comments, quote styles, blank lines and
    # key ordering all survive untouched.
    #
    # This mirrors `rust/herb-config/src/mutation.rs` so both implementations stay
    # in sync until the CLI moves to the Rust crate.
    class Mutation
      class Error < StandardError; end

      class MissingDependencyError < Error
        def initialize
          super(<<~MESSAGE.strip)
            The `yerba` gem is required to modify #{CONFIG_FILENAMES.first}.

            Add it to your Gemfile:

              gem "yerba"

            Then run `bundle install` and try again.
          MESSAGE
        end
      end

      class << self
        # Whether the optional yerba dependency is installed.
        #: () -> bool
        def available?
          require "yerba"
          true
        rescue LoadError
          false
        end

        #: () -> void
        def require_yerba!
          require "yerba"
        rescue LoadError
          raise MissingDependencyError
        end

        # Apply a partial config to a YAML string and return the result.
        #: (String, Hash[untyped, untyped]) -> String
        def apply_to_yaml_string(yaml, partial)
          new(yaml).merge(partial).to_yaml
        end

        # Read, mutate and write back an existing config file.
        #
        # Creating a config file from scratch is deliberately not handled here: the
        # commented template lives in the config JavaScript package and isn't shipped
        # with the gem yet.
        #: (String | Pathname, Hash[untyped, untyped]) -> String
        def mutate_config_file(config_path, partial)
          path = config_path.to_s

          raise Error, "no configuration file at #{path}" unless File.exist?(path)

          contents = apply_to_yaml_string(File.read(path), partial)

          File.write(path, contents)

          contents
        end
      end

      attr_reader :document #: untyped

      #: (String) -> void
      def initialize(yaml)
        self.class.require_yerba!

        @document = Yerba.parse(yaml)
      rescue Yerba::Error => e
        raise Error, "failed to parse configuration: #{e.message}"
      end

      # Deep-merge a partial config into the document.
      #
      # Existing scalars are updated in place; missing branches are inserted whole
      # as block YAML so nested maps keep their structure.
      #: (Hash[untyped, untyped]) -> self
      def merge(partial)
        apply_partial(partial, "")

        self
      end

      # Set a single dotted path to a scalar value.
      #: (String, untyped) -> self
      def set(path, value)
        merge(nest(path, value))
      end

      # Remove a dotted path, pruning any containers it leaves empty.
      #: (String) -> self
      def unset(path)
        return self unless exists?(path)

        delete(path)

        parent = parent_path(path)
        prune_empty_containers(parent) if parent

        self
      end

      # Append a value to the sequence at a dotted path, creating it when missing.
      #
      # Appending a value that is already present is a no-op, so the command is
      # safe to run repeatedly.
      #: (String, untyped) -> self
      def append(path, value)
        current = sequence_at(path)

        return self if current&.include?(value)

        if current
          quote_style = detect_sequence_quote_style(path)

          document.insert(path, value)
          document.set_quote_style("#{path}[#{current.length}]", quote_style) if quote_style
        else
          merge(nest(path, [value]))
        end

        self
      end

      # Remove a value from the sequence at a dotted path.
      #: (String, untyped) -> self
      def remove(path, value)
        current = sequence_at(path)

        return self unless current&.include?(value)

        document.remove(path, value)
        prune_empty_containers(path)

        self
      end

      #: (String) -> bool
      def exists?(path)
        document.exists?(path)
      end

      #: (String) -> untyped
      def value_at(path)
        return nil unless exists?(path)

        document.value_at(path)
      end

      #: () -> String
      def to_yaml
        document.to_yaml
      end

      #: (String | Pathname) -> String
      def save!(path)
        contents = to_yaml

        File.write(path.to_s, contents)

        contents
      end

      private

      # Mirrors `apply_mutation_to_document` in mutation.rs.
      #: (Hash[untyped, untyped], String) -> void
      def apply_partial(partial, prefix)
        partial.each do |key, value|
          path = prefix.empty? ? key.to_s : "#{prefix}.#{key}"

          case value
          when Hash
            if exists?(path)
              apply_partial(value, path)
            else
              insert_value(path, value)
            end
          when Array
            # Block collections can't overwrite an existing node in place, so an
            # existing sequence is replaced by removing it first.
            delete(path) if exists?(path)

            insert_value(path, value)
          else
            set_or_insert(path, value)
          end
        end
      end

      #: (String, untyped) -> void
      def set_or_insert(path, value)
        if exists?(path)
          document.set(path, value)
        else
          document.insert(path, value)
        end
      rescue Yerba::Error => e
        raise Error, "failed to write `#{path}`: #{e.message}"
      end

      # Insert a whole subtree as block YAML.
      #
      # The trailing newline is load-bearing: without it yerba treats the text as a
      # scalar string and writes `key: "enabled: false"` instead of a nested map.
      #: (String, untyped) -> void
      def insert_value(path, value)
        text = Yerba::Formatting.to_block_yaml_value(value)
        text += "\n" unless text.end_with?("\n")

        document.insert(path, text)
      rescue Yerba::Error => e
        raise Error, "failed to insert `#{path}`: #{e.message}"
      end

      #: (String) -> void
      def delete(path)
        document.delete(path)
      rescue Yerba::Error => e
        raise Error, "failed to delete `#{path}`: #{e.message}"
      end

      # Turn "linter.rules.foo.enabled" + value into a nested partial hash.
      #: (String, untyped) -> Hash[String, untyped]
      def nest(path, value)
        path.split(".").reverse.reduce(value) { |accumulator, key| { key => accumulator } }
      end

      #: (String) -> Array[untyped]?
      def sequence_at(path)
        value = value_at(path)

        value.is_a?(Array) ? value : nil
      end

      # New sequence entries inherit the quote style already used in the file, so
      # appending to a list of single-quoted globs doesn't produce a mixed style.
      #: (String) -> Symbol?
      def detect_sequence_quote_style(path)
        document.get_quote_style("#{path}[0]")
      rescue Yerba::Error
        nil
      end

      # Drop containers that only became empty because of the write we just made,
      # walking outwards until a container still holds something.
      #: (String) -> void
      def prune_empty_containers(path)
        segments = path.split(".")

        until segments.empty?
          candidate = segments.join(".")
          value = value_at(candidate)

          break unless (value.is_a?(Hash) || value.is_a?(Array)) && value.empty?

          delete(candidate)
          segments.pop
        end
      end

      #: (String) -> String?
      def parent_path(path)
        segments = path.split(".")

        return nil if segments.length < 2

        segments[0..-2].join(".")
      end
    end
  end
end
