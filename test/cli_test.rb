# frozen_string_literal: true

require_relative "test_helper"
require "stringio"

class CLITest < Minitest::Test
  def setup
    @cli_class = Herb::CLI
    @original_stdout = $stdout
    @original_stderr = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new
  end

  def teardown
    $stdout = @original_stdout
    $stderr = @original_stderr
  end

  def test_cli_class_exists
    assert_equal Herb::CLI, @cli_class
  end

  def test_cli_has_new_attributes
    cli = @cli_class.new([])

    assert_respond_to cli, :indent_width
    assert_respond_to cli, :indent_width=
    assert_respond_to cli, :max_line_length
    assert_respond_to cli, :max_line_length=
  end

  def test_help_includes_new_commands
    cli = @cli_class.new(["help"])

    cli.call

    assert_respond_to cli, :help
  end

  def test_option_parser_includes_new_options
    cli = @cli_class.new([])
    parser = cli.option_parser

    parser_help = parser.to_s

    assert_includes parser_help, "--indent-width"
    assert_includes parser_help, "--max-line-length"
  end

  def test_format_command_handler_exists
    cli = @cli_class.new(["format"])

    assert_includes cli.private_methods, :handle_format_command
  end

  def test_lint_command_handler_exists
    cli = @cli_class.new(["lint"])

    assert_includes cli.private_methods, :handle_lint_command
  end

  def test_format_and_lint_commands_in_help_text
    @cli_class.new([])

    require "tempfile"

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write("<div>Hello World</div>")
      file.flush

      format_cli = @cli_class.new(["format", file.path])
      assert_equal "format", format_cli.instance_variable_get(:@command)

      lint_cli = @cli_class.new(["lint", file.path])
      assert_equal "lint", lint_cli.instance_variable_get(:@command)
    end
  end

  def test_indent_width_option_parsing
    cli = @cli_class.new(["format", "test.erb", "--indent-width", "4"])
    cli.options

    assert_equal 4, cli.indent_width
  end

  def test_formatting_options_parsing
    cli = @cli_class.new(["format", "test.erb", "--indent-width", "4", "--max-line-length", "120"])
    cli.options

    assert_equal 4, cli.indent_width
    assert_equal 120, cli.max_line_length
  end
end
