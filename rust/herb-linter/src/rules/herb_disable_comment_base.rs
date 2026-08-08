use crate::herb_disable_comment_utils::HerbDisableRuleName;

use herb::nodes::ERBContentNode;
use herb::Location;

/// The content of an ERB comment, which is the only node the `herb:disable`
/// rules look at.
pub fn herb_disable_comment_content(node: &ERBContentNode) -> Option<&str> {
  if node.tag_opening.as_ref()?.value != "<%#" {
    return None;
  }

  Some(node.content.as_ref()?.value.as_str())
}

/// Points at one rule name inside the comment, falling back to the comment
/// itself when the content carries no location.
pub fn rule_name_location(node: &ERBContentNode, rule_detail: &HerbDisableRuleName) -> Location {
  node
    .content
    .as_ref()
    .and_then(|content| rule_detail.location(&content.location))
    .unwrap_or_else(|| node.location.clone())
}
