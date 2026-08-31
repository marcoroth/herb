use divan::{black_box, Bencher};

use herb::nodes::DocumentNode;
use herb::ParserOptions;
use herb_printer::{ERBToRubyStringOptions, ERBToRubyStringPrinter, IdentityPrinter, IndentPrinter};

const SMALL: &str = include_str!("../../benches/fixtures/small.html.erb");
const PAGE: &str = include_str!("../../benches/fixtures/page.html.erb");

const SIZES: [&str; 3] = ["small", "page", "large"];

fn source(size: &str) -> String {
  match size {
    "small" => SMALL.to_string(),
    "page" => PAGE.to_string(),
    "large" => PAGE.repeat(25),
    other => panic!("unknown fixture size: {other}"),
  }
}

fn document(size: &str) -> DocumentNode {
  let options = ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };

  herb::parse_with_options(&source(size), &options).unwrap().value
}

fn main() {
  divan::main();
}

#[divan::bench(args = SIZES)]
fn identity_printer(bencher: Bencher, size: &str) {
  let document = document(size);

  bencher.bench(|| IdentityPrinter::print_document(black_box(&document)));
}

#[divan::bench(args = SIZES)]
fn indent_printer(bencher: Bencher, size: &str) {
  let document = document(size);

  bencher.bench(|| IndentPrinter::print_document(black_box(&document)));
}

#[divan::bench]
fn erb_to_ruby_string_printer(bencher: Bencher) {
  let document = document("page");
  let options = ERBToRubyStringOptions { force_quotes: false };

  bencher.bench(|| ERBToRubyStringPrinter::print_document_with_options(black_box(&document), black_box(&options)));
}

#[divan::bench]
fn parse_and_print_roundtrip(bencher: Bencher) {
  let source = source("page");

  let options = ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };

  bencher.bench(|| {
    let result = herb::parse_with_options(black_box(&source), black_box(&options)).unwrap();

    IdentityPrinter::print_document(&result.value)
  });
}
