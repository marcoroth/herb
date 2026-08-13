# frozen_string_literal: true

require "fileutils"

module Herb
  class Highlighter
    class UnsupportedPlatformError < Error; end
    class ExecutableNotFoundError < Error; end
    class CompilationError < Error; end

    EXECUTABLE_NAME = "herb-highlight"

    NATIVE_PLATFORMS = {
      "arm64-darwin" => "arm64-darwin",
      "x86_64-darwin" => "x86_64-darwin",
      "aarch64-linux" => "aarch64-linux-gnu",
      "arm64-linux" => "aarch64-linux-gnu",
      "x86_64-linux" => "x86_64-linux-gnu",
    }.freeze

    GEM_ROOT = File.expand_path("../../..", __dir__)

    class << self
      def executable(exe_path: nil)
        if exe_path
          return exe_path if File.executable?(exe_path)

          raise ExecutableNotFoundError, "herb-highlight executable not found at #{exe_path}"
        end

        if ENV["HERB_HIGHLIGHTER_INSTALL_DIR"]
          install_dir_exe = File.join(ENV.fetch("HERB_HIGHLIGHTER_INSTALL_DIR"), EXECUTABLE_NAME)

          return install_dir_exe if File.executable?(install_dir_exe)

          raise ExecutableNotFoundError, "herb-highlight executable not found at #{install_dir_exe} (set by HERB_HIGHLIGHTER_INSTALL_DIR)"
        end

        exe_directory = NATIVE_PLATFORMS[platform_key]

        if exe_directory
          exe_file = File.join(GEM_ROOT, "exe", exe_directory, EXECUTABLE_NAME)

          return exe_file if File.executable?(exe_file)
        end

        compiled = compile_from_source

        return compiled if compiled

        raise ExecutableNotFoundError, "herb-highlight executable not found at exe/#{exe_directory}/#{EXECUTABLE_NAME}. Try reinstalling the gem: gem install herb-highlighter" if exe_directory

        raise UnsupportedPlatformError,
              "herb-highlighter does not have a precompiled binary for #{platform_key}. " \
              "Install Rust (https://rustup.rs) and reinstall the gem to compile from source, " \
              "or set HERB_HIGHLIGHTER_INSTALL_DIR to use a custom binary."
      end

      private

      def platform_key
        platform = Gem::Platform.local

        "#{platform.cpu}-#{platform.os}"
      end

      def compile_from_source
        rust_dir = File.join(GEM_ROOT, "rust")

        return nil unless File.exist?(File.join(rust_dir, "Cargo.toml"))
        return nil unless system("cargo --version > /dev/null 2>&1")

        exe_directory = File.join(GEM_ROOT, "exe", platform_key)
        exe_file = File.join(exe_directory, EXECUTABLE_NAME)

        return exe_file if File.executable?(exe_file)

        warn "herb-highlighter: No precompiled binary found. Compiling from source..."

        FileUtils.mkdir_p(exe_directory)

        unless system("cd #{rust_dir} && cargo build --release")
          raise CompilationError, "Failed to compile herb-highlight from source. Is Rust installed?"
        end

        source_binary = File.join(rust_dir, "target", "release", EXECUTABLE_NAME)

        raise CompilationError, "Compiled herb-highlight binary not found at #{source_binary}" unless File.exist?(source_binary)

        FileUtils.cp(source_binary, exe_file)
        FileUtils.chmod(0o755, exe_file)

        exe_file
      end
    end
  end
end
