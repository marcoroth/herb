# frozen_string_literal: true

require_relative "test_helper"

class BackendSystemTest < Minitest::Test
  def setup
    @original_backend = Herb.current_backend
  end

  def teardown
    Herb.switch_backend(@original_backend) if @original_backend
  end

  def test_herb_has_format_and_lint_methods
    assert_respond_to Herb, :format
    assert_respond_to Herb, :format_file
    assert_respond_to Herb, :lint
    assert_respond_to Herb, :lint_file
  end

  def test_backend_abstract_methods_are_defined
    backend = Herb::Backend.new
    backend.instance_variable_set(:@loaded, true)

    assert_raises(NotImplementedError) { backend.format("test", {}) }
    assert_raises(NotImplementedError) { backend.lint("test", {}) }
  end

  def test_backend_format_and_lint_methods_exist
    backend = Herb::Backend.new

    assert_respond_to backend, :format
    assert_respond_to backend, :format_file
    assert_respond_to backend, :lint
    assert_respond_to backend, :lint_file
  end

  def test_backend_format_and_lint_require_loaded_backend
    backend = Herb::Backend.new

    error = assert_raises(RuntimeError) do
      backend.format("test")
    end

    assert_includes error.message, "Backend not loaded"

    error = assert_raises(RuntimeError) do
      backend.lint("test")
    end

    assert_includes error.message, "Backend not loaded"
  end

  def test_native_backend_has_helpful_error_messages
    error = assert_raises(NotImplementedError) do
      Herb.format("test", backend: :native)
    end

    assert_includes error.message, "native backend"
    assert_includes error.message, "Node backend"
    assert_includes error.message, "switch_backend(:node)"

    error = assert_raises(NotImplementedError) do
      Herb.lint("test", backend: :native)
    end

    assert_includes error.message, "native backend"
    assert_includes error.message, "Node backend"
    assert_includes error.message, "switch_backend(:node)"
  end

  def test_format_file_reads_from_filesystem
    require "tempfile"

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write("<div></div>")
      file.flush

      error = assert_raises(NotImplementedError) do
        Herb.format_file(file.path, backend: :native)
      end

      assert_includes error.message, "Formatting is not implemented"
      refute_includes error.message.downcase, "file"
      refute_includes error.message.downcase, "read"
    end
  end

  def test_lint_file_reads_from_filesystem
    require "tempfile"

    Tempfile.create(["test", ".html.erb"]) do |file|
      file.write("<div></div>")
      file.flush

      error = assert_raises(NotImplementedError) do
        Herb.lint_file(file.path, backend: :native)
      end

      assert_includes error.message, "Linting is not implemented"
      refute_includes error.message.downcase, "file"
      refute_includes error.message.downcase, "read"
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
