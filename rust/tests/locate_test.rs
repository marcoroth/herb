use herb::locate::{locatable, locate};
use herb::parse;
use herb::position::Position;
use herb::Location;

const SOURCE: &str = "<div><span>hi</span></div>";

fn node_type_at(source: &str, line: u32, column: u32) -> Option<String> {
  let result = parse(source).unwrap();

  locate(&result.value, Position::new(line, column)).map(|found| found.node.node_type().to_string())
}

#[test]
fn test_finds_the_innermost_node_at_a_position() {
  assert_eq!(node_type_at(SOURCE, 1, 12), Some("AST_HTML_TEXT_NODE".to_string()));
}

#[test]
fn test_finds_an_open_tag_when_the_position_is_on_the_tag_name() {
  assert_eq!(node_type_at(SOURCE, 1, 7), Some("AST_HTML_OPEN_TAG_NODE".to_string()));
}

#[test]
fn test_finds_a_close_tag() {
  assert_eq!(node_type_at(SOURCE, 1, 15), Some("AST_HTML_CLOSE_TAG_NODE".to_string()));
}

#[test]
fn test_ancestors_read_nearest_first() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 12)).unwrap();

  let types: Vec<&str> = found.ancestors.iter().map(|node| node.node_type()).collect();

  assert_eq!(types, vec!["AST_HTML_ELEMENT_NODE", "AST_HTML_ELEMENT_NODE", "AST_DOCUMENT_NODE"]);
}

#[test]
fn test_ancestors_all_contain_the_position() {
  let result = parse(SOURCE).unwrap();
  let position = Position::new(1, 12);
  let found = locate(&result.value, position).unwrap();

  assert!(found.ancestors.iter().all(|node| node.location().contains(position)));
}

#[test]
fn test_a_position_past_the_end_belongs_to_no_node() {
  assert_eq!(node_type_at(SOURCE, 1, 999), None);
}

#[test]
fn test_a_position_on_a_line_that_does_not_exist_belongs_to_no_node() {
  assert_eq!(node_type_at(SOURCE, 99, 0), None);
}

#[test]
fn test_a_nodes_own_start_belongs_to_it() {
  assert_eq!(node_type_at(SOURCE, 1, 0), Some("AST_HTML_OPEN_TAG_NODE".to_string()));
}

#[test]
fn test_the_character_an_inner_node_starts_at_belongs_to_the_inner_node() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 5)).unwrap();

  assert_eq!(found.node.node_type(), "AST_HTML_OPEN_TAG_NODE");
  assert_eq!(found.node.location().start, Position::new(1, 5));
}

#[test]
fn test_the_character_before_it_belongs_to_the_node_that_ends_there() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 4)).unwrap();

  assert_eq!(found.node.location().start, Position::new(1, 0));
}

#[test]
fn test_innermost_answers_with_the_node_itself_when_it_matches() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 7)).unwrap();

  let innermost = found.innermost(|node| node.node_type() == "AST_HTML_OPEN_TAG_NODE").unwrap();

  assert_eq!(innermost.location().start, Position::new(1, 5));
}

#[test]
fn test_innermost_walks_up_to_the_nearest_ancestor_that_matches() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 12)).unwrap();

  let innermost = found.innermost(|node| node.node_type() == "AST_HTML_ELEMENT_NODE").unwrap();

  assert_eq!(innermost.location().start, Position::new(1, 5));
}

#[test]
fn test_innermost_answers_with_nothing_when_no_node_matches() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 12)).unwrap();

  assert!(found.innermost(|node| node.node_type() == "AST_ERB_CONTENT_NODE").is_none());
}

#[test]
fn test_path_reads_outermost_first_and_ends_with_the_node_that_was_found() {
  let result = parse(SOURCE).unwrap();
  let found = locate(&result.value, Position::new(1, 12)).unwrap();

  let types: Vec<&str> = found.path().iter().map(|node| node.node_type()).collect();

  assert_eq!(
    types,
    vec!["AST_DOCUMENT_NODE", "AST_HTML_ELEMENT_NODE", "AST_HTML_ELEMENT_NODE", "AST_HTML_TEXT_NODE"]
  );
}

#[test]
fn test_inside_an_erb_tag() {
  assert_eq!(node_type_at("<div><%= title %></div>", 1, 10), Some("AST_ERB_CONTENT_NODE".to_string()));
}

#[test]
fn test_location_contains_its_start_and_stops_short_of_its_end() {
  let location = Location::from(1, 0, 1, 5);

  assert!(location.contains(Position::new(1, 0)));
  assert!(location.contains(Position::new(1, 4)));
  assert!(!location.contains(Position::new(1, 5)));
}

