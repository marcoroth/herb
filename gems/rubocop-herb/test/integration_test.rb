# frozen_string_literal: true

require_relative "test_helper"

class RuboCopHerbIntegrationTest < Minitest::Spec
  include RuboCopHerbTestHelpers

  def setup
    @directory = Dir.mktmpdir("rubocop-herb")
  end

  def teardown
    FileUtils.remove_entry(@directory)
  end

  test "runs configured built-in and custom cops on ERB Ruby" do
    write("custom_cop.rb", <<~RUBY)
      module RuboCop
        module Cop
          module HerbTest
            class NoFoo < Base
              MSG = "Do not call foo."

              def on_send(node)
                add_offense(node) if node.method_name == :foo
              end
            end
          end
        end
      end
    RUBY
    write_config(<<~YAML)
      require:
        - ./custom_cop
      Layout/SpaceAroundOperators:
        Enabled: true
      HerbTest/NoFoo:
        Enabled: true
    YAML
    write("example.html.erb", "<p>Café <%= foo(x=1) %></p>\n")

    output, error, status = run_rubocop("example.html.erb", chdir: @directory)

    refute status.success?
    assert_empty error
    assert_includes output, "Layout/SpaceAroundOperators"
    assert_includes output, "HerbTest/NoFoo"
    assert_includes output, "example.html.erb:1:13"
  end

  test "autocorrects only the embedded Ruby" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.html.erb", "<div>Café <%= x=1 %></div>\n")

    _output, error, status = run_rubocop("-a", "example.html.erb", chdir: @directory)

    assert status.success?
    assert_empty error
    assert_equal "<div>Café <%= x = 1 %></div>\n", read("example.html.erb")
  end

  test "does not run cops excluded for ERB fragments" do
    write_config(<<~YAML)
      Style/FrozenStringLiteralComment:
        Enabled: true
    YAML
    write("example.html.erb", "<%= user.name %>\n")

    output, error, status = run_rubocop("example.html.erb", chdir: @directory)

    assert status.success?, output
    assert_empty error
    refute_includes output, "Style/FrozenStringLiteralComment"
  end

  test "honors project exclusions for template filenames" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
        Exclude:
          - example.html.erb
    YAML
    write("example.html.erb", "<%= x=1 %>\n")

    output, error, status = run_rubocop("example.html.erb", chdir: @directory)

    assert status.success?, output
    assert_empty error
    refute_includes output, "Layout/SpaceAroundOperators"
  end

  test "leaves ordinary Ruby inspection unchanged" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.rb", "x=1\n")

    output, error, status = run_rubocop("example.rb", chdir: @directory)

    refute status.success?
    assert_empty error
    assert_includes output, "Layout/SpaceAroundOperators"
  end

  private

  def write_config(cops)
    write(".rubocop.yml", <<~YAML)
      plugins:
        - rubocop-herb
      AllCops:
        DisabledByDefault: true
      #{cops}
    YAML
  end

  def write(path, contents)
    File.write(File.join(@directory, path), contents)
  end

  def read(path)
    File.read(File.join(@directory, path))
  end
end
