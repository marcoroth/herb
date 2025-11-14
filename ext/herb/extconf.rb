# frozen_string_literal: true

require "mkmf"
require "bundler"
require "fileutils"

def vendor_prism(prism_vendor_path)
  prism_header = File.join(prism_vendor_path, "include", "prism.h")
  return if File.exist?(prism_header)

  prism_spec = Gem::Specification.find_by_name("prism")
rescue Gem::LoadError
  abort <<~MSG
    Prism could not be found.
    Herb requires Prism when building from source. Please add `gem "prism"` to your Gemfile.
  MSG
else
  prism_bundle_path = prism_spec.full_gem_path

  files = %w[
    config.yml
    Rakefile
    src
    include
    templates
  ]

  FileUtils.mkdir_p(prism_vendor_path)

  files.each do |file|
    source = File.join(prism_bundle_path, file)
    next unless File.exist?(source)

    destination = File.join(prism_vendor_path, file)

    if File.directory?(source)
      FileUtils.mkdir_p(destination)
      FileUtils.cp_r(File.join(source, "."), destination, remove_destination: true)
    else
      FileUtils.mkdir_p(File.dirname(destination))
      FileUtils.cp(source, destination)
    end
  end
end

Dir.chdir(File.expand_path("../..", __dir__)) do
  Bundler.with_unbundled_env do
    vendor_prism(File.expand_path("../../vendor/prism", __dir__))
    system("rake templates", exception: true)
  end
end

extension_name = "herb"

include_path = File.expand_path("../../src/include", __dir__)
prism_path = File.expand_path("../../vendor/prism", __dir__)

prism_src_path = "#{prism_path}/src"
prism_include_path = "#{prism_path}/include"

$VPATH << "$(srcdir)/../../src"
$VPATH << "$(srcdir)/../../src/util"
$VPATH << prism_src_path
$VPATH << "#{prism_src_path}/util"

$INCFLAGS << " -I#{prism_include_path}"
$INCFLAGS << " -I#{include_path}"
$INCFLAGS << " -I#{prism_src_path}"
$INCFLAGS << " -I#{prism_src_path}/util"

$CFLAGS << " -DPRISM_EXPORT_SYMBOLS=static "

herb_src_files = Dir.glob("#{$srcdir}/../../src/**/*.c").map { |file| file.delete_prefix("../../../../ext/herb/") }.sort

prism_main_files = %w[
  diagnostic.c
  encoding.c
  node.c
  options.c
  pack.c
  prettyprint.c
  prism.c
  regexp.c
  serialize.c
  static_literals.c
  token_type.c
]

prism_util_files = %w[
  pm_buffer.c
  pm_char.c
  pm_constant_pool.c
  pm_integer.c
  pm_list.c
  pm_memchr.c
  pm_newline_list.c
  pm_string.c
  pm_strncasecmp.c
  pm_strpbrk.c
]

core_src_files = %w[
  extension.c
  nodes.c
  error_helpers.c
  extension_helpers.c
]

$srcs = core_src_files + herb_src_files + prism_main_files + prism_util_files

puts "Sources to be compiled: #{$srcs.inspect}"

abort("could not find prism.h") unless find_header("prism.h")
abort("could not find herb.h") unless find_header("herb.h")

abort("could not find nodes.h (run `ruby templates/template.rb` to generate the file)") unless find_header("nodes.h")
abort("could not find extension.h") unless find_header("extension.h")
abort("could not find extension_helpers.h") unless find_header("extension_helpers.h")

create_header
create_makefile("#{extension_name}/#{extension_name}")
