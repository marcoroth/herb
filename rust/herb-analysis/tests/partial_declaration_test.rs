use herb::herb::{parse_with_options, ParserOptions};
use herb_analysis::partial_declaration::PartialDeclaration;

const FILE: &str = "app/views/posts/_card.html.erb";

fn declaration_for(source: &str) -> PartialDeclaration {
  let options = ParserOptions {
    strict_locals: true,
    ..Default::default()
  };

  let result = parse_with_options(source, &options).expect("parse failed");

  PartialDeclaration::from_document(&result.value, FILE)
}

#[test]
fn reports_no_declaration_for_a_partial_without_strict_locals() {
  let declaration = declaration_for("<div></div>");

  assert!(!declaration.has_declaration);
  assert!(declaration.locals.is_empty());
}

#[test]
fn collects_a_required_local() {
  let declaration = declaration_for("<%# locals: (title:) %>\n<h1></h1>");

  assert!(declaration.has_declaration);
  assert_eq!(declaration.required_locals(), vec!["title"]);
  assert!(declaration.optional_locals().is_empty());
}

#[test]
fn collects_an_optional_local() {
  let declaration = declaration_for("<%# locals: (title: nil) %>\n<h1></h1>");

  assert_eq!(declaration.optional_locals(), vec!["title"]);
  assert!(declaration.required_locals().is_empty());
}

#[test]
fn records_a_keyword_rest() {
  let declaration = declaration_for("<%# locals: (title:, **rest) %>\n<h1></h1>");

  assert!(declaration.has_keyword_rest);
  assert_eq!(declaration.required_locals(), vec!["title"]);
}

#[test]
fn records_where_the_declaration_is() {
  let declaration = declaration_for("<%# locals: (title:) %>\n<h1></h1>");

  assert_eq!(declaration.location.expect("location").line, 1);
}

#[test]
fn accepts_any_local_when_the_partial_declares_none() {
  assert!(declaration_for("<div></div>").accepts("anything"));
}

#[test]
fn accepts_any_local_when_the_partial_takes_a_keyword_rest() {
  assert!(declaration_for("<%# locals: (title:, **rest) %>").accepts("anything"));
}

#[test]
fn rejects_a_local_the_partial_does_not_declare() {
  let declaration = declaration_for("<%# locals: (title:) %>");

  assert!(declaration.accepts("title"));
  assert!(!declaration.accepts("subtitle"));
}
