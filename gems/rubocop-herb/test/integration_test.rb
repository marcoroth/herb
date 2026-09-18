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

  test "tracks variable usage across ERB tags" do
    write_config(<<~YAML)
      Lint/UselessAssignment:
        Enabled: true
    YAML
    write("example.html.erb", "<% value = compute %>\n<p><%= value %></p>\n")

    output, error, status = run_rubocop("example.html.erb", chdir: @directory)

    assert status.success?, output
    assert_empty error
    refute_includes output, "Lint/UselessAssignment"
  end

  test "runs only on HTML ERB files" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.html.erb", "<%= html=1 %>\n")
    write("example.rss.erb", "<%= rss=1 %>\n")
    write("example.erb", "<%= generic=1 %>\n")

    output, error, status = run_rubocop(".", chdir: @directory)

    refute status.success?
    assert_empty error
    assert_includes output, "example.html.erb"
    refute_includes output, "example.rss.erb"
    refute_includes output, "example.erb"
  end

  test "does not inspect explicitly passed non-HTML ERB files" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.rss.erb", "<%= rss=1 %>\n")

    output, error, status = run_rubocop("example.rss.erb", chdir: @directory)

    assert status.success?, output
    assert_empty error
    refute_includes output, "Layout/SpaceAroundOperators"
  end

  test "rejects autocorrections spanning non-Ruby template content" do
    write("custom_cop.rb", <<~RUBY)
      module RuboCop
        module Cop
          module HerbTest
            class ReplaceConditional < Base
              extend AutoCorrector

              MSG = "Do not use conditionals."

              def on_if(node)
                add_offense(node) { |corrector| corrector.replace(node, "replacement") }
              end
            end
          end
        end
      end
    RUBY
    write_config(<<~YAML)
      require:
        - ./custom_cop
      HerbTest/ReplaceConditional:
        Enabled: true
    YAML
    template = "<% if condition %><strong><%= value %></strong><% end %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-A", "example.html.erb", chdir: @directory)

    refute status.success?
    assert_empty error
    assert_includes output, "HerbTest/ReplaceConditional"
    refute_includes output, "[Corrected]"
    assert_equal template, read("example.html.erb")
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
        SuggestExtensions: false
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
