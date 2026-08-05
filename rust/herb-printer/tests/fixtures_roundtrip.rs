use herb_printer::IdentityPrinter;

#[test]
fn roundtrips_every_erb_fixture_in_the_repo() {
  let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().parent().unwrap();
  let mut checked = 0;
  let mut failures = Vec::new();

  visit(&root.join("examples"), &mut |path| {
    let source = match std::fs::read_to_string(path) {
      Ok(source) => source,
      Err(_) => return,
    };

    let options = herb::ParserOptions {
      track_whitespace: true,
      ..Default::default()
    };

    if let Ok(result) = herb::parse_with_options(&source, &options) {
      checked += 1;
      let printed = IdentityPrinter::print_document(&result.value);

      if printed != source {
        failures.push(path.display().to_string());
      }
    }
  });

  println!("checked {checked} fixtures, {} mismatches", failures.len());
  for failure in &failures {
    println!("  {failure}");
  }
  assert!(failures.is_empty());
}

fn visit(dir: &std::path::Path, callback: &mut impl FnMut(&std::path::Path)) {
  let entries = match std::fs::read_dir(dir) {
    Ok(entries) => entries,
    Err(_) => return,
  };

  for entry in entries.flatten() {
    let path = entry.path();

    if path.is_dir() {
      visit(&path, callback);
    } else if path.extension().and_then(|e| e.to_str()) == Some("erb") {
      callback(&path);
    }
  }
}
