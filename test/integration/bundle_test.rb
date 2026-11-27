# frozen_string_literal: true

require_relative "../test_helper"

require "bundler"
require "fileutils"
require "open3"
require "tmpdir"

class BundleTest < Minitest::Spec
  test "analyze works in a bundle that only declares herb" do
    Dir.mktmpdir("herb_bundle_test") do |directory|
      root = File.expand_path("../..", __dir__)
      File.write(File.join(directory, "Gemfile"), <<~GEMFILE)
        source "https://rubygems.org"
        gem "herb", path: #{root.dump}
      GEMFILE
      FileUtils.mkdir_p(File.join(directory, "app/views"))
      File.write(File.join(directory, "app/views/index.html.erb"), "<h1>Hello</h1>\n")

      Bundler.with_unbundled_env do
        environment = {
          "BUNDLE_GEMFILE" => File.join(directory, "Gemfile"),
          "BUNDLE_IGNORE_CONFIG" => "true",
          "GEM_PATH" => Gem.path.join(File::PATH_SEPARATOR),
        }

        output, status = Open3.capture2e(environment, Gem.ruby, "-S", "bundle", "lock", "--local", chdir: directory)
        assert status.success?, output

        output, status = Open3.capture2e(environment, Gem.ruby, "-S", "bundle", "exec", Gem.ruby, File.join(root, "exe/herb"), "analyze", ".", chdir: directory)
        assert status.success?, output
        assert_match "1 parsed", output
        assert_match "1 compiled", output
      end
    end
  end
end
