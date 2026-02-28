use herb::nodes::*;
use herb::union_types::*;
use herb::ParseResult;

use crate::shape::*;
use crate::simplify::simplify;

pub fn infer_shape(parse_result: &ParseResult) -> Shape {
  let mut inferrer = ShapeInferrer;
  let shape = inferrer.infer_document(&parse_result.value);

  simplify(shape)
}

pub fn infer_shape_raw(parse_result: &ParseResult) -> Shape {
  let mut inferrer = ShapeInferrer;

  inferrer.infer_document(&parse_result.value)
}

struct ShapeInferrer;

impl ShapeInferrer {
  fn infer_document(&mut self, document: &DocumentNode) -> Shape {
    let shapes = self.infer_nodes(&document.children);

    Shape::Sequence(shapes)
  }

  fn infer_nodes(&mut self, nodes: &[AnyNode]) -> Vec<Shape> {
    let mut shapes = Vec::new();

    for node in nodes {
      if let Some(shape) = self.infer_node(node) {
        shapes.push(shape);
      }
    }

    shapes
  }

  fn infer_node(&mut self, node: &AnyNode) -> Option<Shape> {
    match node {
      AnyNode::DocumentNode(document_node) => Some(self.infer_document(document_node)),
      AnyNode::HTMLElementNode(element_node) => Some(self.infer_element(element_node)),
      AnyNode::HTMLConditionalElementNode(conditional_node) => Some(self.infer_conditional_element(conditional_node)),

      AnyNode::HTMLTextNode(text_node) => {
        if text_node.content.trim().is_empty() {
          None
        } else {
          Some(Shape::Text)
        }
      }

      AnyNode::LiteralNode(literal_node) => {
        if literal_node.content.trim().is_empty() {
          None
        } else {
          Some(Shape::Text)
        }
      }

      AnyNode::HTMLCommentNode(_) => Some(Shape::Comment),
      AnyNode::HTMLDoctypeNode(_) => Some(Shape::Doctype),

      AnyNode::WhitespaceNode(_) => None,

      AnyNode::ERBContentNode(content_node) => Some(self.infer_erb_content(content_node)),
      AnyNode::ERBIfNode(if_node) => Some(self.infer_if(if_node)),
      AnyNode::ERBUnlessNode(unless_node) => Some(self.infer_unless(unless_node)),
      AnyNode::ERBCaseNode(case_node) => Some(self.infer_case(case_node)),
      AnyNode::ERBCaseMatchNode(case_match_node) => Some(self.infer_case_match(case_match_node)),
      AnyNode::ERBForNode(for_node) => Some(self.infer_loop(&for_node.statements)),
      AnyNode::ERBWhileNode(while_node) => Some(self.infer_loop(&while_node.statements)),
      AnyNode::ERBUntilNode(until_node) => Some(self.infer_loop(&until_node.statements)),
      AnyNode::ERBBlockNode(block_node) => Some(self.infer_block(block_node)),
      AnyNode::ERBBeginNode(begin_node) => Some(self.infer_begin(begin_node)),
      AnyNode::ERBYieldNode(_) => Some(Shape::Dynamic),

      AnyNode::ERBEndNode(_) => None,
      AnyNode::ERBElseNode(_) => None,
      AnyNode::ERBWhenNode(_) => None,
      AnyNode::ERBInNode(_) => None,
      AnyNode::ERBRescueNode(_) => None,
      AnyNode::ERBEnsureNode(_) => None,

      AnyNode::HTMLOpenTagNode(_) => None,
      AnyNode::HTMLConditionalOpenTagNode(_) => None,
      AnyNode::HTMLCloseTagNode(_) => None,
      AnyNode::HTMLOmittedCloseTagNode(_) => None,
      AnyNode::HTMLAttributeValueNode(_) => None,
      AnyNode::HTMLAttributeNameNode(_) => None,
      AnyNode::HTMLAttributeNode(_) => None,

      AnyNode::XMLDeclarationNode(_) => Some(Shape::Dynamic),
      AnyNode::CDATANode(_) => Some(Shape::Text),
    }
  }

  fn infer_element(&mut self, node: &HTMLElementNode) -> Shape {
    let tag = self.infer_tag_name(node.tag_name.as_ref());
    let attributes = self.infer_attributes_from_open_tag(&node.open_tag);
    let children = self.infer_nodes(&node.body);

    Shape::Element(ElementShape {
      tag,
      attributes,
      children,
      is_void: node.is_void,
    })
  }

  fn infer_conditional_element(&mut self, node: &HTMLConditionalElementNode) -> Shape {
    let tag = self.infer_tag_name(node.tag_name.as_ref());

    let attributes = match &node.open_tag {
      Some(open_tag) => self.infer_open_tag_attributes(open_tag),
      None => Vec::new(),
    };

    let children = self.infer_nodes(&node.body);

    let element = Shape::Element(ElementShape {
      tag,
      attributes,
      children,
      is_void: false,
    });

    Shape::Optional(Box::new(element))
  }

