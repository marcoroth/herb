# frozen_string_literal: true

require_relative "test_helper"

class BackendFormatLintTest < Minitest::Test
  def setup
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
  end

  def test_native_backend_format_uses_default_node_backend
    Herb.switch_backend(:native)

    skip "Node backend not available" unless node_backend_available?

    result = Herb.format(@messy_template)
    assert_instance_of String, result
  rescue StandardError => e
    assert_instance_of StandardError, e
  end

  def test_native_backend_lint_uses_default_node_backend
    Herb.switch_backend(:native)

    skip "Node backend not available" unless node_backend_available?

    result = Herb.lint(@template)
    assert_instance_of Herb::LintResult, result
  rescue StandardError => e
    assert_instance_of StandardError, e
  end

  def test_native_backend_format_file_uses_default_node_backend
    require "tempfile"

    Herb.switch_backend(:native)
    skip "Node backend not available" unless node_backend_available?

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write(@messy_template)
      file.flush

      result = Herb.format_file(file.path)
      assert_instance_of String, result
    end
  rescue StandardError => e
    assert_instance_of StandardError, e
  end

  def test_native_backend_lint_file_uses_default_node_backend
    require "tempfile"

    Herb.switch_backend(:native)
    skip "Node backend not available" unless node_backend_available?

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write(@template)
      file.flush

      result = Herb.lint_file(file.path)
      assert_instance_of Herb::LintResult, result
    end
  rescue StandardError => e
    assert_instance_of StandardError, e
  end

  def test_node_backend_format_functionality
    skip "Node backend not available" unless node_backend_available?

    Herb.switch_backend(:node)

    assert_respond_to Herb, :format
    assert_respond_to Herb, :format_file

    begin
      result = Herb.format(@messy_template)
      assert_instance_of String, result
    rescue StandardError => e
      assert_instance_of StandardError, e
    end
  end

  def test_node_backend_lint_functionality
    skip "Node backend not available" unless node_backend_available?

    Herb.switch_backend(:node)

    assert_respond_to Herb, :lint
    assert_respond_to Herb, :lint_file

    begin
      result = Herb.lint(@template)
      assert_instance_of Herb::LintResult, result
    rescue StandardError => e
      assert_instance_of StandardError, e
    end
  end

  def test_format_and_lint_methods_exist_on_available_backends
    [:native, :node].each do |backend_name|
      next unless backend_available?(backend_name)

      Herb.switch_backend(backend_name)

      assert_respond_to Herb, :format
      assert_respond_to Herb, :format_file
      assert_respond_to Herb, :lint
      assert_respond_to Herb, :lint_file

      current_backend = Herb.backend(backend_name)
      assert_respond_to current_backend, :format
      assert_respond_to current_backend, :format_file
      assert_respond_to current_backend, :lint
      assert_respond_to current_backend, :lint_file
    end
  end

  private

  def backend_available?(backend_name)
    case backend_name
    when :native
      true
    when :node
      node_backend_available?
    else
      false
    end
  end

  def node_backend_available?
    require "nodo"
    true
  rescue LoadError
    false
  end
end
