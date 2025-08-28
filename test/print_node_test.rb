# frozen_string_literal: true

require_relative "test_helper"

class PrintNodeTest < Minitest::Test
  def test_node_to_source_method_exists
    template = "<div>Hello World</div>"
    result = Herb.parse(template)

    assert result.success?
    assert_respond_to result.value, :to_source
  end

  def test_native_backend_print_node_not_implemented
    original_backend = Herb.current_backend

    begin
      Herb.switch_backend(:native)
      template = "<div>Hello World</div>"
      result = Herb.parse(template)

      error = assert_raises(NotImplementedError) do
        result.value.to_source(backend: :native)
      end

      assert_includes error.message, "Node printing is not implemented in the native backend"
      assert_includes error.message, "Node backend"
    ensure
      Herb.switch_backend(original_backend) if original_backend
    end
  end

  def test_node_backend_print_node_works
    skip "Node backend dependencies not available" unless node_backend_available?

    original_backend = Herb.current_backend

    begin
      Herb.switch_backend(:node)
      template = "<div>Hello World</div>"
      result = Herb.parse(template)

      assert result.success?

      erb_output = result.value.to_source

      assert_instance_of String, erb_output
      assert erb_output.length.positive?

      assert_includes erb_output, "div"
      assert_includes erb_output, "Hello World"
    rescue Nodo::DependencyError
      skip "Node.js packages not installed"
    ensure
      Herb.switch_backend(original_backend) if original_backend
    end
  end

  def test_node_backend_format_option
    skip "Node backend dependencies not available" unless node_backend_available?

    original_backend = Herb.current_backend

    begin
      Herb.switch_backend(:node)
      messy_template = "<div><span>Hello</span><span>World</span></div>"
      result = Herb.parse(messy_template)

      assert result.success?

      source_default = result.value.to_source
      source_identity = result.value.to_source(format: false)

      assert_instance_of String, source_default
      assert_instance_of String, source_identity

      assert_includes source_default, "div"
      assert_includes source_default, "span"
      assert_includes source_identity, "div"
      assert_includes source_identity, "span"
      assert_includes source_identity, "Hello"

      assert source_default.length.positive?
      assert source_identity.length.positive?
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