  fn infer_tag_name(&self, tag_name: Option<&herb::Token>) -> TagName {
    match tag_name {
      Some(token) => TagName::Static(token.value.clone()),
      None => TagName::Dynamic,
    }
  }

  fn infer_attributes_from_open_tag(&mut self, open_tag: &Option<HTMLConditionalOpenTagNodeOrHTMLOpenTagNode>) -> Vec<ShapeAttribute> {
    match open_tag {
      Some(HTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(tag)) => self.infer_open_tag_attributes(tag),
      Some(HTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLConditionalOpenTagNode(_)) => Vec::new(),
      None => Vec::new(),
    }
  }

  fn infer_open_tag_attributes(&mut self, open_tag: &HTMLOpenTagNode) -> Vec<ShapeAttribute> {
    let mut attributes = Vec::new();

    for child in &open_tag.children {
      match child {
        AnyNode::HTMLAttributeNode(attribute_node) => {
          if let Some(shape_attribute) = self.infer_attribute(attribute_node) {
            attributes.push(shape_attribute);
          }
        }

        AnyNode::ERBContentNode(_) => {
          attributes.push(ShapeAttribute::DynamicName);
        }

        _ => {}
      }
    }

    attributes
  }

  fn infer_attribute(&mut self, attribute: &HTMLAttributeNode) -> Option<ShapeAttribute> {
    let name = match &attribute.name {
      Some(name_node) => self.extract_attribute_name(name_node),
      None => return Some(ShapeAttribute::DynamicName),
    };

    let value = match &attribute.value {
      Some(value_node) => self.infer_attribute_value(value_node),
      None => AttributeValue::Boolean,
    };

    match &name {
      Some(attribute_name) => Some(ShapeAttribute::Static {
        name: attribute_name.clone(),
        value,
      }),
      None => Some(ShapeAttribute::DynamicName),
    }
  }

  fn extract_attribute_name(&self, name_node: &HTMLAttributeNameNode) -> Option<String> {
    let mut parts = Vec::new();
    let mut has_dynamic = false;

    for child in &name_node.children {
      match child {
        AnyNode::LiteralNode(literal_node) => parts.push(literal_node.content.clone()),

        AnyNode::ERBContentNode(_) => {
          has_dynamic = true;
        }

        _ => {}
      }
    }

    if has_dynamic {
      None
    } else if parts.is_empty() {
      None
    } else {
      Some(parts.join(""))
    }
  }

  fn infer_attribute_value(&mut self, value_node: &HTMLAttributeValueNode) -> AttributeValue {
    let mut has_static = false;
    let mut has_dynamic = false;
    let mut static_parts = Vec::new();

    for child in &value_node.children {
      match child {
        AnyNode::LiteralNode(literal_node) => {
          has_static = true;
          static_parts.push(literal_node.content.clone());
        }

        AnyNode::ERBContentNode(_) => {
          has_dynamic = true;
        }

        _ => {}
      }
    }

    if has_dynamic && has_static {
      AttributeValue::Mixed
    } else if has_dynamic {
      AttributeValue::Dynamic
    } else if has_static {
      AttributeValue::Static(static_parts.join(""))
    } else {
      AttributeValue::Static(String::new())
    }
  }

  fn infer_if(&mut self, node: &ERBIfNode) -> Shape {
    let if_shape = self.infer_body(&node.statements);

    self.collect_if_branches(if_shape, &node.subsequent)
  }

  fn collect_if_branches(&mut self, first_branch: Shape, subsequent: &Option<ERBElseNodeOrERBIfNode>) -> Shape {
    match subsequent {
      None => Shape::Optional(Box::new(first_branch)),

      Some(ERBElseNodeOrERBIfNode::ERBElseNode(else_node)) => {
        let else_shape = self.infer_body(&else_node.statements);

        Shape::Union(vec![first_branch, else_shape])
      }

      Some(ERBElseNodeOrERBIfNode::ERBIfNode(elsif_node)) => {
        let elsif_shape = self.infer_body(&elsif_node.statements);

        match self.collect_if_branches(elsif_shape, &elsif_node.subsequent) {
          Shape::Union(mut branches) => {
            branches.insert(0, first_branch);

            Shape::Union(branches)
          }

          Shape::Optional(inner) => Shape::Optional(Box::new(Shape::Union(vec![first_branch, *inner]))),

          other => Shape::Union(vec![first_branch, other]),
        }
      }
    }
  }

  fn infer_unless(&mut self, node: &ERBUnlessNode) -> Shape {
    let body_shape = self.infer_body(&node.statements);

    match &node.else_clause {
      None => Shape::Optional(Box::new(body_shape)),

      Some(else_node) => {
        let else_shape = self.infer_body(&else_node.statements);

        Shape::Union(vec![body_shape, else_shape])
      }
    }
  }

