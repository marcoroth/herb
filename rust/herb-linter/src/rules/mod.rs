pub mod erb_require_trailing_newline;
pub mod html_img_require_alt;
pub mod html_no_self_closing;
pub mod html_tag_name_lowercase;
pub mod parser_no_errors;

use crate::rule::Rule;

pub fn all_rules() -> Vec<Box<dyn Rule>> {
  vec![
    Box::new(parser_no_errors::ParserNoErrorsRule),
    Box::new(html_img_require_alt::HTMLImgRequireAltRule),
    Box::new(html_tag_name_lowercase::HTMLTagNameLowercaseRule),
    Box::new(html_no_self_closing::HTMLNoSelfClosingRule),
    Box::new(erb_require_trailing_newline::ERBRequireTrailingNewlineRule),
  ]
}
