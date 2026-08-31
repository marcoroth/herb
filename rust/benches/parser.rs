use divan::{black_box, Bencher};

use herb::{ExtractRubyOptions, ParserOptions};

const SMALL: &str = include_str!("fixtures/small.html.erb");
const PAGE: &str = include_str!("fixtures/page.html.erb");

const SIZES: [&str; 3] = ["small", "page", "large"];

fn source(size: &str) -> String {
  match size {
    "small" => SMALL.to_string(),
    "page" => PAGE.to_string(),
    "large" => PAGE.repeat(25),
    other => panic!("unknown fixture size: {other}"),
  }
}

fn main() {
  divan::main();
}

#[divan::bench(args = SIZES)]
fn lex(bencher: Bencher, size: &str) {
  let source = source(size);

  bencher.bench(|| herb::lex(black_box(&source)).unwrap());
}

#[divan::bench(args = SIZES)]
fn parse(bencher: Bencher, size: &str) {
  let source = source(size);

  bencher.bench(|| herb::parse(black_box(&source)).unwrap());
}

#[divan::bench(args = SIZES)]
fn parse_without_analyze(bencher: Bencher, size: &str) {
  let source = source(size);

  let options = ParserOptions {
    analyze: false,
    ..Default::default()
  };

  bencher.bench(|| herb::parse_with_options(black_box(&source), black_box(&options)).unwrap());
}

#[divan::bench(args = SIZES)]
fn parse_with_whitespace_tracking(bencher: Bencher, size: &str) {
  let source = source(size);

  let options = ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };

  bencher.bench(|| herb::parse_with_options(black_box(&source), black_box(&options)).unwrap());
}

#[divan::bench]
fn parse_with_prism_nodes(bencher: Bencher) {
  let source = source("page");

  let options = ParserOptions {
    prism_nodes: true,
    prism_program: true,
    ..Default::default()
  };

  bencher.bench(|| herb::parse_with_options(black_box(&source), black_box(&options)).unwrap());
}

#[divan::bench(args = SIZES)]
fn extract_ruby(bencher: Bencher, size: &str) {
  let source = source(size);

  bencher.bench(|| herb::extract_ruby(black_box(&source)).unwrap());
}

#[divan::bench]
fn extract_ruby_with_comments(bencher: Bencher) {
  let source = source("page");

  let options = ExtractRubyOptions {
    comments: true,
    ..Default::default()
  };

  bencher.bench(|| herb::extract_ruby_with_options(black_box(&source), black_box(&options)).unwrap());
}

#[divan::bench(args = SIZES)]
fn extract_html(bencher: Bencher, size: &str) {
  let source = source(size);

  bencher.bench(|| herb::extract_html(black_box(&source)).unwrap());
}

#[divan::bench]
fn diff_identical_documents(bencher: Bencher) {
  let source = source("page");

  bencher.bench(|| herb::diff(black_box(&source), black_box(&source)).unwrap());
}

#[divan::bench]
fn diff_modified_document(bencher: Bencher) {
  let old_source = source("page");
  let new_source = old_source.replace("Popular", "Trending").replace("class=\"tag\"", "class=\"tag tag--small\"");

  bencher.bench(|| herb::diff(black_box(&old_source), black_box(&new_source)).unwrap());
}
