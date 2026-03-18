export interface ActionViewHelperInfo {
  signature: string
  documentationURL: string
}

export const ACTION_VIEW_HELPERS: Record<string, ActionViewHelperInfo> = {
  "ActionView::Helpers::TagHelper#tag": {
    signature: "tag.<tag name>(optional content, options)",
    documentationURL: "https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag",
  },
  "ActionView::Helpers::TagHelper#content_tag": {
    signature: "content_tag(name, content_or_options_with_block = nil, options = nil, escape = true, &block)",
    documentationURL: "https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag",
  },
  "ActionView::Helpers::UrlHelper#link_to": {
    signature: "link_to(name = nil, options = nil, html_options = nil, &block)",
    documentationURL: "https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to",
  },
  "Turbo::FramesHelper#turbo_frame_tag": {
    signature: "turbo_frame_tag(*ids, src: nil, target: nil, **attributes, &block)",
    documentationURL: "https://www.rubydoc.info/github/hotwired/turbo-rails/Turbo/FramesHelper:turbo_frame_tag",
  },
  "ActionView::Helpers::JavaScriptHelper#javascript_tag": {
    signature: "javascript_tag(content_or_options_with_block = nil, html_options = {}, &block)",
    documentationURL: "https://api.rubyonrails.org/classes/ActionView/Helpers/JavaScriptHelper.html#method-i-javascript_tag",
  },
  "ActionView::Helpers::AssetTagHelper#javascript_include_tag": {
    signature: "javascript_include_tag(*sources)",
    documentationURL: "https://api.rubyonrails.org/classes/ActionView/Helpers/AssetTagHelper.html#method-i-javascript_include_tag",
  },
}
