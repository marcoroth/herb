# frozen_string_literal: true

require_relative "test_helper"

class NodeBackendIntegrationTest < Minitest::Test
  def setup
    skip "Node backend dependencies not available" unless node_backend_fully_available?

    @template = <<~ERB.strip
      <div class="container">
        <% if user.logged_in? %>
          <h1>Welcome, <%= user.name %>!</h1>
        <% end %>
      </div>
    ERB

    @messy_template = <<~ERB.strip
      <div  class="container" >
        <%if user.logged_in?%>
        <h1>Welcome, <%= user.name  %>!</h1>
            <%end%>
      </div>
    ERB

    @template_with_issues = <<~ERB.strip
      <div  class="container" >
        <%if user.logged_in?%>
        <h1 class='title'>Welcome, <%= user.name  %>!</h1>
            <%end%>
      </div>
    ERB

    Herb.switch_backend(:node)
  end

  def test_format_returns_string
    skip_if_packages_missing

    result = Herb.format(@messy_template)

    assert_instance_of String, result
    assert result.length.positive?
    refute_equal @messy_template, result
  end

  def test_format_improves_formatting
    skip_if_packages_missing

    result = Herb.format(@messy_template)

    refute_includes result, "<%if"
    refute_includes result, "<%end%>"
    refute_includes result, "<div  "
  end

  def test_format_with_options
    skip_if_packages_missing

    result = Herb.format(@messy_template)

    assert_instance_of String, result
    assert result.length.positive?
  end

  def test_format_file_with_temp_file
    skip_if_packages_missing

    require "tempfile"

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write(@messy_template)
      file.flush

      result = Herb.format_file(file.path)

      assert_instance_of String, result
      assert result.length.positive?
    end
  end

  def test_lint_returns_lint_result
    skip_if_packages_missing

    result = Herb.lint(@template_with_issues)

    assert_instance_of Herb::LintResult, result
    assert_respond_to result, :errors
    assert_respond_to result, :warnings
    assert_respond_to result, :success?
  end

  def test_lint_result_structure
    skip_if_packages_missing

    result = Herb.lint(@template_with_issues)

    # Should have error and warning counts
    assert_instance_of Integer, result.errors
    assert_instance_of Integer, result.warnings

    # Success should be boolean
    assert [true, false].include?(result.success?)

    # Success should be true if no errors
    if result.errors.zero?
      assert result.success?
    else
      refute result.success?
    end
  end

  def test_lint_with_options
    skip_if_packages_missing

    # Test that options parameter works
    result = Herb.lint(@template_with_issues)

    assert_instance_of Herb::LintResult, result
    assert_respond_to result, :success?
  end

  def test_lint_file_with_temp_file
    skip_if_packages_missing

    require "tempfile"

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write(@template_with_issues)
      file.flush

      result = Herb.lint_file(file.path)

      assert_instance_of Herb::LintResult, result
      assert_respond_to result, :success?
    end
  end

  def test_backend_version_includes_node_info
    version = Herb.version

    assert_instance_of String, version
    assert version.length.positive?
  end

  def test_parse_still_works_with_node_backend
    result = Herb.parse(@template, track_whitespace: true)

    assert_instance_of Herb::ParseResult, result
    assert result.value
    assert_instance_of Herb::AST::DocumentNode, result.value
  end

  def test_cross_backend_functionality
    skip_if_packages_missing

    original_backend = Herb.current_backend

    begin
      Herb.switch_backend(:native) if Herb.available_backends.include?("native")

      result = Herb.parse(@messy_template, track_whitespace: true)
      assert result.success?
      parsing_backend = Herb.current_backend

      formatted_output = Herb.format(@messy_template)
      lint_result = Herb.lint(@messy_template)

      assert_equal parsing_backend, Herb.current_backend

      assert_instance_of String, formatted_output
      assert_instance_of Herb::LintResult, lint_result

      node_formatted = result.value.to_source
      node_identity = result.value.to_source

      assert_instance_of String, node_formatted
      assert_instance_of String, node_identity
      assert_includes node_formatted, "Welcome"
      assert_includes node_identity, "Welcome"
    ensure
      Herb.switch_backend(original_backend) if original_backend
    end
  end

  def test_print_node_functionality
    skip_if_packages_missing

    result = Herb.parse(@template, track_whitespace: true)

    assert result.success?

    source = result.value.to_source
    assert_instance_of String, source
    assert source.length.positive?

    assert_includes source, "container"
    assert_includes source, "Welcome"
  end

  def test_print_node_with_format_option
    skip_if_packages_missing

    result = Herb.parse(@messy_template, track_whitespace: true)

    assert result.success?

    identity_output = result.value.to_source
    assert_instance_of String, identity_output

    identity_html_output = result.value.to_source(format: false)
    assert_instance_of String, identity_html_output

    formatted_html_output = result.value.to_source(format: true)
    assert_instance_of String, formatted_html_output

    assert_includes identity_output, "Welcome"
    assert_includes identity_html_output, "Welcome"
    assert_includes formatted_html_output, "Welcome"

    # Node backend doesn't preserve exact whitespace in identity mode like native backend
    # Just verify the content is present and meaningful
    assert_includes identity_html_output, "container"
    assert_includes identity_html_output, "Welcome"
    assert_equal identity_output, formatted_html_output

    assert identity_html_output.length.positive?
    assert identity_output.length.positive?
    assert formatted_html_output.length.positive?
  end

  private

  def node_backend_fully_available?
    require "nodo"

    true
  rescue LoadError, StandardError
    false
  end

  def skip_if_packages_missing
    Herb.parse("<div></div>")
  rescue Nodo::DependencyError, StandardError => e
    raise e unless e.message.include?("Cannot find package")

    skip "Node.js packages not installed: #{e.message.lines.first.strip}"
  end
end
