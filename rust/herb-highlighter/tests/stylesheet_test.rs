use herb_highlighter::stylesheet::generate_stylesheet;
use herb_highlighter::themes::{get_theme, Theme};

#[test]
fn generates_custom_properties_for_a_single_theme() {
  insta::assert_snapshot!(generate_stylesheet(get_theme(Theme::OneDark), "onedark", None));
}

#[test]
fn generates_a_dark_light_pair() {
  insta::assert_snapshot!(generate_stylesheet(
    get_theme(Theme::OneDark),
    "onedark:github-light",
    Some((get_theme(Theme::GithubLight), "github-light"))
  ));
}

#[test]
fn maps_named_colors_to_hex() {
  insta::assert_snapshot!(generate_stylesheet(get_theme(Theme::Simple), "simple", None));
}
