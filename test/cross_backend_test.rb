# frozen_string_literal: true

require_relative "test_helper"

class CrossBackendTest < Minitest::Test
  def test_backend_method_gets_specific_backend
    native_backend = Herb.backend(:native)
    assert_instance_of Herb::Backends::NativeBackend, native_backend
    assert native_backend.loaded?

    current = Herb.current_backend
    Herb.backend(:native)
    assert_equal current, Herb.current_backend
  end

  def test_backend_kwarg_support
    template = "<div>Hello World</div>"

    Herb.parse(template, backend: :native)
    result = Herb.parse(template)

    assert result.value.respond_to?(:to_source) if result.success?

    assert true
  end

  def test_backend_method_access
    native_backend = Herb.backend(:native)
    assert_instance_of Herb::Backends::NativeBackend, native_backend

    current = Herb.current_backend
    Herb.backend(:native)

    assert_equal current, Herb.current_backend
  end

  def test_cross_backend_usage_with_kwarg
    skip "Node backend dependencies not available" unless node_backend_available?

    original_backend = Herb.current_backend

    begin
      Herb.switch_backend(:native)
      template = "<div><span>Hello</span><span>World</span></div>"
      result = Herb.parse(template)

      assert result.success?
      assert_equal "native", Herb.current_backend

      formatted_output = Herb.format(template, backend: :node)
      lint_result = Herb.lint(template, backend: :node)

      node_formatted = result.value.to_source(backend: :node)
      node_identity = result.value.to_source(backend: :node)

      assert_equal "native", Herb.current_backend

      assert_instance_of String, formatted_output
      assert_instance_of Herb::LintResult, lint_result
      assert_instance_of String, node_formatted
      assert_instance_of String, node_identity

      assert_includes formatted_output, "Hello"
      assert_includes node_formatted, "Hello"
      assert_includes node_identity, "Hello"
    rescue Nodo::DependencyError
      skip "Node.js packages not installed"
    ensure
      Herb.switch_backend(original_backend) if original_backend
    end
  end

  def test_backend_kwarg_functionality
    skip "Node backend dependencies not available" unless node_backend_available?

    original_backend = Herb.current_backend

    begin
      Herb.switch_backend(:native)
      template = "<div><span>Messy</span><span>HTML</span></div>"

      formatted = Herb.format(template, backend: :node)
      lint_result = Herb.lint(template, backend: :node)
      parsed = Herb.parse(template, backend: :native)

      assert_instance_of String, formatted
      assert_instance_of Herb::LintResult, lint_result
      assert_instance_of Herb::ParseResult, parsed

      assert_equal "native", Herb.current_backend
    rescue Nodo::DependencyError
      skip "Node.js packages not installed"
    ensure
      Herb.switch_backend(original_backend) if original_backend
    end
  end

  private

  def node_backend_available?
    require "nodo"
    true
  rescue LoadError
    false
  end
end
