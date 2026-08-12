use herb_highlighter::diff_computer::{compute_diff_hunks, compute_inline_ranges, DiffLine, DiffLineType, InlineRange};
use herb_highlighter::unified_diff::parse_unified_diff;

fn line(line_type: DiffLineType, content: &str, old_line_number: Option<usize>, new_line_number: Option<usize>) -> DiffLine {
  DiffLine {
    line_type,
    content: content.to_string(),
    old_line_number,
    new_line_number,
  }
}

fn range(start: usize, end: usize) -> InlineRange {
  InlineRange { start, end }
}

#[test]
fn returns_no_hunks_for_identical_sources() {
  let source = "<div>\n  <span>content</span>\n</div>";

  assert!(compute_diff_hunks(source, source, 2).is_empty());
}

#[test]
fn pairs_a_replaced_line_as_a_removal_followed_by_an_addition() {
  let original = "<div>\n  <span class='card'>\n</div>";
  let modified = "<div>\n  <span class=\"card\">\n</div>";

  let hunks = compute_diff_hunks(original, modified, 2);

  assert_eq!(hunks.len(), 1);
  assert_eq!(
    hunks[0].lines,
    vec![
      line(DiffLineType::Context, "<div>", Some(1), Some(1)),
      line(DiffLineType::Removed, "  <span class='card'>", Some(2), None),
      line(DiffLineType::Added, "  <span class=\"card\">", None, Some(2)),
      line(DiffLineType::Context, "</div>", Some(3), Some(3)),
    ]
  );
}

#[test]
fn tracks_line_numbers_independently_once_the_line_count_changes() {
  let original = "<div>\n  <span>one</span>\n</div>";
  let modified = "<div>\n  <span>one</span>\n  <span>two</span>\n</div>";

  let hunks = compute_diff_hunks(original, modified, 2);

  let numbering: Vec<(DiffLineType, Option<usize>, Option<usize>)> = hunks[0]
    .lines
    .iter()
    .map(|line| (line.line_type, line.old_line_number, line.new_line_number))
    .collect();

  assert_eq!(
    numbering,
    vec![
      (DiffLineType::Context, Some(1), Some(1)),
      (DiffLineType::Context, Some(2), Some(2)),
      (DiffLineType::Added, None, Some(3)),
      (DiffLineType::Context, Some(3), Some(4)),
    ]
  );
}

#[test]
fn splits_distant_changes_into_separate_hunks() {
  let original = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].join("\n");
  let modified = ["A", "b", "c", "d", "e", "f", "g", "h", "I"].join("\n");

  let hunks = compute_diff_hunks(&original, &modified, 1);

  assert_eq!(hunks.len(), 2);
  assert_eq!(hunks[0].lines.iter().map(|line| line.content.as_str()).collect::<Vec<_>>(), vec!["a", "A", "b"]);
  assert_eq!(hunks[1].lines.iter().map(|line| line.content.as_str()).collect::<Vec<_>>(), vec!["h", "i", "I"]);
}

#[test]
fn keeps_nearby_changes_in_a_single_hunk() {
  let original = ["a", "b", "c", "d", "e"].join("\n");
  let modified = ["A", "b", "c", "d", "E"].join("\n");

  assert_eq!(compute_diff_hunks(&original, &modified, 2).len(), 1);
}

#[test]
fn reports_hunk_ranges_for_both_sides() {
  let original = ["a", "b", "c"].join("\n");
  let modified = ["a", "b", "b2", "c"].join("\n");

  let hunks = compute_diff_hunks(&original, &modified, 2);

  assert_eq!(hunks[0].old_start, 1);
  assert_eq!(hunks[0].old_count, 3);
  assert_eq!(hunks[0].new_start, 1);
  assert_eq!(hunks[0].new_count, 4);
}

#[test]
fn handles_a_pure_insertion_into_an_empty_source() {
  let hunks = compute_diff_hunks("", "<div></div>", 2);

  assert_eq!(
    hunks[0].lines,
    vec![
      line(DiffLineType::Removed, "", Some(1), None),
      line(DiffLineType::Added, "<div></div>", None, Some(1)),
    ]
  );
}

#[test]
fn returns_the_changed_characters_on_each_side() {
  let ranges = compute_inline_ranges("  <span class='card'>", "  <span class=\"card\">");

  assert_eq!(ranges.removed, vec![range(14, 15), range(19, 20)]);
  assert_eq!(ranges.added, vec![range(14, 15), range(19, 20)]);
}

#[test]
fn marks_only_the_inserted_text_for_a_pure_insertion() {
  let ranges = compute_inline_ranges("<img src=\"a.png\">", "<img src=\"a.png\" alt=\"\">");

  assert!(ranges.removed.is_empty());
  assert_eq!(ranges.added, vec![range(16, 23)]);
}