#[test]
fn test_location_covers_another_location() {
  assert!(Location::from(1, 0, 3, 0).covers(Location::from(2, 0, 2, 4)));
  assert!(Location::from(1, 0, 3, 0).covers(Location::from(1, 0, 3, 0)));
  assert!(!Location::from(1, 0, 3, 0).covers(Location::from(2, 0, 4, 0)));
}

#[test]
fn test_location_is_empty_when_it_starts_where_it_ends() {
  assert!(Location::from(2, 7, 2, 7).is_empty());
  assert!(!Location::from(2, 7, 2, 8).is_empty());
}

#[test]
fn test_positions_order_the_way_they_read() {
  assert!(Position::new(1, 99) < Position::new(2, 0));
  assert!(Position::new(1, 4) < Position::new(1, 9));
  assert_eq!(Position::new(3, 2), Position::new(3, 2));
}

const BRANCHES: &str = "<% if a %>A<% elsif b %>B<% else %>C<% end %>";

#[test]
fn test_a_branch_of_an_if_is_reachable_even_though_it_sits_after_the_node_that_holds_it() {
  let result = parse(BRANCHES).unwrap();

  for column in [10, 24, 35] {
    let found = locate(&result.value, Position::new(1, column)).unwrap();

    assert_eq!(found.node.node_type(), "AST_HTML_TEXT_NODE", "column {column}");
  }
}

#[test]
fn test_a_branch_keeps_the_whole_walk_in_the_path() {
  let result = parse(BRANCHES).unwrap();
  let found = locate(&result.value, Position::new(1, 35)).unwrap();

  let types: Vec<&str> = found.path().iter().map(|node| node.node_type()).collect();

  assert_eq!(
    types,
    vec![
      "AST_DOCUMENT_NODE",
      "AST_ERB_IF_NODE",
      "AST_ERB_IF_NODE",
      "AST_ERB_ELSE_NODE",
      "AST_HTML_TEXT_NODE"
    ]
  );
}

#[test]
fn test_ancestors_that_do_not_cover_the_position_are_left_for_the_caller_to_filter() {
  let result = parse(BRANCHES).unwrap();
  let position = Position::new(1, 35);
  let found = locate(&result.value, position).unwrap();

  let covering: Vec<&str> = found
    .ancestors
    .iter()
    .filter(|node| node.location().contains(position))
    .map(|node| node.node_type())
    .collect();

  assert_eq!(covering, vec!["AST_ERB_ELSE_NODE", "AST_ERB_IF_NODE", "AST_DOCUMENT_NODE"]);
}

#[test]
fn test_a_parse_result_answers_for_the_document_it_parsed() {
  let result = parse(SOURCE).unwrap();

  let from_result = locate(&result, Position::new(1, 12)).unwrap();
  let from_document = locate(&result.value, Position::new(1, 12)).unwrap();

  assert_eq!(from_result.node.node_type(), from_document.node.node_type());
  assert_eq!(from_result.node.location(), from_document.node.location());
}

#[test]
fn test_locatable_answers_for_a_position_the_node_covers() {
  let result = parse(SOURCE).unwrap();

  assert!(locatable(&result, Position::new(1, 12)));
  assert!(!locatable(&result, Position::new(1, 999)));
}

#[test]
fn test_locatable_answers_for_a_position_only_a_branch_covers() {
  let result = parse(BRANCHES).unwrap();

  assert!(locatable(&result.value, Position::new(1, 35)));
}

#[test]
fn test_a_parse_result_answers_for_itself() {
  let result = parse(SOURCE).unwrap();

  assert_eq!(result.locate(Position::new(1, 12)).unwrap().node.node_type(), "AST_HTML_TEXT_NODE");

  assert!(result.locatable(Position::new(1, 12)));
  assert!(!result.locatable(Position::new(1, 999)));
}

#[test]
fn test_a_node_answers_for_itself() {
  use herb::locate::NodeLocate;

  let result = parse(SOURCE).unwrap();

  assert_eq!(result.value.locate(Position::new(1, 12)).unwrap().node.node_type(), "AST_HTML_TEXT_NODE");

  assert!(result.value.locatable(Position::new(1, 12)));
  assert!(!result.value.locatable(Position::new(1, 999)));
}

#[test]
fn test_a_node_reached_through_a_walk_answers_for_itself_too() {
  use herb::locate::NodeLocate;

  let result = parse(SOURCE).unwrap();
  let found = result.value.locate(Position::new(1, 12)).unwrap();
  let span = found.innermost(|node| node.node_type() == "AST_HTML_ELEMENT_NODE").unwrap();

  assert_eq!(span.locate(Position::new(1, 12)).unwrap().node.node_type(), "AST_HTML_TEXT_NODE");
}