  fn infer_case(&mut self, node: &ERBCaseNode) -> Shape {
    let mut branches: Vec<Shape> = Vec::new();

    for condition in &node.conditions {
      if let AnyNode::ERBWhenNode(when_node) = condition {
        branches.push(self.infer_body(&when_node.statements));
      }
    }

    if let Some(else_node) = &node.else_clause {
      branches.push(self.infer_body(&else_node.statements));
    }

    if branches.is_empty() {
      Shape::Empty
    } else {
      Shape::Union(branches)
    }
  }

  fn infer_case_match(&mut self, node: &ERBCaseMatchNode) -> Shape {
    let mut branches: Vec<Shape> = Vec::new();

    for condition in &node.conditions {
      if let AnyNode::ERBInNode(in_node) = condition {
        branches.push(self.infer_body(&in_node.statements));
      }
    }

    if let Some(else_node) = &node.else_clause {
      branches.push(self.infer_body(&else_node.statements));
    }

    if branches.is_empty() {
      Shape::Empty
    } else {
      Shape::Union(branches)
    }
  }

  fn infer_loop(&mut self, statements: &[AnyNode]) -> Shape {
    let body_shape = self.infer_body(statements);

    Shape::Repeated(Box::new(body_shape))
  }

  fn infer_block(&mut self, node: &ERBBlockNode) -> Shape {
    let is_iteration = node.content.as_ref().map(|token| Self::looks_like_iteration(&token.value)).unwrap_or(false);

    if is_iteration {
      let body_shape = self.infer_body(&node.body);

      return Shape::Repeated(Box::new(body_shape));
    }

    let body_shapes = self.infer_nodes(&node.body);

    if body_shapes.is_empty() {
      Shape::Dynamic
    } else {
      Shape::Sequence(body_shapes)
    }
  }

  fn looks_like_iteration(content: &str) -> bool {
    let content = content.trim();

    let iteration_methods = [
      ".each",
      ".each_with_index",
      ".each_with_object",
      ".each_slice",
      ".each_cons",
      ".map",
      ".flat_map",
      ".collect",
      ".times",
      ".upto",
      ".downto",
    ];

    for method in &iteration_methods {
      if content.contains(method) {
        return true;
      }
    }

    false
  }

  fn infer_begin(&mut self, node: &ERBBeginNode) -> Shape {
    let body_shape = self.infer_body(&node.statements);
    let mut branches = vec![body_shape];

    if let Some(rescue_node) = &node.rescue_clause {
      self.collect_rescue_branches(rescue_node, &mut branches);
    }

    if branches.len() == 1 {
      branches.pop().unwrap()
    } else {
      Shape::Union(branches)
    }
  }

  fn collect_rescue_branches(&mut self, rescue_node: &ERBRescueNode, branches: &mut Vec<Shape>) {
    branches.push(self.infer_body(&rescue_node.statements));

    if let Some(subsequent) = &rescue_node.subsequent {
      self.collect_rescue_branches(subsequent, branches);
    }
  }

  fn infer_erb_content(&mut self, node: &ERBContentNode) -> Shape {
    let is_output = node
      .tag_opening
      .as_ref()
      .map(|token| token.value == "<%=" || token.value == "<%==")
      .unwrap_or(false);

    if !is_output {
      return Shape::Empty;
    }

    if let Some(content_token) = &node.content {
      let content = content_token.value.trim();

      if let Some(partial_name) = self.try_detect_render_call(content) {
        return Shape::PartialRef(partial_name);
      }
    }

    Shape::Dynamic
  }

  fn try_detect_render_call(&self, content: &str) -> Option<String> {
    let content = content.trim();

    if let Some(rest) = content.strip_prefix("render ") {
      let rest = rest.trim();

      if let Some(name) = Self::extract_quoted_string(rest) {
        if Self::looks_like_partial_name(&name) {
          return Some(name);
        }
      }

      if let Some(rest) = rest.strip_prefix("partial:") {
        let rest = rest.trim();

        if let Some(name) = Self::extract_quoted_string(rest) {
          if Self::looks_like_partial_name(&name) {
            return Some(name);
          }
        }
      }
    }

    None
  }

  fn extract_quoted_string(source: &str) -> Option<String> {
    let source = source.trim();

    if (source.starts_with('"') && source.len() > 1) || (source.starts_with('\'') && source.len() > 1) {
      let quote = source.chars().next().unwrap();

      if let Some(end) = source[1..].find(quote) {
        return Some(source[1..=end].to_string());
      }
    }

    None
  }

  fn looks_like_partial_name(name: &str) -> bool {
    !name.is_empty()
      && name
        .chars()
        .all(|character| character.is_alphanumeric() || character == '_' || character == '/' || character == '-')
  }

  fn infer_body(&mut self, statements: &[AnyNode]) -> Shape {
    let shapes = self.infer_nodes(statements);

    Shape::Sequence(shapes)
  }
}
