# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class OpenTagWhitespaceTest < Minitest::Spec
    include SnapshotUtils

    test "preserves indentation of attributes spread across multiple lines" do
      template = <<~ERB
        <div>
          <div
            class="foo"
            role="dialog"
            aria-role="dialog"
            id="fooDlg"
            data-colour="chartreuse"
          >
            <p>Bar</p>
          </div>
        </div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves a single space between attributes" do
      template = %(<div class="foo" id="bar">Content</div>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves repeated spaces between attributes" do
      template = %(<div   class="foo"    id="bar">Content</div>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves tabs between attributes" do
      template = %(<div\tclass="foo"\tid="bar">Content</div>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves whitespace before the closing angle bracket" do
      template = %(<div class="foo" >Content</div>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves indentation of attributes on a void element" do
      template = <<~ERB
        <input
          type="text"
          name="title"
        >
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves indentation of attributes on a self-closing element" do
      template = <<~ERB
        <img
          src="a.png"
          alt="A"
        />
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves a newline before the closing angle bracket of a void element" do
      template = %(<br\n>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves whitespace around unquoted attribute values" do
      template = %(<div class=foo   id=bar>Content</div>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves indentation of boolean attributes" do
      template = <<~ERB
        <div
          data-open
          data-sticky
        >Content</div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves a blank line between attributes" do
      template = <<~ERB
        <div

          class="foo"
        >Content</div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_erubi_equality: true)
    end

    test "preserves whitespace around an erb expression in attribute position" do
      template = %(<div <%= attribute %> id="bar">Content</div>\n)

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, { attribute: "data-open" }, enforce_erubi_equality: true)
    end

    test "preserves indentation of an erb expression on its own attribute line" do
      template = <<~ERB
        <div
          class="foo"
          <%= attribute %>
        >Content</div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, { attribute: "data-open" }, enforce_erubi_equality: true)
    end

    test "preserves indentation of an inline erb conditional among attributes" do
      template = <<~ERB
        <input
          type="text"
          <% if required %>required<% end %>
        >
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, { required: true }, enforce_erubi_equality: true)
    end

    test "preserves indentation of attributes around an erb expression" do
      template = <<~ERB
        <div
          class="foo"
          id="<%= dom_id %>"
          data-colour="chartreuse"
        >
          Content
        </div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, { dom_id: "fooDlg" }, enforce_erubi_equality: true)
    end

    test "preserves indentation of attributes around an erb conditional" do
      template = <<~ERB
        <div
          class="foo"
          <% if active %>
            data-active="true"
          <% end %>
          id="fooDlg"
        >
          Content
        </div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, { active: true }, enforce_erubi_equality: true)
    end
  end
end
