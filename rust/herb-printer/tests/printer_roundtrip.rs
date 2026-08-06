use herb_printer::IdentityPrinter;

fn roundtrip(source: &str) -> String {
  let options = herb::ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };

  let result = herb::parse_with_options(source, &options).unwrap();

  IdentityPrinter::print_document(&result.value)
}

#[test]
fn identity_roundtrip() {
  let cases = [
    "<div>Hello</div>",
    "<DIV class='x'>Hi</DIV>\n",
    "<img src=\"a.png\" />",
    "<% if x %>\n  <p>a</p>\n<% else %>\n  <p>b</p>\n<% end %>\n",
    "<% items.each do |item| %>\n  <%= item %>\n<% end %>\n",
    "<!-- comment --><!DOCTYPE html>\n<ul>\n  <li>a\n  <li>b\n</ul>\n",
    "<%# locals: (a:) %>\n<div data-x=<%= y %> hidden>text &amp; more</div>\n",
    "<% case x %><% when 1 %>a<% else %>b<% end %>\n",
    "<% begin %>a<% rescue %>b<% ensure %>c<% end %>\n",
    "<svg><linearGradient/></svg>\n",
    "<%== raw %> <%- trim -%>\n",
  ];

  let mut failures = 0;

  for source in cases {
    let printed = roundtrip(source);

    if printed != source {
      failures += 1;
      println!("MISMATCH\n  in:  {:?}\n  out: {:?}", source, printed);
    }
  }

  assert_eq!(failures, 0, "{failures} roundtrip mismatches");
}
