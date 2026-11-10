# frozen_string_literal: true
# typed: ignore

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

    CFLAGS = [
      "-fvisibility=hidden", "-DHERB_EXCLUDE_PRETTYPRINT", "-DPRISM_EXCLUDE_PRETTYPRINT", "-DPRISM_EXCLUDE_JSON",
      "-DPRISM_EXCLUDE_PACK"
    ].freeze

    FFI_CFLAGS = [
      "-O2", "-fPIC", "-std=gnu99", "-DHERB_EXPORT_SYMBOLS", *CFLAGS, "-Isrc/include", "-Ivendor/prism/include"
    ].freeze

    def self.git_build_cflags
      sha = `git -C #{ROOT_PATH} rev-parse --short HEAD 2>/dev/null`.strip

      sha.empty? ? ["-DHERB_GIT_BUILD"] : ["-DHERB_GIT_BUILD", "-DHERB_GIT_SHA=\"#{sha}\""]
    end

    def self.build_ffi_library(cc: ENV.fetch("CC", "cc"), cflags: [])
      require "shellwords"

      compiler = Shellwords.split(cc)

      Dir.chdir(ROOT_PATH) do
        raise "ffi/serialize.c is missing, generate the templates first" unless File.exist?("ffi/serialize.c")

        objects = compile_ffi_objects(compiler, cflags, File.join("build", "ffi_obj"))
        library = File.join("build", "libherb_ffi.#{shared_library_extension}")
        system(*compiler, "-shared", *objects, "-o", library, exception: true)

        File.join(ROOT_PATH, library)
      end
    end

    def self.compile_ffi_objects(compiler, cflags, object_dir)
      FileUtils.rm_rf(object_dir)
      FileUtils.mkdir_p(object_dir)

      sources = ["src", "vendor/prism/src", "ffi"].flat_map { |dir| Dir.glob("#{dir}/**/*.c") } - ["src/main.c"]

      sources.sort.map do |source|
        object = File.join(object_dir, "#{source.tr("/", "_")}.o")
        system(*compiler, "-c", *FFI_CFLAGS, *cflags, source, "-o", object, exception: true)
        object
      end
    end

    def self.shared_library_extension
      require "rbconfig"

      RbConfig::CONFIG["SOEXT"] || (RbConfig::CONFIG["host_os"].include?("darwin") ? "dylib" : "so")
    end

    def self.generate_templates
      require "pathname"
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
      [
        ["ext", "herb", "nodes.c"],
        ["ffi", "serialize.c"],
        ["lib", "herb", "ffi", "deserialize.rb"]
      ].all? { |path| File.exist?(File.join(ROOT_PATH, *path)) }
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

      candidates.find { |path| prism_source?(path) }
    end

    def self.prism_source?(path)
      File.directory?(File.join(path, "src")) && File.exist?(File.join(path, "config.yml"))
    end

    def self.find_prism_from_gem_spec
      Gem::Specification.find_all_by_name("prism")
                        .map(&:full_gem_path)
                        .find { |path| prism_source?(path) }
    end
  end
end
