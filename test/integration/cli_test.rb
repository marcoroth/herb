# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/cli"

require "tempfile"

module Engine
  class CLITest < Minitest::Spec
    include SnapshotUtils

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
      @captured_stdout.string.dup
    end

    def captured_error
      @captured_stderr.string.dup
    end

    def normalize_paths(text)
      text.gsub(%r{[\w./-]*test_template\d+-\d+-\w+\.erb}, "TEMPLATE")
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

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile with escaping" do
      template = "<div><%= user_input %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--escape"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile without escaping" do
      template = "<div><%= user_input %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--no-escape"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile with freeze" do
      template = "<div>Static content</div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--freeze"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile with --no-trim" do
      template = "<% a = 1 %>\ntext\n"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--no-trim"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile with --optimize resolves helpers into the markup they produce" do
      template = "<%= tag.br %>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--optimize"]).call
        end

        assert_equal "'<br>'.freeze\n", captured_output
      end
    end

    test "compile with --optimize collapses a static conditional into branch literals" do
      template = "<% if flag %>A<% else %>B<% end %>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--optimize"]).call
        end

        assert_equal %(if flag ; "A".freeze;else; "B".freeze;end;\n), captured_output
      end
    end

    test "compile without --optimize keeps the helper call" do
      template = "<%= tag.br %>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path]).call
        end

        assert_equal "__herb = ::Herb::Engine; _buf = ::String.new; _buf << __herb.h((tag.br));\n_buf.to_s\n", captured_output
      end
    end

    test "render with --optimize renders the folded output" do
      template = %(<p><%= "hello" %></p>)

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path, "--optimize"]).call
        end

        assert_equal "<p>hello</p>\n", captured_output
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
        assert_snapshot_matches(json_data["source"], name)
        assert_equal File.basename(file_path), File.basename(json_data["filename"])
        assert_equal "_buf", json_data["bufvar"]
      end
    end

    test "compile with slots emits markers" do
      template = "<div><%= name %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--slots"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
        assert_empty captured_error
      end
    end

    test "compile with slots emits paired comments where an element cannot carry the slot" do
      template = "<p>Hi <%= name %>!</p>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--slots"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile without slots emits no markers" do
      template = "<div><%= name %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile with slots warns on stderr about an unkeyed collection" do
      template = "<% users.each do |user| %><li><%= user.name %></li><% end %>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path, "--slots"]).call
        end

        assert_match "Add a `herb-key` or `id` attribute to `<li>`", captured_error
        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile without slots does not warn about an unkeyed collection" do
      template = "<% users.each do |user| %><li><%= user.name %></li><% end %>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path]).call
        end

        assert_empty captured_error
      end
    end

    test "render with slots emits markers around the rendered output" do
      template = "<div><%= 1 + 1 %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path, "--slots"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "render without slots emits no markers" do
      template = "<div><%= 1 + 1 %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "render in client mode parks the branch that did not run" do
      template = "<div><% if false %><b>secret</b><% else %><i>guest</i><% end %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path, "--slots", "client"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "render in server mode parks nothing" do
      template = "<div><% if false %><b>secret</b><% else %><i>guest</i><% end %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path, "--slots", "server"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "render picks up a herb:slots directive without the flag" do
      template = "<%# herb:slots client %>\n<div><% if false %>a<% else %>b<% end %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "an unknown slots mode is rejected before anything is compiled" do
      template = "<div><%= 1 + 1 %></div>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", file_path, "--slots", "nonsense"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile picks up a herb:slots directive without the flag" do
      template = "<%# herb:slots %>\n<% users.each do |user| %><li><%= user.name %></li><% end %>"

      with_temp_file(template) do |file_path|
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", file_path]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
        assert_match "Add a `herb-key` or `id` attribute to `<li>`", captured_error
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
        assert_equal File.basename(file_path), File.basename(json_data["filename"])

        assert_equal(
          "TEMPLATE:1:1: Opening tag `<div>` at (1:1) doesn't have a matching closing tag `</div>` in the same scope. (and 1 more error)",
          json_data["error"].gsub(file_path, "TEMPLATE")
        )
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

        assert_equal(<<~REPORT, output.gsub(file_path, "TEMPLATE"))
          \u2718 [MissingClosingTagError] Opening tag `<span>` at (2:3) doesn't have a matching closing tag `</span>` in the same scope.

              TEMPLATE:2:3:
                2 \u2502   <span>Unclosed span
                  \u2575   ~~~~~~

            Add the closing tag, or make it self-closing.
        REPORT
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

      assert_snapshot_matches(normalize_paths(captured_output), name)
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

        assert_snapshot_matches(normalize_paths(captured_output), name)
      ensure
        $stdin = original_stdin
      end
    end

    test "help includes compile command" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["help"]).call
      end

      assert_snapshot_matches(normalize_paths(captured_output), name)
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

        assert_snapshot_matches(normalize_paths(captured_output), name)
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

        assert_snapshot_matches(normalize_paths(captured_output), name)
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

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "unknown command shows help" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["unknown_command"]).call
      end

      assert_snapshot_matches(normalize_paths(captured_output), name)
    end

    test "lex reads from stdin with dash argument" do
      template = "<div>Hello</div>"

      with_stdin(template) do
        Herb::CLI.new(["lex", "-"]).call

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "parse reads from stdin with dash argument" do
      template = "<div>Hello</div>"

      with_stdin(template) do
        Herb::CLI.new(["parse", "-"]).call

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "compile reads from stdin with dash argument" do
      template = "<div><%= name %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", "-"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "ruby reads from stdin with dash argument" do
      template = "<div><%= user.name %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["ruby", "-"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "html reads from stdin with dash argument" do
      template = "<div><%= user.name %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["html", "-"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
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
        assert_snapshot_matches(json_data["source"], name)
        assert_equal "-", json_data["filename"]
      end
    end

    test "compile stdin with options" do
      template = "<div><%= user_input %></div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["compile", "-", "--no-escape", "--freeze"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "render reads from stdin" do
      template = "<div>Rendered content</div>"

      with_stdin(template) do
        assert_raises(SystemExit) do
          Herb::CLI.new(["render", "-"]).call
        end

        assert_snapshot_matches(normalize_paths(captured_output), name)
      end
    end

    test "help includes stdin documentation" do
      assert_raises(SystemExit) do
        Herb::CLI.new(["help"]).call
      end

      assert_snapshot_matches(normalize_paths(captured_output), name)
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

        assert_snapshot_matches(normalize_paths(captured_output), name)
      ensure
        $stdin = original_stdin
      end
    end
  end
end
