# frozen_string_literal: true

require_relative "test_helper"
require_relative "snapshot_utils"
require_relative "../lib/herb/engine/component_visitor"

class VueDirectiveTest < Minitest::Spec
  include SnapshotUtils

  test "component visitor handles Vue directives correctly" do
    html = %(<MyComponent name="hello" :count="@count" :user="current_user" />)

    component_visitor = Herb::Engine::ComponentVisitor.new

    assert_compiled_snapshot(html, { visitors: [component_visitor] })
  end

  test "component visitor treats colon attributes as Ruby code" do
    html = %(<Button :disabled="form.invalid?" :loading="@submitting" />)

    component_visitor = Herb::Engine::ComponentVisitor.new

    assert_compiled_snapshot(html, { visitors: [component_visitor] })
  end

  test "component visitor treats regular attributes as strings" do
    html = %(<Button class="btn-primary" type="submit" />)

    component_visitor = Herb::Engine::ComponentVisitor.new

    assert_compiled_snapshot(html, { visitors: [component_visitor] })
  end

  test "component visitor treats @ in regular attributes as string literals" do
    html = %(<MyComponent name="@hello" email="user@example.com" />)

    component_visitor = Herb::Engine::ComponentVisitor.new

    assert_compiled_snapshot(html, { visitors: [component_visitor] })
  end
end
