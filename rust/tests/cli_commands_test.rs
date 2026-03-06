use herb::{extract_html, extract_ruby, version};

#[test]
fn test_version_functions() {
  assert_eq!(version(), "herb rust v0.8.10, libprism v1.9.0, libherb v0.8.10 (Rust FFI)");
}

#[test]
fn test_extract_ruby() {
  let source = "<div><%= name %></div>";
  let ruby = extract_ruby(source).unwrap();
  assert_eq!(ruby, "         name  ;      ");
}

#[test]
fn test_extract_html() {
  let source = "<div><%= name %></div>";
  let html = extract_html(source).unwrap();
  assert_eq!(html, "<div>           </div>");
}

#[test]
fn test_extract_ruby_complex() {
  let source = r#"<div>
  <% users.each do |user| %>
    <p><%= user.name %></p>
  <% end %>
</div>"#;
  let ruby = extract_ruby(source).unwrap();
  assert_eq!(ruby, "     \n     users.each do |user|  ;\n           user.name  ;    \n     end  ;\n      ");
}

#[test]
fn test_extract_html_complex() {
  let source = r#"<div>
  <% users.each do |user| %>
    <p><%= user.name %></p>
  <% end %>
</div>"#;
  let html = extract_html(source).unwrap();
  assert_eq!(html, "<div>\n                            \n    <p>                </p>\n           \n</div>");
}
