# frozen_string_literal: true

require_relative "test_helper"
require_relative "../lib/herb/ruby_program"

class RubyProgramTest < Minitest::Spec
  def program_for(template)
    result = Herb.parse(template, prism_program: true)

    Herb::RubyProgram.for(result.value)
  end

  def erb_tokens(template)
    nodes(Herb.parse(template, prism_program: true).value).filter_map { |node|
      node.content if node.class.name.to_s.include?("ERB") && node.respond_to?(:content) && node.content.is_a?(Herb::Token)
    }
  end

  def nodes(root)
    found = []
    queue = [root]

    until queue.empty?
      node = queue.shift
      found << node
      queue.unshift(*node.child_nodes.compact) if node.respond_to?(:child_nodes)
    end

    found
  end

  def resolved_sources(template)
    program = program_for(template)

    erb_tokens(template).map { |token|
      resolved = program&.resolve(token.location)

      [token.value, resolved&.nodes&.map(&:slice)]
    }
  end

  test "resolves the Ruby each ERB tag holds, including an elsif arm" do
    template = %(<%# herb:state (pending: false, draft: "") %><div><% if pending? %>a<% elsif draft.blank? %>b<% end %></div>)

    assert_equal(
      [
        [" herb:state (pending: false, draft: \"\") ", []],
        [" if pending? ", ["pending?"]],
        [" elsif draft.blank? ", ["draft.blank?"]],
        [" end ", []]
      ],
      resolved_sources(template)
    )
  end

  test "resolves a case subject and an output expression" do
    template = %(<%# herb:state (draft: "") %><div><% case draft %><% when "x" %>a<% end %></div><p><%= draft == "draft?" %></p>)

    assert_equal(
      [
        [" herb:state (draft: \"\") ", []],
        [" case draft ", ["draft"]],
        [" when \"x\" ", ["when \"x\""]],
        [" end ", []],
        [" draft == \"draft?\" ", ["draft == \"draft?\""]]
      ],
      resolved_sources(template)
    )
  end

  test "reports the byte offset and source a range covers, so a splice can rebase" do
    template = %(<%# herb:state (draft: "") %><p><%= draft == "café?" %></p>)
    program = program_for(template)
    resolved = program&.resolve(erb_tokens(template).fetch(1).location)

    assert_equal " draft == \"café?\" ", resolved&.source
    assert_equal template.byteindex(" draft"), resolved&.offset
  end

  test "answers nothing when the document carries no program" do
    document = Herb.parse(%(<p><%= @a %></p>)).value

    assert_nil Herb::RubyProgram.for(document)
  end
end
