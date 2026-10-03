use herb::position::Position;
use herb::source_path::SourcePath;

const PATH: &str = "app/views/posts/_card.html.erb";

fn build(line: Option<u32>, column: Option<u32>) -> SourcePath {
  SourcePath {
    path: PATH.into(),
    project_path: None,
    line,
    column,
    scheme: None,
  }
}

#[test]
fn test_a_path_that_points_nowhere_in_particular_stays_a_path() {
  assert_eq!(SourcePath::new(PATH).to_string(), PATH);
}

#[test]
fn test_writes_a_line_on_its_own() {
  assert_eq!(build(Some(8), None).to_string(), format!("{PATH}:8"));
}

#[test]
fn test_writes_the_column_one_further_along_than_the_parser_reports() {
  assert_eq!(build(Some(8), Some(2)).to_string(), format!("{PATH}:8:3"));
}

#[test]
fn test_writes_the_first_column_as_one() {
  assert_eq!(build(Some(8), Some(0)).to_string(), format!("{PATH}:8:1"));
}

#[test]
fn test_writes_a_scheme_as_something_an_editor_opens() {
  let reference = build(Some(8), Some(2)).with_scheme(Some("vscode"));

  assert_eq!(reference.to_string(), format!("vscode://file/{PATH}:8:3"));
}

#[test]
fn test_reads_the_column_back_the_way_the_parser_reports_it() {
  let reference = SourcePath::parse(&format!("{PATH}:8:3")).unwrap();

  assert_eq!(reference.line, Some(8));
  assert_eq!(reference.column, Some(2));
}

#[test]
fn test_reads_a_line_on_its_own() {
  let reference = SourcePath::parse(&format!("{PATH}:8")).unwrap();

  assert_eq!(reference.line, Some(8));
  assert_eq!(reference.column, None);
}

#[test]
fn test_reads_a_column_of_zero_as_the_first_column() {
  assert_eq!(SourcePath::parse(&format!("{PATH}:8:0")).unwrap().column, Some(0));
}

#[test]
fn test_reads_a_scheme_and_the_path_it_names_from_the_root() {
  let reference = SourcePath::parse(&format!("vscode://file/{PATH}:8:3")).unwrap();

  assert_eq!(reference.scheme.as_deref(), Some("vscode"));
  assert_eq!(reference.path.to_str(), Some(format!("/{PATH}").as_str()));
}

#[test]
fn test_keeps_a_drive_letter_as_part_of_the_path() {
  let reference = SourcePath::parse("C:/views/index.html.erb:2:1").unwrap();

  assert_eq!(reference.path.to_str(), Some("C:/views/index.html.erb"));
  assert_eq!(reference.line, Some(2));
}

#[test]
fn test_answers_with_nothing_for_a_string_with_no_path_in_it() {
  assert!(SourcePath::parse("").is_none());
}

#[test]
fn test_round_trips_everything_it_writes() {
  let strings = [
    PATH.to_string(),
    format!("{PATH}:8"),
    format!("{PATH}:8:3"),
    format!("vscode://file/{PATH}:8:3"),
    format!("cursor://file/{PATH}"),
  ];

  for string in strings {
    assert_eq!(SourcePath::parse(&string).unwrap().to_string(), string, "round-tripping {string}");
  }
}

#[test]
fn test_at_takes_the_position_the_parser_reported() {
  assert_eq!(SourcePath::at(PATH, Some(Position::new(8, 2))).to_string(), format!("{PATH}:8:3"));
  assert_eq!(SourcePath::at(PATH, None).to_string(), PATH);
}

#[test]
fn test_position_round_trips() {
  let position = Position::new(8, 2);
  let written = SourcePath::at(PATH, Some(position)).to_string();

  assert_eq!(SourcePath::parse(&written).unwrap().position(), Some(position));
}

#[test]
fn test_position_answers_with_the_first_column_when_only_a_line_is_known() {
  assert_eq!(build(Some(8), None).position(), Some(Position::new(8, 0)));
  assert!(!SourcePath::new(PATH).has_position());
}

#[test]
fn test_changing_one() {
  let reference = build(Some(8), Some(2));

  assert_eq!(reference.with_path("other.html.erb").to_string(), "other.html.erb:8:3");
  assert_eq!(reference.with_scheme(Some("zed")).to_string(), format!("zed://file/{PATH}:8:3"));
  assert_eq!(reference.with_scheme(Some("zed")).with_scheme(None).to_string(), format!("{PATH}:8:3"));
  assert_eq!(reference.with_position(None).to_string(), PATH);
  assert_eq!(
    reference.with_scheme(Some("zed")).with_position(Some(Position::new(2, 0))).to_string(),
    format!("zed://file/{PATH}:2:1")
  );
}

const PROJECT: &str = "/Users/marco/blog";

fn within_project() -> SourcePath {
  SourcePath {
    path: PATH.into(),
    project_path: Some(PROJECT.into()),
    line: Some(8),
    column: Some(2),
    scheme: None,
  }
}

#[test]
fn test_a_project_writes_the_path_it_was_handed() {
  assert_eq!(within_project().to_string(), format!("{PATH}:8:3"));
}

#[test]
fn test_writes_one_out_in_full() {
  assert_eq!(within_project().absolute().to_string(), format!("{PROJECT}/{PATH}:8:3"));
}

#[test]
fn test_writes_one_relative_to_the_project_it_belongs_to() {
  let absolute = SourcePath::new(format!("{PROJECT}/{PATH}"))
    .with_project_path(Some(PROJECT))
    .with_position(Some(Position::new(8, 2)));

  assert_eq!(absolute.relative().to_string(), format!("{PATH}:8:3"));
}

#[test]
fn test_answers_a_path_outside_the_project_as_the_walk_up_and_back_down() {
  let outside = SourcePath::new("/etc/passwd").with_project_path(Some(PROJECT));

  assert_eq!(outside.relative().to_string(), "../../../etc/passwd");
}

#[test]
fn test_leaves_a_path_with_no_project_unchanged_either_way() {
  let reference = build(Some(8), None);

  assert_eq!(reference.relative().to_string(), format!("{PATH}:8"));
  assert_eq!(reference.absolute().to_string(), format!("{PATH}:8"));
}

#[test]
fn test_carries_the_project_through_everything_that_changes_one() {
  assert_eq!(
    within_project().with_scheme(Some("zed")).project_path.as_deref(),
    Some(std::path::Path::new(PROJECT))
  );
  assert_eq!(
    within_project().with_position(None).project_path.as_deref(),
    Some(std::path::Path::new(PROJECT))
  );
  assert_eq!(
    within_project().with_path("other.erb").project_path.as_deref(),
    Some(std::path::Path::new(PROJECT))
  );
}

#[test]
fn test_a_scheme_names_the_file_from_the_root() {
  let reference = SourcePath::new("/Users/marco/blog/x.erb")
    .with_position(Some(Position::new(8, 2)))
    .with_scheme(Some("vscode"));

  assert_eq!(reference.to_string(), "vscode://file/Users/marco/blog/x.erb:8:3");
}

#[test]
fn test_a_scheme_leads_with_a_separator_even_when_the_path_does_not() {
  assert_eq!(SourcePath::new("x.erb").with_scheme(Some("vscode")).to_string(), "vscode://file/x.erb");
}

#[test]
fn test_round_trips_one_an_editor_would_open() {
  let string = "vscode://file/Users/marco/blog/x.erb:8:3";
  let reference = SourcePath::parse(string).unwrap();

  assert_eq!(reference.to_string(), string);
  assert_eq!(reference.path.to_str(), Some("/Users/marco/blog/x.erb"));
}
