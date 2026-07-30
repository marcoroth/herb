use crate::utils::tag_utils::{
  get_attribute_name, get_attribute_value, get_combined_attribute_name, get_static_attribute_name, get_static_attribute_value, get_validatable_static_content,
  has_erb_output, is_effectively_static,
};

use herb::nodes::{AnyNode, HTMLAttributeNode};

const NO_NODES: &[AnyNode] = &[];

pub enum AttributeKind<'node> {
  /// `class="container"`
  StaticNameStaticValue {
    attribute_name: String,
    attribute_value: String,
    original_attribute_name: String,
  },

  /// `class="<%= css_class %>"`
  StaticNameDynamicValue {
    attribute_name: String,
    original_attribute_name: String,
    value_nodes: &'node [AnyNode],
    combined_value: Option<String>,
  },

  /// `data-<%= key %>="foo"`
  DynamicNameStaticValue {
    name_nodes: &'node [AnyNode],
    attribute_value: String,
    combined_name: String,
  },

  /// `data-<%= key %>="<%= value %>"`
  DynamicNameDynamicValue {
    name_nodes: &'node [AnyNode],
    value_nodes: &'node [AnyNode],
    combined_name: String,
    combined_value: Option<String>,
  },
}

fn attribute_value_nodes(attribute: &HTMLAttributeNode) -> &[AnyNode] {
  attribute.value.as_ref().map(|value_node| value_node.children.as_slice()).unwrap_or(NO_NODES)
}

fn attribute_name_nodes(attribute: &HTMLAttributeNode) -> &[AnyNode] {
  attribute.name.as_ref().map(|name_node| name_node.children.as_slice()).unwrap_or(NO_NODES)
}

fn has_dynamic_attribute_name(attribute: &HTMLAttributeNode) -> bool {
  attribute_name_nodes(attribute).iter().any(|child| matches!(child, AnyNode::ERBContentNode(_)))
}

pub fn classify_attribute(attribute: &HTMLAttributeNode) -> Option<AttributeKind<'_>> {
  let static_attribute_name = get_attribute_name(attribute);
  let original_attribute_name = get_static_attribute_name(attribute).unwrap_or_default();
  let is_dynamic_name = has_dynamic_attribute_name(attribute);
  let static_attribute_value = get_static_attribute_value(attribute);
  let value_nodes = attribute_value_nodes(attribute);
  let has_output_erb = has_erb_output(value_nodes);

  if let Some(attribute_name) = static_attribute_name {
    if let Some(attribute_value) = static_attribute_value {
      return Some(AttributeKind::StaticNameStaticValue {
        attribute_name,
        attribute_value,
        original_attribute_name,
      });
    }

    if is_effectively_static(value_nodes) && !has_output_erb {
      return Some(AttributeKind::StaticNameStaticValue {
        attribute_name,
        attribute_value: get_validatable_static_content(value_nodes).unwrap_or_default(),
        original_attribute_name,
      });
    }

    if has_output_erb {
      return Some(AttributeKind::StaticNameDynamicValue {
        attribute_name,
        original_attribute_name,
        value_nodes,
        combined_value: get_attribute_value(attribute),
      });
    }

    return None;
  }

  if !is_dynamic_name {
    return None;
  }

  let combined_name = get_combined_attribute_name(attribute).unwrap_or_default();

  if let Some(attribute_value) = static_attribute_value {
    return Some(AttributeKind::DynamicNameStaticValue {
      name_nodes: attribute_name_nodes(attribute),
      attribute_value,
      combined_name,
    });
  }

  Some(AttributeKind::DynamicNameDynamicValue {
    name_nodes: attribute_name_nodes(attribute),
    value_nodes,
    combined_name,
    combined_value: get_attribute_value(attribute),
  })
}
