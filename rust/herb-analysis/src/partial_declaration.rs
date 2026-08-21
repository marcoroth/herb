use herb::nodes::{AnyNode, DocumentNode};

pub const KEYWORD_KIND: &str = "keyword";
pub const KEYWORD_REST_KIND: &str = "keyword_rest";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StrictLocal {
  pub name: String,
  pub required: bool,
  pub default_source: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DeclarationLocation {
  pub line: usize,
  pub column: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartialDeclaration {
  pub file: String,
  pub has_declaration: bool,
  pub has_keyword_rest: bool,
  pub locals: Vec<StrictLocal>,
  pub location: Option<DeclarationLocation>,
}

impl PartialDeclaration {
  pub fn without_strict_locals(file: &str) -> Self {
    Self {
      file: file.to_string(),
      has_declaration: false,
      has_keyword_rest: false,
      locals: Vec::new(),
      location: None,
    }
  }

  pub fn from_document(document: &DocumentNode, file: &str) -> Self {
    let mut declaration = Self::without_strict_locals(file);

    for child in &document.children {
      let AnyNode::ERBStrictLocalsNode(node) = child else {
        continue;
      };

      declaration.has_declaration = true;

      if declaration.location.is_none() {
        declaration.location = Some(DeclarationLocation {
          line: node.location.start.line as usize,
          column: node.location.start.column as usize,
        });
      }

      for local in &node.locals {
        let AnyNode::RubyParameterNode(parameter) = local else {
          continue;
        };

        if parameter.kind == KEYWORD_REST_KIND {
          declaration.has_keyword_rest = true;

          continue;
        }

        if parameter.kind != KEYWORD_KIND {
          continue;
        }

        if let Some(name) = &parameter.name {
          declaration.locals.push(StrictLocal {
            name: name.value.clone(),
            required: parameter.required,
            default_source: parameter.default_value.as_ref().map(|value| value.content.clone()),
          });
        }
      }
    }

    declaration
  }

  pub fn required_locals(&self) -> Vec<&str> {
    self.locals.iter().filter(|local| local.required).map(|local| local.name.as_str()).collect()
  }

  pub fn optional_locals(&self) -> Vec<&str> {
    self.locals.iter().filter(|local| !local.required).map(|local| local.name.as_str()).collect()
  }

  pub fn accepts(&self, local_name: &str) -> bool {
    if self.has_keyword_rest || !self.has_declaration {
      return true;
    }

    self.locals.iter().any(|local| local.name == local_name)
  }
}
