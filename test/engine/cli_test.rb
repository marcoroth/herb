# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/cli"

require "tempfile"

module Engine
  class CLITest < Minitest::Spec
    def setup
      @original_stdout = $stdout
      @original_stderr = $stderr
      @captured_stdout = StringIO.new
      @captured_stderr = StringIO.new
      $stdout = @captured_stdout
      $stderr = @captured_stderr
    end

    def teardown
      $stdout = @original_stdout
      $stderr = @original_stderr
    end

    def captured_output
      @captured_stdout.string
    end

    def captured_error
      @captured_stderr.string
    end

    def with_temp_file(content)
      file = Tempfile.new(["test_template", ".erb"])
      file.write(content)
      file.close
      yield file.path
    ensure
      file&.unlink
    end

    def with_stdin(content)
      original_stdin = $stdin
      $stdin = StringIO.new(content)
      yield
    ensure
      $stdin = original_stdin
    end

    test "compile valid template" do
      template = "<div>Hello <%= name %>!</div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--no-escape"]).call
        end

        output = captured_output
        assert_includes output, "_buf = ::String.new"
        assert_includes output, "Hello "
        assert_includes output, "(name).to_s"
      end
    end

    test "compile with escaping" do
      template = "<div><%= user_input %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--escape"]).call
        end

        output = captured_output
        assert_includes output, "__herb = ::Herb::Engine"
        assert_includes output, "__herb.h((user_input))"
      end
    end

    test "compile without escaping" do
      template = "<div><%= user_input %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--no-escape"]).call
        end

        output = captured_output
        refute_includes output, "__herb = ::Herb::Engine"
        assert_includes output, "(user_input).to_s"
      end
    end

    test "compile with freeze" do
      template = "<div>Static content</div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--freeze"]).call
        end

        output = captured_output
        assert_includes output, "# frozen_string_literal: true"
      end
    end

    test "compile with json output" do
      template = "<div>Hello World</div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--json"]).call
        end

        output = captured_output
        json_data = JSON.parse(output)

        assert_equal true, json_data["success"]
        assert_includes json_data["source"], "_buf = ::String.new"
        assert_equal File.basename(file_path), File.basename(json_data["filename"])
        assert_equal "_buf", json_data["bufvar"]
      end
    end

    test "compile invalid template with json" do
      template = <<~ERB
        <div>
          <h1>Title</h1>
        </span>
      ERB

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--json"]).call
        end

        output = captured_output
        json_data = JSON.parse(output)

        assert_equal false, json_data["success"]
        assert_includes json_data["error"], "HTML+ERB Compilation Errors"
        assert_equal File.basename(file_path), File.basename(json_data["filename"])
      end
    end

    test "compile invalid template text output" do
      template = <<~ERB
        <div>
          <span>Unclosed span
        </div>
      ERB

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path]).call
        end

        output = captured_output
        assert_includes output, "HTML+ERB Compilation Errors"
        assert_includes output, "Total errors:"
        assert output.match?(/\d+:\d+/)
      end
    end

    test "compile with silent flag success" do
      template = "<div>Hello World</div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--silent"]).call
        end

        output = captured_output
        assert_equal "Success\n", output
      end
    end

    test "compile with silent flag failure" do
      template = "<div><span>Unclosed</div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--silent"]).call
        end

        output = captured_output
        assert_equal "Failed\n", output
      end
    end

    test "compile nonexistent file" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["compile", "/path/that/does/not/exist.erb"]).call
      end

      output = captured_output
      assert_includes output, "File doesn't exist"
    end

    test "compile no file provided" do
      original_stdin = $stdin
      mock_stdin = StringIO.new
      def mock_stdin.tty? = true
      $stdin = mock_stdin

      begin
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile"]).call
        end

        output = captured_output
        assert_includes output, "No file provided"
        assert_includes output, "Usage:"
      ensure
        $stdin = original_stdin
      end
    end

    test "help includes compile command" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["help"]).call
      end

      output = captured_output
      assert_includes output, "compile [file]"
      assert_includes output, "Compile ERB template to Ruby code"
      assert_includes output, "--escape"
      assert_includes output, "--no-escape"
      assert_includes output, "--freeze"
    end

    test "version command still works" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["version"]).call
      end

      output = captured_output
      refute_empty output.strip
    end

    test "compile complex template" do
      template = <<~ERB
        <!DOCTYPE html>
        <html>
          <head>
            <title><%= title %></title>
          </head>
          <body>
            <% if show_nav? %>
              <nav>
                <% nav_items.each do |item| %>
                  <a href="<%= item[:url] %>"><%= item[:title] %></a>
                <% end %>
              </nav>
            <% end %>
            #{"    "}
            <main>
              <%= content %>
            </main>
          </body>
        </html>
      ERB

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--no-escape"]).call
        end

        output = captured_output

        assert_includes output, "_buf = ::String.new"
        assert_includes output, "<!DOCTYPE html>"
        assert_includes output, "if show_nav?"
        assert_includes output, "nav_items.each do |item|"
        assert_includes output, "(title).to_s"
        assert_includes output, "(content).to_s"
      end
    end

    test "compile preserves whitespace structure" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      ERB

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--no-escape"]).call
        end

        output = captured_output

        assert_includes output, "'<ul>\n'.freeze"
        assert_includes output, "'    <li>'.freeze"
        assert_includes output, "'</ul>\n'.freeze"
      end
    end

    test "compile erb comments not in output" do
      template = <<~ERB
        <div>
          <%# This is a comment %>
          <p>Visible content</p>
        </div>
      ERB

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path]).call
        end

        output = captured_output

        refute_includes output, "This is a comment"
        assert_includes output, "Visible content"
      end
    end

    test "unknown command shows help" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["unknown_command"]).call
      end

      output = captured_output
      assert_includes output, "Unknown command"
      assert_includes output, "compile [file]"
    end

    test "lex reads from stdin with dash argument" do
      template = "<div>Hello</div>"

      with_stdin(template) do
        Herb::CLI.new(["lex", "-"]).call

        output = captured_output
        assert_includes output, "TOKEN_HTML_TAG_START"
        assert_includes output, "TOKEN_IDENTIFIER"
        assert_includes output, "div"
      end
    end

    test "parse reads from stdin with dash argument" do
      template = "<div>Hello</div>"

      with_stdin(template) do
        Herb::CLI.new(["parse", "-"]).call

        output = captured_output
        assert_includes output, "DocumentNode"
        assert_includes output, "HTMLElementNode"
        assert_includes output, "div"
      end
    end

    test "compile reads from stdin with dash argument" do
      template = "<div><%= name %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", "-"]).call
        end

        output = captured_output
        assert_includes output, "_buf = ::String.new"
        assert_includes output, "<div>"
        assert_includes output, "__herb.h((name))"
      end
    end

    test "ruby reads from stdin with dash argument" do
      template = "<div><%= user.name %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["ruby", "-"]).call
        end

        output = captured_output
        assert_includes output, "user.name"
      end
    end

    test "html reads from stdin with dash argument" do
      template = "<div><%= user.name %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["html", "-"]).call
        end

        output = captured_output
        assert_includes output, "<div>"
        assert_includes output, "</div>"
      end
    end

    test "stdin with json output" do
      template = "<div>Hello</div>"

      with_stdin(template) do
        Herb::CLI.new(["lex", "-", "--json"]).call

        output = captured_output
        json_data = JSON.parse(output)

        assert_kind_of Array, json_data
        assert(json_data.any? { |token| token["type"] == "TOKEN_HTML_TAG_START" })
        assert(json_data.any? { |token| token["value"] == "div" })
      end
    end

    test "compile stdin with json output" do
      template = "<div><%= title %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", "-", "--json"]).call
        end

        output = captured_output
        json_data = JSON.parse(output)

        assert_equal true, json_data["success"]
        assert_includes json_data["source"], "_buf = ::String.new"
        assert_equal "-", json_data["filename"]
      end
    end

    test "compile stdin with options" do
      template = "<div><%= user_input %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", "-", "--no-escape", "--freeze"]).call
        end

        output = captured_output
        assert_includes output, "# frozen_string_literal: true"
        assert_includes output, "(user_input).to_s"
        refute_includes output, "__herb.h("
      end
    end

    test "render reads from stdin" do
      template = "<div>Rendered content</div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", "-"]).call
        end

        output = captured_output
        assert_includes output, "<div>Rendered content</div>"
      end
    end

    test "help includes stdin documentation" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["help"]).call
      end

      output = captured_output
      assert_includes output, "stdin:"
      assert_includes output, "echo"
      assert_includes output, "cat"
    end

    test "no file provided message includes stdin hint" do
      original_stdin = $stdin
      mock_stdin = StringIO.new
      def mock_stdin.tty? = true
      $stdin = mock_stdin

      begin
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile"]).call
        end

        output = captured_output
        assert_includes output, "No file provided"
        assert_includes output, "pipe content via stdin"
      ensure
        $stdin = original_stdin
      end
    end
  end
end
