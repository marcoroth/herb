use crate::utils::tag_utils::get_attribute_name;

use herb::nodes::HTMLAttributeNode;
use herb::Visitor;

rule_visitor!(NoEventHandlerAttributesVisitor);
define_parser_rule!(
  HTMLNoEventHandlerAttributesRule,
  "html-no-event-handler-attributes",
  Error,
  NoEventHandlerAttributesVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true },
  introduced_in: "unreleased"
);

const HTML_EVENT_ATTRIBUTES: &[&str] = &[
  "onafterprint",
  "onbeforeprint",
  "onbeforeunload",
  "onerror",
  "onhashchange",
  "onlanguagechange",
  "onload",
  "onmessage",
  "onmessageerror",
  "onoffline",
  "ononline",
  "onpagehide",
  "onpageshow",
  "onpopstate",
  "onrejectionhandled",
  "onresize",
  "onstorage",
  "onunhandledrejection",
  "onunload",
  "onblur",
  "onchange",
  "onfocus",
  "onformdata",
  "oninput",
  "oninvalid",
  "onreset",
  "onsearch",
  "onselect",
  "onsubmit",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onauxclick",
  "onclick",
  "oncontextmenu",
  "ondblclick",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onwheel",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "oncopy",
  "oncut",
  "onpaste",
  "onabort",
  "oncanplay",
  "oncanplaythrough",
  "oncuechange",
  "ondurationchange",
  "onemptied",
  "onended",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
  "onseeked",
  "onseeking",
  "onstalled",
  "onsuspend",
  "ontimeupdate",
  "onvolumechange",
  "onwaiting",
  "onscroll",
  "onscrollend",
  "onbeforematch",
  "onbeforetoggle",
  "oncancel",
  "onclose",
  "oncontextlost",
  "oncontextrestored",
  "onsecuritypolicyviolation",
  "onslotchange",
  "ontoggle",
];

impl Visitor for NoEventHandlerAttributesVisitor {
  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    if let Some(attribute_name) = get_attribute_name(node) {
      if HTML_EVENT_ATTRIBUTES.contains(&attribute_name.as_str()) {
        self.add_offense(
          format!(
            "Avoid inline event handler `{attribute_name}`. Use external JavaScript with `addEventListener` instead or an external library like Stimulus."
          ),
          node.location.clone(),
        );
      }
    }

    self.walk_html_attribute_node(node);
  }
}
