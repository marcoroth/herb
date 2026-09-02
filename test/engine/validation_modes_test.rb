# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class ValidationModesTest < Minitest::Spec
    include SnapshotUtils

    before do
      @valid_template = "<div>Valid template</div>"
      @invalid_security_template = "<div <%= @malicious %>>Content</div>"
      @invalid_nesting_template = "<p><div>Invalid nesting</div></p>"
    end

    around do |test|
      @fixed_time = Time.utc(2025, 1, 1, 12, 0, 0)

      Time.stub :now, @fixed_time do
        test.call
      end
    end

    test "a fatal validator raises SecurityError for security violations" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, visitors: Herb::Engine::Validators.all)
      end

      assert_equal "1:5 - ERB output tags (<%= %>) are not allowed in attribute position. - Suggestion: Use control flow (<% %>) with static attributes instead.", error.message
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test "a fatal validator raises CompilationError for other validation errors" do
      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(@invalid_nesting_template, visitors: Herb::Engine::Validators.all)
      end

      assert_equal ["InvalidNestingError"], error.diagnostics.map(&:code)
      assert_equal ["Block element <div> cannot be nested inside <p> at line 1"], error.diagnostics.map(&:message)
    end

    test "a fatal validator is the default behavior" do
      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, visitors: Herb::Engine::Validators.all)
      end

      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, visitors: Herb::Engine::Validators.all)
      end
    end

    test "no validators skips all validation" do
      assert_compiled_snapshot(@invalid_security_template, visitors: [])
      assert_compiled_snapshot('<div data-<%= @name %>="value">Content</div>', visitors: [])
    end

    test "a non-fatal validator compiles successfully with validation errors" do
      assert_compiled_snapshot(@invalid_security_template, visitors: Herb::Engine::Validators.all(fatal: false))
    end

    test "a non-fatal validator with valid template does not include validation errors" do
      assert_compiled_snapshot(@valid_template, visitors: Herb::Engine::Validators.all(fatal: false))
    end

    test "a non-fatal validator includes filename in HTML" do
      filename = "/path/to/template.html.erb"
      project_path = "/path"

      assert_compiled_snapshot(@invalid_security_template, visitors: Herb::Engine::Validators.all(fatal: false), filename: filename, project_path: project_path)
    end

    test "a non-fatal validator with multiple validation errors" do
      complex_invalid_template = '<div <%= @attr %> data-<%= @name %>="value">Content</div>'

      assert_compiled_snapshot(complex_invalid_template, visitors: Herb::Engine::Validators.all(fatal: false))
    end

    test "validation modes work with debug mode" do
      engine1 = assert_compiled_snapshot(@valid_template, visitors: [Herb::Engine::DebugVisitor.new])
      assert_kind_of String, engine1.src

      engine2 = assert_compiled_snapshot(@valid_template, visitors: Herb::Engine::Validators.all(fatal: false).use(Herb::Engine::DebugVisitor.new))
      assert_kind_of String, engine2.src

      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, visitors: Herb::Engine::Validators.all.use(Herb::Engine::DebugVisitor.new))
      end
    end

    test "a template that cannot be parsed raises rather than compiling something untrue" do
      error = assert_raises(Herb::Engine::ParseError) do
        Herb::Engine.new("<div><span>Content</div>", filename: "app/views/broken.html.erb")
      end

      assert_equal ["MissingClosingTagError"], error.diagnostics.map(&:code)
      assert_equal "app/views/broken.html.erb", error.filename
      assert_equal "<div><span>Content</div>", error.source
      assert_equal 1, error.line_number
    end

    test "carries its source annotated the way an error page wants it" do
      error = assert_raises(Herb::Engine::ParseError) do
        Herb::Engine.new("<div>\n<span>Content\n</div>", filename: "app/views/broken.html.erb")
      end

      assert_equal ["    1  <div>", "    2  <span>Content", "    3  </div>"], error.annotated_source_code
    end

    test "reports a parse error in a process that only loads herb" do
      script = <<~RUBY
        require "herb"
        require "herb/engine"

        begin
          Herb::Engine.new("<div><span>Content</div>")
        rescue Herb::Engine::ParseError
          print "ok"
        end
      RUBY

      lib = File.expand_path("../../lib", __dir__)
      output = IO.popen([RbConfig.ruby, "-I#{lib}", "-e", script], err: [:child, :out], &:read)

      assert_equal "ok", output.strip
    end
  end
end
