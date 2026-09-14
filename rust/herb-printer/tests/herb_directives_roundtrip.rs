use herb_printer::IdentityPrinter;

fn roundtrip(source: &str) -> String {
  let options = herb::ParserOptions {
    track_whitespace: true,
    herb_directives: true,
    ..Default::default()
  };

  let result = herb::parse_with_options(source, &options).unwrap();

  IdentityPrinter::print_document(&result.value)
}

#[test]
fn roundtrips_directive_nodes() {
  let cases = [
    "<%# herb:state (open: false) %>\n",
    "<%# herb:state (open: false, count: 0) %>\n",
    "<%#- herb:state (open: false) -%>\n",
    "<%# herb:state (\n  open: false\n) %>\n",
    "<%# herb:state open: false %>\n",
    "<%# herb:disable erb-comment-syntax %>\n",
    "<%# herb:disable erb-comment-syntax, html-tag-name-lowercase %>\n",
    "<%# herb:disable erb-comment-syntax,html-tag-name-lowercase %>\n",
    "<%# herb:disable all %>\n",
    "<%# herb:disable erb-comment-syntax, %>\n",
    "<%# herb:disable ,erb-comment-syntax %>\n",
    "<%# herb:disableall %>\n",
    "<%# herb:disable-all %>\n",
    "<%# herb:slots client %>\n",
    "<%# herb:slots server %>\n",
    "<%# herb:slots client server %>\n",
    "<%# herb:formatter ignore %>\n",
    "<%# herb:formatter %>\n",
    "<%# herb:linter ignore %>\n",
    "<%# herb:key item.id %>\n",
    "<%# herb:key %>\n",
    "<%# herb:blahblah %>\n",
    "<%# herb:disable %>\n",
    "<DIV>text</DIV> <%# herb:disable html-tag-name-lowercase %>\n",
    "<% # herb:disable html-tag-name-lowercase %>\n",
    "<%-# herb:disable html-tag-name-lowercase %>\n",
    "<%# herb:slots client %>\n<%# herb:state (open: false) %>\n<%# herb:formatter ignore %>\n",
    "<div>\n  <%# herb:state (open: false) %>\n</div>\n",
    "<% items.each do |item| %>\n  <%# herb:state (open: false) %>\n<% end %>\n",
    "<%# an ordinary comment %>\n",
  ];

  let mut failures = Vec::new();

  for source in cases {
    let printed = roundtrip(source);

    if printed != source {
      failures.push(format!("{source:?} printed as {printed:?}"));
    }
  }

  assert!(failures.is_empty(), "printer did not round-trip:\n{}", failures.join("\n"));
}
