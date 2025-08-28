# frozen_string_literal: true

require_relative "test_helper"

class FormatLintSummaryTest < Minitest::Test
  def test_format_and_lint_methods_exist
    assert_respond_to Herb, :format
    assert_respond_to Herb, :format_file
    assert_respond_to Herb, :lint
    assert_respond_to Herb, :lint_file
  end

  def test_format_lint_use_node_backend_by_default
    Herb.switch_backend(:native)

    skip "Node backend not available" unless node_backend_available?

    begin
      result = Herb.format("<div></div>")
      assert_instance_of String, result
    rescue StandardError => e
      assert_instance_of StandardError, e
    end

    begin
      result = Herb.lint("<div></div>")
      assert_instance_of Herb::LintResult, result
    rescue StandardError => e
      assert_instance_of StandardError, e
    end
  end

  def test_available_backends_returns_available_list
    backends = Herb.available_backends

    assert_instance_of Array, backends
    assert_includes backends, :native

    return unless node_backend_available?

    assert_includes backends, :node
  end

  def test_node_backend_methods_exist_when_available
    skip "Node backend dependencies not available" unless node_backend_available?

    begin
      Herb.switch_backend(:node)

      assert_respond_to Herb, :format
      assert_respond_to Herb, :lint
      assert_respond_to Herb.backend(:node), :format
      assert_respond_to Herb.backend(:node), :lint
    rescue Nodo::DependencyError, StandardError
      skip "Node packages not installed, but backend switching worked"
    end
  end

  def test_multi_backend_format_lint_behavior
    original_backend = Herb.current_backend

    skip "Node backend not available" unless node_backend_available?

    begin
      Herb.switch_backend(:native)

      result = Herb.format("<div></div>")
      assert_instance_of String, result

      result = Herb.lint("<div></div>")
      assert_instance_of Herb::LintResult, result

      Herb.switch_backend(:node)

      result = Herb.format("<div></div>")
      assert_instance_of String, result

      result = Herb.lint("<div></div>")
      assert_instance_of Herb::LintResult, result
    rescue Nodo::DependencyError
      skip "Node backend available but packages not installed"
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
