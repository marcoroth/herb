use herb_printer::{ERBToRubyStringOptions, ERBToRubyStringPrinter};

fn print(source: &str) -> String {
  let result = herb::parse(source).unwrap();

  ERBToRubyStringPrinter::print_document(&result.value)
}

fn print_forced(source: &str) -> String {
  let result = herb::parse(source).unwrap();

  ERBToRubyStringPrinter::print_document_with_options(&result.value, &ERBToRubyStringOptions { force_quotes: true })
}

#[test]
fn converts_simple_text() {
  assert_eq!(print("hello world"), "\"hello world\"");
}

#[test]
fn converts_single_output_tag_to_raw_ruby() {
  assert_eq!(print("<%= hello %>"), "hello");
}

#[test]
fn converts_single_silent_tag() {
  assert_eq!(print("<% hello %>"), "\"\"");
}

#[test]
fn converts_output_tag_to_interpolation() {
  assert_eq!(print("hello world <%= hello %>"), "\"hello world #{hello}\"");
}

#[test]
fn converts_simple_if_else_to_ternary_without_quotes() {
  assert_eq!(print("<% if true %> hello <% else %> world <% end %>"), "true ? \" hello \" : \" world \"");
}

#[test]
fn ignores_silent_tags() {
  assert_eq!(print("hello world <% hello %>"), "\"hello world \"");
}

#[test]
fn handles_mixed_output_and_silent_tags() {
  assert_eq!(print("Welcome <%= user.name %><% puts \"debug\" %>!"), "\"Welcome #{user.name}!\"");
}

#[test]
fn handles_multiple_output_tags() {
  assert_eq!(print("Hello <%= first_name %> <%= last_name %>"), "\"Hello #{first_name} #{last_name}\"");
}

#[test]
fn handles_complex_expressions() {
  assert_eq!(print("Price: $<%= product.price.round(2) %>"), "\"Price: $#{product.price.round(2)}\"");
}

#[test]
fn handles_erb_with_html() {
  assert_eq!(print("<p>Welcome <%= user.name %>!</p>"), "\"<p>Welcome #{user.name}!</p>\"");
}

#[test]
fn handles_empty_erb_tags() {
  assert_eq!(print("text <%= %> more text"), "\"text #{} more text\"");
}

#[test]
fn handles_special_characters() {
  assert_eq!(print("Quote: \"<%= message %>\""), "\"Quote: \\\"#{message}\\\"\"");
}

#[test]
fn converts_if_else_to_ternary() {
  assert_eq!(
    print("<% if user.logged_in? %>Welcome<% else %>Please login<% end %>"),
    "user.logged_in? ? \"Welcome\" : \"Please login\""
  );
}

#[test]
fn converts_if_else_with_mixed_content() {
  assert_eq!(
    print("Hello <% if premium? %>Premium User<% else %>Guest<% end %>!"),
    "\"Hello #{premium? ? \"Premium User\" : \"Guest\"}!\""
  );
}

#[test]
fn if_without_else() {
  assert_eq!(print("<% if admin? %>Admin Panel<% end %>"), "admin? ? \"Admin Panel\" : \"\"");
}

#[test]
fn empty_if_else_branches() {
  assert_eq!(print("<% if condition? %><% else %>Empty<% end %>"), "condition? ? \"\" : \"Empty\"");
}

#[test]
fn adds_parentheses_for_complex_conditions() {
  assert_eq!(
    print("<% if user && user.active? %>Active<% else %>Inactive<% end %>"),
    "(user && user.active?) ? \"Active\" : \"Inactive\""
  );
}

#[test]
fn force_quotes_wraps_ternary() {
  assert_eq!(
    print_forced("<% if user && user.active? %>Active<% else %>Inactive<% end %>"),
    "\"#{(user && user.active?) ? \"Active\" : \"Inactive\"}\""
  );
}

#[test]
fn no_parentheses_for_simple_method_calls() {
  assert_eq!(
    print("<% if logged_in? %>Welcome<% else %>Login<% end %>"),
    "logged_in? ? \"Welcome\" : \"Login\""
  );
}

#[test]
fn does_not_convert_if_elsif_else() {
  assert_eq!(print("<% if admin? %>Admin<% elsif user? %>User<% else %>Guest<% end %>"), "\"\"");
}

#[test]
fn erb_static_erb_with_string() {
  assert_eq!(print("<%= root_path %>/assets/<%= \"icon.png\" %>"), "\"#{root_path}/assets/#{\"icon.png\"}\"");
}
