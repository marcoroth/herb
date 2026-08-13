# frozen_string_literal: true

require "maxitest/autorun"
require "tempfile"

require "herb-highlighter"

module TestHelper
  TEMPLATE = <<~ERB
    <% if user.admin? %>
      <img src="badge.png">
    <% end %>
  ERB

  def plain(output)
    Herb::Highlighter.strip_ansi(output)
  end

  def diagnostic(**overrides)
    {
      message: "Image is missing an alt attribute",
      code: "html-img-require-alt",
      severity: :error,
      location: { start: { line: 2, column: 2 }, end: { line: 2, column: 22 } },
    }.merge(overrides)
  end

  def with_template(content = TEMPLATE)
    Tempfile.create(["template", ".html.erb"]) do |file|
      file.write(content)
      file.flush

      yield file.path
    end
  end
end

Minitest::Test.include(TestHelper)
