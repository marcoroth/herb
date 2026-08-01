module ApplicationHelper
  include FormattingHelper

  def page_title(title)
    content_tag(:h1, title)
  end

  def current_year
    Time.current.year
  end

  private

  def internal_only_secret
    "should never be callable from a template"
  end
end
