# frozen_string_literal: true
# typed: ignore

require "tempfile"
require "yaml"

module Herb
  module Rubocop
    class Configuration
      attr_reader :project_root

      def initialize(herb_configuration)
        @herb_configuration = herb_configuration
        @config = herb_configuration.rubocop
        @project_root = File.expand_path(herb_configuration.project_root || Dir.pwd)
      end

      def enabled?
        @config.fetch("enabled", false)
      end

      def only
        @config["only"]
      end

      def rubocop_config
        @config["rubocop_config"] || {}
      end

      def config_file_path
        path = @config["config_file_path"]
        path && File.expand_path(path, project_root)
      end

      def load
        require_rubocop!
        load_config
      end

      private

      def load_config
        custom_config = Dir.chdir(project_root) do
          if config_file_path
            ::RuboCop::ConfigLoader.load_file(config_file_path)
          else
            config_from_hash(rubocop_config)
          end
        end

        ::RuboCop::ConfigLoader.merge_with_default(custom_config, config_file_path || "")
      rescue ::RuboCop::Error, Psych::Exception, Errno::ENOENT, Errno::EACCES => e
        raise Error, e.message
      end

      def config_from_hash(config)
        Tempfile.create([".herb-rubocop", ".yml"], project_root) do |file|
          file.write(config.to_yaml)
          file.flush

          return ::RuboCop::ConfigLoader.load_file(file.path)
        end
      end

      def require_rubocop!
        require "rubocop"
      rescue LoadError
        raise LoadError, <<~MESSAGE
          RuboCop is required for `herb rubocop`.

          Add it to your bundle:
            bundle add rubocop
        MESSAGE
      end
    end
  end
end
