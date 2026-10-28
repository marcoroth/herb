# frozen_string_literal: true

#
# Standalone executables for the JavaScript tools, distributed as gems so they can be
# used without Node.js. The binaries are compiled with `bun build --compile` and
# packaged as platform-specific gems, plus a plain `ruby` gem for unsupported platforms.
#
#   bundle exec rake standalone:compile[herb-linter,arm64-darwin]
#   bundle exec rake standalone:gem[herb-linter,arm64-darwin]
#   bundle exec rake standalone:gems
#
# The JavaScript packages and their dependencies need to be built first:
#
#   yarn nx run-many -t build -p @herb-tools/linter @herb-tools/formatter @herb-tools/highlighter
#
# The musl executables also need `curl` and `patchelf`.
#

require "digest"
require "erb"
require "fileutils"
require "rubygems/package"

module Standalone
  ROOT = File.expand_path("..", __dir__)
  BUILD_DIR = File.join(ROOT, "tmp", "standalone")
  PACKAGE_DIR = File.join(ROOT, "pkg")
  TEMPLATES_DIR = File.join(__dir__, "standalone")

  TOOLS = {
    "herb-linter" => {
      executable: "herb-lint",
      package: "linter",
      entrypoints: ["src/standalone/herb-lint.ts", "src/standalone/lint-worker.ts"],
      summary: "HTML+ERB linter for validating HTML structure and enforcing best practices",
      description: "The Herb Linter validates HTML+ERB templates against a set of configurable rules to enforce best practices and catch common errors.",
    },
    "herb-formatter" => {
      executable: "herb-format",
      package: "formatter",
      entrypoints: ["src/standalone/herb-format.ts"],
      summary: "Auto-formatter for HTML+ERB templates",
      description: "The Herb Formatter formats HTML+ERB templates with intelligent indentation, line wrapping, and ERB-aware pretty-printing.",
    },
    "herb-highlighter" => {
      executable: "herb-highlight",
      package: "highlighter",
      entrypoints: ["src/herb-highlight.ts"],
      summary: "Syntax highlighter for HTML+ERB templates",
      description: "The Herb Highlighter prints syntax highlighted HTML+ERB templates to the terminal.",
    },
  }.freeze

  # RubyGems platform => Bun compile target
  PLATFORMS = {
    "arm64-darwin" => "bun-darwin-arm64",
    "x86_64-darwin" => "bun-darwin-x64",
    "aarch64-linux-gnu" => "bun-linux-arm64",
    "aarch64-linux-musl" => "bun-linux-arm64-musl",
    "x86_64-linux-gnu" => "bun-linux-x64",
    "x86_64-linux-musl" => "bun-linux-x64-musl",
    "x64-mingw-ucrt" => "bun-windows-x64",
  }.freeze

  # The musl executables link against libstdc++, which Alpine Linux doesn't install by default.
  # The gems bundle it and libgcc from Alpine's packages in libexec/lib, where the executables
  # find them through their RUNPATH.
  MUSL_RUNTIME_URL = "https://dl-cdn.alpinelinux.org/alpine/v3.22/main"
  MUSL_RUNTIME_VERSION = "14.2.0-r6"
  MUSL_RUNTIME_LIBRARIES = ["usr/lib/libstdc++.so.6", "usr/lib/libgcc_s.so.1"].freeze

  # Architecture => { package => SHA256 }
  MUSL_RUNTIME_PACKAGES = {
    "aarch64" => {
      "libstdc++" => "0d2f054057a4f932e985a129eccb79908b40964185139a0a609aed3032aba064",
      "libgcc" => "ba1835eec3ad8a120efd3d5020e561d53553a0513763a08f509e3ce6d4baa9ca",
    },
    "x86_64" => {
      "libstdc++" => "939f7c99898f3e8154207a17f4acbe8bc40437e1bb1b43f5525620ca9e452a2e",
      "libgcc" => "04f3467bc967e705221a843fe4d3de5850db826e571686e0c0ed453d38cb5c59",
    },
  }.freeze

  module_function

  def tool(name)
    TOOLS.fetch(name) { abort "Unknown tool '#{name}'. Available: #{TOOLS.keys.join(", ")}" }
  end

  def bun_target(platform)
    PLATFORMS.fetch(platform) { abort "Unsupported platform '#{platform}'. Available: #{PLATFORMS.keys.join(", ")}" }
  end

  def windows?(platform)
    platform.include?("mingw")
  end

  def musl?(platform)
    platform.to_s.end_with?("-musl")
  end

  # Downloads libstdc++ and libgcc from Alpine Linux for the architecture of `platform`.
  def musl_runtime(platform)
    architecture = platform.split("-").first
    directory = File.join(BUILD_DIR, "musl", architecture)
    libraries = MUSL_RUNTIME_LIBRARIES.map { |library| File.join(directory, File.basename(library)) }

    unless libraries.all? { |library| File.exist?(library) }
      MUSL_RUNTIME_PACKAGES.fetch(architecture).each do |package, checksum|
        extracted = download_alpine_package(directory, architecture, package, checksum)

        MUSL_RUNTIME_LIBRARIES.each do |library|
          FileUtils.cp(File.join(extracted, library), directory) if File.exist?(File.join(extracted, library))
        end
      end
    end

    libraries
  end

  def download_alpine_package(directory, architecture, package, checksum)
    url = "#{MUSL_RUNTIME_URL}/#{architecture}/#{package}-#{MUSL_RUNTIME_VERSION}.apk"
    archive = File.join(directory, File.basename(url))
    extracted = File.join(directory, package)

    FileUtils.mkdir_p(extracted)
    sh_command("curl", "--fail", "--silent", "--show-error", "--location", "--output", archive, url)

    actual = Digest::SHA256.file(archive).hexdigest
    abort "Checksum mismatch for #{url}: expected #{checksum}, got #{actual}" unless actual == checksum

    sh_command("tar", "-xzf", archive, "-C", extracted)
    extracted
  end

  def executable_filename(name, platform)
    executable = tool(name)[:executable]

    windows?(platform) ? "#{executable}.exe" : executable
  end

  def binary_path(name, platform)
    File.join(BUILD_DIR, "bin", platform, executable_filename(name, platform))
  end

  def compile(name, platform)
    tool = tool(name)
    package_dir = File.join(ROOT, "javascript", "packages", tool[:package])
    output = binary_path(name, platform)

    FileUtils.mkdir_p(File.dirname(output))

    Dir.chdir(package_dir) do
      sh_command(
        "bun", "build", "--compile",
        "--target=#{bun_target(platform)}",
        *tool[:entrypoints],
        "--outfile", output
      )
    end

    sh_command("patchelf", "--set-rpath", "$ORIGIN/lib", output) if musl?(platform)

    output
  end

  def template(filename, **locals)
    ERB.new(File.read(File.join(TEMPLATES_DIR, filename))).result_with_hash(locals)
  end

  # Builds the gem for `platform`, or the plain `ruby` gem without an executable when `platform` is nil.
  def build_gem(name, platform = nil)
    staging = stage_gem(name, platform)
    gem_file = Dir.chdir(staging) { Gem::Package.build(gemspec(name, platform, staging)) }
    destination = File.join(PACKAGE_DIR, gem_file)

    FileUtils.mkdir_p(PACKAGE_DIR)
    FileUtils.mv(File.join(staging, gem_file), destination)

    puts "Built #{destination}"
    destination
  end

  def stage_gem(name, platform)
    staging = File.join(BUILD_DIR, "gems", "#{name}-#{platform || "ruby"}")
    executable = File.join(staging, "exe", tool(name)[:executable])

    FileUtils.rm_rf(staging)
    FileUtils.mkdir_p(File.dirname(executable))
    FileUtils.cp(File.join(TEMPLATES_DIR, "exe.rb"), executable)
    FileUtils.cp(File.join(ROOT, "LICENSE.txt"), staging)
    File.write(File.join(staging, "README.md"), template("README.md.erb", name: name, tool: tool(name)))

    stage_executable(staging, name, platform) if platform
    staging
  end

  def stage_executable(staging, name, platform)
    libexec = File.join(staging, "libexec")

    FileUtils.mkdir_p(libexec)
    FileUtils.cp(binary_path(name, platform), libexec)

    return unless musl?(platform)

    FileUtils.mkdir_p(File.join(libexec, "lib"))
    FileUtils.cp(musl_runtime(platform), File.join(libexec, "lib"))
    File.write(File.join(libexec, "lib", "NOTICE"), template("NOTICE.erb", version: MUSL_RUNTIME_VERSION, url: MUSL_RUNTIME_URL))
  end

  def gemspec(name, platform, staging)
    tool = tool(name)
    herb = Gem::Specification.load(File.join(ROOT, "herb.gemspec"))

    Gem::Specification.new do |s|
      s.name = name
      s.version = herb.version
      s.platform = platform || Gem::Platform::RUBY
      s.authors = herb.authors
      s.email = herb.email
      s.summary = tool[:summary]
      s.description = tool[:description]
      s.homepage = herb.homepage
      s.metadata = herb.metadata.dup
      s.required_ruby_version = herb.required_ruby_version
      s.licenses = musl?(platform) ? ["MIT", "GPL-3.0-or-later WITH GCC-exception-3.1"] : ["MIT"]

      s.files = Dir.chdir(staging) { Dir["{exe,libexec}/**/*", "LICENSE.txt", "README.md"].select { |file| File.file?(file) } }
      s.bindir = "exe"
      s.executables = [tool[:executable]]
    end
  end

  def sh_command(*command)
    puts command.join(" ")
    system(*command) || abort("Command failed: #{command.join(" ")}")
  end
end

namespace :standalone do
  desc "Compile the standalone executable of a tool for a platform"
  task :compile, [:tool, :platform] do |_task, args|
    Standalone.compile(args.fetch(:tool), args.fetch(:platform))
  end

  desc "Build the gem of a tool for a platform, or the plain ruby gem when no platform is given"
  task :gem, [:tool, :platform] do |_task, args|
    name = args.fetch(:tool)
    platform = args[:platform]

    Standalone.compile(name, platform) if platform
    Standalone.build_gem(name, platform)
  end

  desc "Build the gems of all tools for all platforms (or the platforms in PLATFORMS, comma-separated)"
  task :gems do
    platforms = ENV["PLATFORMS"] ? ENV["PLATFORMS"].split(",") : Standalone::PLATFORMS.keys

    Standalone::TOOLS.each_key do |name|
      Standalone.build_gem(name)

      platforms.each do |platform|
        Standalone.compile(name, platform)
        Standalone.build_gem(name, platform)
      end
    end
  end

  desc "Remove compiled standalone executables and staged gems"
  task :clean do
    FileUtils.rm_rf(Standalone::BUILD_DIR)
  end
end
