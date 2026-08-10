# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

require "tmpdir"

module Engine
  class HighlighterBridgeTest < Minitest::Spec
    SEPARATOR = Herb::Engine::HighlighterBridge::FRAGMENT_SEPARATOR

    class ExitStatus
      def initialize(success)
        @success = success
      end

      def success?
        @success
      end
    end

    def build_bridge(**)
      Herb::Engine::HighlighterBridge.new(**)
    end

    def create_executable(dir)
      path = File.join(dir, "herb-highlight")
      File.write(path, "#!/bin/sh\nexit 0\n")
      File.chmod(0o755, path)
      path
    end

    def stub_capture3(invocations, stdout: "output", success: true, responder: nil, &)
      status = ExitStatus.new(success)

      handler = lambda do |*command|
        invocations << command
        response = responder ? responder.call(command) : stdout
        [response, "", status]
      end

      Open3.stub(:capture3, handler, &)
    end

    test "explicit highlighter_path wins discovery" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)

        assert_equal bin, bridge.path
        assert bridge.available?
      end
    end

    test "missing explicit path disables the bridge" do
      bridge = build_bridge(highlighter_path: "/nonexistent/herb-highlight")

      refute bridge.available?
      assert_nil bridge.path
    end

    test "disabled bridge returns empty results without invoking the CLI" do
      invocations = []
      bridge = build_bridge(enabled: false)

      stub_capture3(invocations) do
        assert_nil bridge.ansi_diagnostics(source: "<div></div>", errors: [], filename: "a.erb")
        assert_nil bridge.ansi_focus(source: "<div></div>", line: 1, filename: "a.erb")
        assert_empty bridge.html_fragments(source: "<div></div>", errors: [], filename: "a.erb")
        assert_nil bridge.stylesheet("disabled-theme")
      end

      assert_empty invocations
      refute bridge.available?
    end

    test "discovers the monorepo bin when no explicit path is given" do
      monorepo_bin = Herb::Engine::HighlighterBridge::MONOREPO_BIN

      skip "monorepo bin not runnable here" unless File.executable?(monorepo_bin) &&
                                                   Herb::Engine::HighlighterBridge.node_available?

      bridge = build_bridge

      assert_equal monorepo_bin, bridge.path
    end

    test "falls back to PATH lookup when the monorepo bin cannot run" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        original_path = ENV.fetch("PATH", nil)

        begin
          ENV["PATH"] = dir

          Herb::Engine::HighlighterBridge.stub(:node_available?, false) do
            bridge = build_bridge

            assert_equal bin, bridge.path
          end
        ensure
          ENV["PATH"] = original_path
        end
      end
    end

    test "ansi_diagnostics passes exec-array arguments" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "highlighted") do
          result = bridge.ansi_diagnostics(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: nil,
            context_lines: 3
          )

          assert_equal "highlighted", result
        end

        command = invocations.first

        assert_equal 7, command.length
        assert_equal bin, command[0]
        assert_equal "--diagnostics", command[1]
        assert command[2].end_with?(".json")
        assert_equal "--split-diagnostics", command[3]
        assert_equal ["--context-lines", "3"], command[4, 2]
        assert command[6].end_with?(".html.erb")
      end
    end

    test "ansi_focus passes exec-array arguments" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "focused") do
          result = bridge.ansi_focus(source: "<div></div>", line: 12, filename: nil, context_lines: 4)

          assert_equal "focused", result
        end

        command = invocations.first

        assert_equal 6, command.length
        assert_equal bin, command[0]
        assert_equal ["--focus", "12"], command[1, 2]
        assert_equal ["--context-lines", "4"], command[3, 2]
        assert command[5].end_with?(".html.erb")
      end
    end

    test "html_fragments passes exec-array arguments with hover messages for both" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "<figure></figure>") do
          bridge.html_fragments(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: nil,
            context_lines: 3,
            messages: "both"
          )
        end

        command = invocations.first

        assert_equal 14, command.length
        assert_equal bin, command[0]
        assert_equal ["--format", "html"], command[1, 2]
        assert_equal ["--html-markers", "spans"], command[3, 2]
        assert_equal "--diagnostics", command[5]
        assert command[6].end_with?(".json")
        assert_equal "--split-diagnostics", command[7]
        assert_equal "--html-fragment-separator=#{SEPARATOR}", command[8]
        assert_equal ["--context-lines", "3"], command[9, 2]
        assert_equal ["--html-messages", "hover"], command[11, 2]
        assert command[13].end_with?(".html.erb")
      end
    end

    test "html_fragments accepts a markers keyword and defaults to spans" do
      parameters = Herb::Engine::HighlighterBridge.instance_method(:html_fragments).parameters

      assert_includes parameters, [:key, :markers]

      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "<figure></figure>") do
          bridge.html_fragments(source: "<div></div>", errors: [], filename: nil)
          bridge.html_fragments(source: "<div></div>", errors: [], filename: nil, markers: "highlight-api")
        end

        assert_equal ["--html-markers", "spans"], invocations.first[3, 2]
        assert_equal ["--html-markers", "highlight-api"], invocations.last[3, 2]
      end
    end

    test "html_fragments omits html-messages in header mode" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "<figure></figure>") do
          bridge.html_fragments(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: nil,
            messages: "header"
          )
        end

        command = invocations.first

        refute_includes command, "--html-messages"
        refute_includes command, "hover"
        assert command.last.end_with?(".html.erb")
      end
    end

    test "html_fragments splits output on the separator" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []
        stdout = "<figure>one</figure>\n#{SEPARATOR}\n<figure>two</figure>\n"

        stub_capture3(invocations, stdout: stdout) do
          fragments = bridge.html_fragments(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: nil
          )

          assert_equal ["<figure>one</figure>", "<figure>two</figure>"], fragments
        end
      end
    end

    test "ansi output is relabeled with the display name" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, responder: ->(command) { "error in #{command.last}:1:2" }) do
          result = bridge.ansi_diagnostics(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: "app/views/show.html.erb"
          )

          assert_equal "error in app/views/show.html.erb:1:2", result
        end
      end
    end

    test "html output is relabeled with the escaped display name" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, responder: ->(command) { "<figcaption>#{command.last}:1:2</figcaption>" }) do
          fragments = bridge.html_fragments(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: "views/a&b.html.erb"
          )

          assert_equal ["<figcaption>views/a&amp;b.html.erb:1:2</figcaption>"], fragments
        end
      end
    end

    test "returns nil when the CLI exits non-zero" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "partial output", success: false) do
          assert_nil bridge.ansi_diagnostics(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: "a.erb"
          )
        end
      end
    end

    test "returns nil when the CLI prints nothing" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "  \n") do
          assert_nil bridge.ansi_focus(source: "<div></div>", line: 1, filename: "a.erb")
        end
      end
    end

    test "html_fragments returns an empty array on failure" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "broken", success: false) do
          fragments = bridge.html_fragments(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: "a.erb"
          )

          assert_equal [], fragments
        end
      end
    end

    test "html_fragments returns an empty array when tempfiles cannot be created" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)

        Tempfile.stub(:new, ->(*) { raise Errno::ENOSPC }) do
          fragments = bridge.html_fragments(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: "a.erb"
          )

          assert_equal [], fragments
        end
      end
    end

    test "tempfiles are unlinked after each invocation" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        stub_capture3(invocations, stdout: "out") do
          bridge.ansi_diagnostics(
            source: "<div></div>",
            errors: [{ message: "boom", location: nil }],
            filename: "a.erb"
          )
        end

        command = invocations.first
        diagnostics_path = command[2]
        source_path = command[6]

        refute File.exist?(diagnostics_path)
        refute File.exist?(source_path)
      end
    end

    test "stylesheet is cached per process" do
      Dir.mktmpdir do |dir|
        bin = create_executable(dir)
        bridge = build_bridge(highlighter_path: bin)
        invocations = []

        Herb::Engine::HighlighterBridge.stylesheet_cache = nil

        begin
          stub_capture3(invocations, stdout: ".herb-highlight {}") do
            assert_equal ".herb-highlight {}", bridge.stylesheet("cache-check")
            assert_equal ".herb-highlight {}", bridge.stylesheet("cache-check")
          end

          assert_equal 1, invocations.length
          assert_equal [bin, "--emit-css", "cache-check"], invocations.first
        ensure
          Herb::Engine::HighlighterBridge.stylesheet_cache = nil
        end
      end
    end

    test "diagnostics_for maps hash errors" do
      bridge = build_bridge(enabled: false)
      location = Herb::Location.from(2, 3, 2, 9)

      error = {
        message: "ERB output tags are not allowed here.",
        location: location,
        severity: "warning",
        code: "SecurityViolation",
        source: "SecurityValidator",
      }

      expected = {
        message: "ERB output tags are not allowed here.",
        location: {
          start: { line: 2, column: 3 },
          end: { line: 2, column: 9 },
        },
        severity: "warning",
        code: "SecurityViolation",
        source: "SecurityValidator",
      }

      assert_equal [expected], bridge.diagnostics_for([error])
    end

    test "diagnostics_for applies hash error defaults" do
      bridge = build_bridge(enabled: false)

      expected = {
        message: "boom",
        location: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 1 },
        },
        severity: "error",
        code: "UnknownError",
        source: "herb-validator",
      }

      assert_equal [expected], bridge.diagnostics_for([{ message: "boom", location: nil }])
    end

    test "diagnostics_for maps Herb error objects" do
      bridge = build_bridge(enabled: false)
      errors = Herb.parse("<div><span>Content</div>").errors

      refute_empty errors

      diagnostics = bridge.diagnostics_for(errors)

      errors.zip(diagnostics).each do |error, diagnostic|
        assert_equal error.message, diagnostic[:message]
        assert_equal error.class.name.split("::").last.gsub(/Error$/, ""), diagnostic[:code]
        assert_equal "error", diagnostic[:severity]
        assert_equal "herb-compiler", diagnostic[:source]
        assert_equal error.location.start.line, diagnostic[:location][:start][:line]
        assert_equal error.location.start.column, diagnostic[:location][:start][:column]
        assert_equal error.location.end.line, diagnostic[:location][:end][:line]
        assert_equal error.location.end.column, diagnostic[:location][:end][:column]
      end
    end
  end
end
