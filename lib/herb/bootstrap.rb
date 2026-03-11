# frozen_string_literal: true
# typed: false

require "fileutils"

module Herb
  module Bootstrap
    ROOT_PATH = File.expand_path("../..", __dir__)
    PRISM_VENDOR_DIR = File.join(ROOT_PATH, "vendor", "prism")

    PRISM_ENTRIES = [
      "config.yml",
      "Rakefile",
      "src/",
      "include/",
      "templates/"
    ].freeze

    def self.generate_templates
      require "pathname"
      require "set"
      require_relative "../../templates/template"

      Dir.chdir(ROOT_PATH) do
        Dir.glob("#{ROOT_PATH}/templates/**/*.erb").each do |template|
          Herb::Template.render(template)
        end
      end
    end

    def self.git_source?
      File.directory?(File.join(ROOT_PATH, ".git"))
    end

    def self.templates_generated?
      File.exist?(File.join(ROOT_PATH, "ext", "herb", "nodes.c"))
    end

    def self.vendor_prism(prism_gem_path:)
      FileUtils.mkdir_p(PRISM_VENDOR_DIR)

      PRISM_ENTRIES.each do |entry|
        source = File.join(prism_gem_path, entry)
        next unless File.exist?(source)

        puts "Vendoring '#{entry}' Prism file to #{PRISM_VENDOR_DIR}/#{entry}"
        FileUtils.cp_r(source, PRISM_VENDOR_DIR)
      end

      generate_prism_templates unless prism_ast_header_exists?
    end

    def self.prism_vendored?
      File.directory?(File.join(PRISM_VENDOR_DIR, "include"))
    end

    def self.prism_ast_header_exists?
      File.exist?(File.join(PRISM_VENDOR_DIR, "include", "prism", "ast.h"))
    end

    def self.find_prism_gem_path
      find_prism_as_bundler_sibling || find_prism_from_gem_spec
    end

    def self.generate_prism_templates
      puts "Generating Prism template files..."
      system("ruby", "#{PRISM_VENDOR_DIR}/templates/template.rb", exception: true)
    end

    def self.find_prism_as_bundler_sibling
      bundler_gems_dir = File.expand_path("..", ROOT_PATH)
      candidates = Dir.glob(File.join(bundler_gems_dir, "prism-*"))

      candidates.find { |path| File.directory?(File.join(path, "src")) }
    end

    def self.find_prism_from_gem_spec
      path = Gem::Specification.find_by_name("prism").full_gem_path

      return path if File.directory?(File.join(path, "src"))

      nil
    rescue Gem::MissingSpecError
      nil
    end
  end
end
