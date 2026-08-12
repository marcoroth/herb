# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/partial_declaration"

class PartialDeclarationTest < Minitest::Spec
  FILE = "app/views/posts/_card.html.erb"

  def declaration_for(source)
    document = Herb.parse(source, strict_locals: true).value

    Herb::Analysis::PartialDeclaration.from_document(document, FILE)
  end

  test "reports no declaration for a partial without strict locals" do
    declaration = declaration_for("<div></div>")

    refute declaration.has_declaration
    assert_empty declaration.locals
  end

  test "collects a required local" do
    declaration = declaration_for("<%# locals: (title:) %>\n<h1></h1>")

    assert declaration.has_declaration
    assert_equal ["title"], declaration.required_locals
    assert_empty declaration.optional_locals
  end

  test "collects an optional local" do
    declaration = declaration_for("<%# locals: (title: nil) %>\n<h1></h1>")

    assert_equal ["title"], declaration.optional_locals
    assert_empty declaration.required_locals
  end

  test "records a keyword rest" do
    declaration = declaration_for("<%# locals: (title:, **rest) %>\n<h1></h1>")

    assert declaration.has_keyword_rest
    assert_equal ["title"], declaration.required_locals
  end

  test "records where the declaration is" do
    declaration = declaration_for("<%# locals: (title:) %>\n<h1></h1>")

    assert_equal 1, declaration.location["line"]
  end

  test "accepts any local when the partial declares none" do
    assert declaration_for("<div></div>").accepts?("anything")
  end

  test "accepts any local when the partial takes a keyword rest" do
    assert declaration_for("<%# locals: (title:, **rest) %>").accepts?("anything")
  end

  test "rejects a local the partial does not declare" do
    declaration = declaration_for("<%# locals: (title:) %>")

    assert declaration.accepts?("title")
    refute declaration.accepts?("subtitle")
  end

  test "round trips through a serialized form" do
    declaration = declaration_for("<%# locals: (title:, subtitle: nil) %>")
    restored = Herb::Analysis::PartialDeclaration.from(declaration.to_h)

    assert_equal declaration.to_h, restored.to_h
    assert_equal ["title"], restored.required_locals
  end
end