#[test]
fn returns_nothing_for_identical_lines() {
  let ranges = compute_inline_ranges("<div>", "<div>");

  assert!(ranges.removed.is_empty());
  assert!(ranges.added.is_empty());
}

#[test]
fn gives_up_when_the_lines_share_too_little_to_be_worth_refining() {
  let ranges = compute_inline_ranges("<div>hello</div>", "<section data-x>completely other</section>");

  assert!(ranges.removed.is_empty());
  assert!(ranges.added.is_empty());
}

#[test]
fn merges_changed_spans_separated_by_only_a_few_unchanged_characters() {
  let ranges = compute_inline_ranges("a-b-c-d", "aXbXcXd");

  assert_eq!(ranges.added, vec![range(1, 6)]);
}

#[test]
fn skips_refinement_for_very_long_lines() {
  let long = "a".repeat(600);
  let ranges = compute_inline_ranges(&long, &format!("{long}b"));

  assert!(ranges.removed.is_empty());
  assert!(ranges.added.is_empty());
}

const GIT_DIFF: &str = "diff --git a/app/views/gems/index.html.erb b/app/views/gems/index.html.erb
index 1a2b3c4..5d6e7f8 100644
--- a/app/views/gems/index.html.erb
+++ b/app/views/gems/index.html.erb
@@ -1,4 +1,4 @@
 <div id=\"gems\">
-  <span class='card'>x</span>
+  <span class=\"card\">x</span>
 </div>";

#[test]
fn reads_the_path_and_the_hunk_out_of_git_diff_output() {
  let files = parse_unified_diff(GIT_DIFF);

  assert_eq!(files.len(), 1);
  assert_eq!(files[0].path, "app/views/gems/index.html.erb");
  assert_eq!(
    files[0].hunks[0].lines,
    vec![
      line(DiffLineType::Context, "<div id=\"gems\">", Some(1), Some(1)),
      line(DiffLineType::Removed, "  <span class='card'>x</span>", Some(2), None),
      line(DiffLineType::Added, "  <span class=\"card\">x</span>", None, Some(2)),
      line(DiffLineType::Context, "</div>", Some(3), Some(3)),
    ]
  );
}

#[test]
fn carries_the_line_numbers_from_the_hunk_header() {
  let files = parse_unified_diff("--- a/x.erb\n+++ b/x.erb\n@@ -40,3 +58,3 @@\n <div>\n-  old\n+  new");

  assert_eq!(files[0].hunks[0].old_start, 40);
  assert_eq!(files[0].hunks[0].new_start, 58);
  assert_eq!(
    files[0].hunks[0]
      .lines
      .iter()
      .map(|line| (line.old_line_number, line.new_line_number))
      .collect::<Vec<_>>(),
    vec![(Some(40), Some(58)), (Some(41), None), (None, Some(59))]
  );
}

#[test]
fn keeps_each_file_of_a_multi_file_diff_separate() {
  let files =
    parse_unified_diff("--- a/one.erb\n+++ b/one.erb\n@@ -1 +1 @@\n-<P>a</P>\n+<p>a</p>\n--- a/two.erb\n+++ b/two.erb\n@@ -1 +1 @@\n-<B>b</B>\n+<b>b</b>");

  assert_eq!(files.iter().map(|file| file.path.as_str()).collect::<Vec<_>>(), vec!["one.erb", "two.erb"]);
  assert!(files.iter().all(|file| file.hunks.len() == 1));
}

#[test]
fn handles_several_hunks_in_one_file() {
  let files = parse_unified_diff("--- a/x.erb\n+++ b/x.erb\n@@ -1,2 +1,2 @@\n-<a>\n+<A>\n <p>\n@@ -20,2 +20,2 @@\n-<b>\n+<B>\n <q>");

  assert_eq!(files[0].hunks.len(), 2);
  assert_eq!(files[0].hunks[1].old_start, 20);
}

#[test]
fn skips_the_no_newline_marker_rather_than_treating_it_as_content() {
  let files = parse_unified_diff("--- a/x.erb\n+++ b/x.erb\n@@ -1 +1 @@\n-<p>a</p>\n\\ No newline at end of file\n+<p>b</p>");

  assert_eq!(
    files[0].hunks[0].lines.iter().map(|line| line.line_type).collect::<Vec<_>>(),
    vec![DiffLineType::Removed, DiffLineType::Added]
  );
}

#[test]
fn returns_nothing_for_text_that_holds_no_hunks() {
  assert!(parse_unified_diff("just some prose\nwith no diff in it").is_empty());
}
