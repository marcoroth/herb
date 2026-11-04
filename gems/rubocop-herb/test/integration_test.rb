# frozen_string_literal: true

require_relative "test_helper"
require "erb"

class RuboCopHerbIntegrationTest < Minitest::Spec
  include RuboCopHerbTestHelpers

  CLEAN_TEMPLATE = <<~ERB
    <h1><%= @title %></h1>
    <p>Café <%= user.name %> and <%= count + 1 %></p>
    <% if admin? %>
      <span>Admin</span>
    <% else %>
      <span>User</span>
    <% end %>
    <ul>
      <% items.each do |item| %>
        <li><%= item %></li>
      <% end %>
    </ul>
    <%= form_with model: @post do |form| %>
      <%= form.text_field :title, class: 'title' %>
    <% end %>
    <%= link_to root_path do %>Home<% end %>
    <% case status %>
    <% when :open %>
      <p>Open</p>
    <% when :closed %>
      <p>Closed</p>
    <% end %>
    <% value = compute %>
    <p><%= value %></p>
  ERB

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

    output, error, status = run_rubocop("example.html.erb")

    refute_equal 0, status
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

    _output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status
    assert_empty error
    assert_equal "<div>Café <%= x = 1 %></div>\n", read("example.html.erb")
  end

  test "reports no offenses on a clean template with the default configuration" do
    write(".rubocop.yml", <<~YAML)
      plugins:
        - rubocop-herb
      AllCops:
        NewCops: enable
        SuggestExtensions: false
    YAML
    write("example.html.erb", CLEAN_TEMPLATE)

    output, error, status = run_rubocop("example.html.erb")

    assert_equal 0, status, output
    assert_empty error

    run_rubocop("-A", "example.html.erb")

    assert_equal CLEAN_TEMPLATE, read("example.html.erb")
  end

  test "never autocorrects markup between ERB tags" do
    write_config(<<~YAML)
      Layout/ExtraSpacing:
        Enabled: true
    YAML
    write("example.html.erb", "<p>Café</p> <%= a %>   <%= b %>\n<%= c  + d %>\n")

    run_rubocop("-A", "example.html.erb")

    assert_equal "<p>Café</p> <%= a %>   <%= b %>\n<%= c + d %>\n", read("example.html.erb")
  end

  test "does not run cops excluded for ERB fragments" do
    write_config(<<~YAML)
      Style/FrozenStringLiteralComment:
        Enabled: true
    YAML
    write("example.html.erb", "<%= user.name %>\n")

    output, error, status = run_rubocop("example.html.erb")

    assert_equal 0, status, output
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

    output, error, status = run_rubocop("example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    refute_includes output, "Layout/SpaceAroundOperators"
  end

  test "tracks variable usage across ERB tags" do
    write_config(<<~YAML)
      Lint/UselessAssignment:
        Enabled: true
    YAML
    write("example.html.erb", "<% value = compute %>\n<p><%= value %></p>\n")

    output, error, status = run_rubocop("example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    refute_includes output, "Lint/UselessAssignment"
  end

  test "reports Ruby syntax errors" do
    write_config(<<~YAML)
      Lint/Syntax:
        Enabled: true
    YAML
    write("example.html.erb", "<%= user. %>\n")

    output, error, status = run_rubocop("example.html.erb")

    refute_equal 0, status
    assert_empty error
    assert_includes output, "Lint/Syntax"
    assert_includes output, "example.html.erb:1"
  end

  test "runs on non-HTML ERB files" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.rss.erb", "<%= rss=1 %>\n")
    write("example.erb", "<%= generic=1 %>\n")

    output, error, status = run_rubocop(".")

    refute_equal 0, status
    assert_empty error
    assert_includes output, "example.rss.erb"
    assert_includes output, "example.erb"
  end

  test "runs on Herb files" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.herb", "<%= herb=1 %>\n")

    output, error, status = run_rubocop("example.herb")

    refute_equal 0, status
    assert_empty error
    assert_includes output, "example.herb"
    assert_includes output, "Layout/SpaceAroundOperators"
  end

  test "leaves ordinary Ruby inspection unchanged" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    write("example.rb", "x=1\n")

    output, error, status = run_rubocop("example.rb")

    refute_equal 0, status
    assert_empty error
    assert_includes output, "Layout/SpaceAroundOperators"
  end

  test "does not remove returns before template output" do
    write_config(<<~YAML)
      Style/RedundantReturn:
        Enabled: true
    YAML
    template = "<% greeting = lambda do %><% return 'Hi' %>ignored<% end %><%= greeting.call %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template, read("example.html.erb")
    assert_equal "Hi\n", ERB.new(read("example.html.erb")).result
  end

  test "still corrects redundant returns in ordinary Ruby" do
    write_config(<<~YAML)
      Style/RedundantReturn:
        Enabled: true
    YAML
    write("example.rb", "def greeting\n  return 'Hi'\nend\n")

    output, error, status = run_rubocop("-a", "example.rb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal "def greeting\n  'Hi'\nend\n", read("example.rb")
  end

  test "does not remove assignments consumed by output tags" do
    write_config(<<~YAML)
      Style/RedundantAssignment:
        Enabled: true
    YAML
    template = "<% def greeting %><% x = 'Hi' %><%= x %><% end %><%= greeting %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template, read("example.html.erb")
    assert_equal "HiHi\n", ERB.new(read("example.html.erb"), eoutvar: "@output").result(Object.new.instance_eval { binding })
  end

  test "does not remove begin and end across template tags" do
    write_config(<<~YAML)
      Style/RedundantBegin:
        Enabled: true
    YAML
    template = "<% begin %>Hi<%= 'there' %><% end %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template, read("example.html.erb")
    assert_equal "Hithere\n", ERB.new(read("example.html.erb")).result
  end

  test "honors disable and enable directives in ERB comments" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    template = <<~ERB
      <p>Caf\u00e9</p><%# rubocop:disable Layout/SpaceAroundOperators %>
      <%= x=1 %>
      <%# rubocop:enable Layout/SpaceAroundOperators %>
      <%= y=2 %>
    ERB
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template.sub("y=2", "y = 2"), read("example.html.erb")
  end

  test "does not let a same-line directive hide later Ruby tags" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
      Style/StringLiterals:
        Enabled: true
    YAML
    template = "<%# rubocop:todo Layout/SpaceAroundOperators %><%= x=1 %><%= \"hello\" %>\n<%= y=2 %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template.sub('"hello"', "'hello'").sub("y=2", "y = 2"), read("example.html.erb")
  end

  test "honors directives in Ruby comment tags" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    template = "<% # rubocop:disable Layout/SpaceAroundOperators %>\n<%= x=1 %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template, read("example.html.erb")
  end

  test "honors disable-next directives without losing the following statement" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    template = "<%# rubocop:disable-next Layout/SpaceAroundOperators %>\n<%= x=1 %>\n<%= y=2 %>\n"
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template.sub("y=2", "y = 2"), read("example.html.erb")
  end

  test "ignores directives in strings markup and escaped tags" do
    write_config(<<~YAML)
      Layout/SpaceAroundOperators:
        Enabled: true
    YAML
    template = <<~ERB
      <p># rubocop:disable Layout/SpaceAroundOperators</p>
      <%%# rubocop:disable Layout/SpaceAroundOperators %>
      <%= '# rubocop:disable Layout/SpaceAroundOperators' %>
      <%= x=1 %>
    ERB
    write("example.html.erb", template)

    output, error, status = run_rubocop("-a", "example.html.erb")

    assert_equal 0, status, output
    assert_empty error
    assert_equal template.sub("x=1", "x = 1"), read("example.html.erb")
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
