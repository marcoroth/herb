# frozen_string_literal: true

require_relative "test_helper"

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
