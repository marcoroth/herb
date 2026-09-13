# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/ruby_reference"

class RubyReferenceTest < Minitest::Spec
  def references?(code, name)
    Herb::Analysis::RubyReference.references?(code, name)
  end

  test "a bare name and a receiver are references" do
    {
      ["title", "title"] => true,
      ["post.title", "post"] => true,
      ["x = title", "title"] => true,
      ["\"\#{post.title}\"", "post"] => true,
      ["items.each do |item| item.name end", "item"] => true,
      ["form_for(@post) do |f| f.label end", "f"] => true,
    }.each do |(code, name), expected|
      assert_equal expected, references?(code, name), code
    end
  end

  test "a name inside a string literal is not a reference" do
    {
      ["render 'form'", "form"] => false,
      ["hidden_field_tag \"flag\", params[:flag]", "flag"] => false,
      ["I18n.t(\"user.identity_url_text\")", "user"] => false,
      ["render partial: \"shared/form/required_field_legend\"", "form"] => false,
      ["link_to t('button.edit'), action: 'edit'", "edit"] => false,
    }.each do |(code, name), expected|
      assert_equal expected, references?(code, name), code
    end
  end

  test "a method called on a receiver is not a reference to a local of that name" do
    assert_equal false, references?("item.title", "title")
    assert_equal false, references?("@track_things[0].track_type", "track_type")
  end

  test "an instance variable matches its own name and not a longer one" do
    assert_equal true, references?("@post.title", "@post")
    assert_equal false, references?("@posts.each", "@post")
  end

  test "a dotted name is answered by its first segment" do
    assert_equal true, references?("Current.user.admin?", "Current.user")
    assert_equal false, references?("x = 1", "Current.user")
  end

  test "source that does not parse falls back to matching text, so a dependency is never missed" do
    assert_equal true, references?("broken syntax <<<", "syntax")
    assert_equal true, references?("@post oops <<<", "@post")
    assert_equal false, references?("next if member.new_record? <<<", "f")
  end

  test "answers nothing for empty input" do
    assert_equal false, references?("", "title")
    assert_equal false, references?("title", "")
    assert_equal false, references?(nil, "title")
    assert_equal false, references?("title", nil)
  end
end
