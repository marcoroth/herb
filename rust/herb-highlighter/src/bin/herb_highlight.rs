use std::env;
use std::fs;
use std::io::{self, IsTerminal, Read};
use std::path::{Path, PathBuf};
use std::process;

use herb_highlighter::diff_computer::DiffHunk;
use herb_highlighter::diff_renderer::DiffRenderOptions;
use herb_highlighter::highlighter::{HighlightOptions, Highlighter};
use herb_highlighter::html_sink::HTMLRenderOptions;
use herb_highlighter::stylesheet::generate_stylesheet;
use herb_highlighter::themes::{resolve_theme, DEFAULT_THEME, THEME_NAMES};
use herb_highlighter::unified_diff::parse_unified_diff;
use herb_highlighter::Diagnostic;

const NAME: &str = env!("CARGO_PKG_NAME");
const VERSION: &str = env!("CARGO_PKG_VERSION");

const USAGE: &str = "Usage: herb-highlight [file] [options]

Arguments:
  file                   File to highlight (required)

Options:
  -h, --help             how help
  -v, --version          show version
  --theme                color theme (onedark|github-light|dracula|tokyo-night|simple) or path to custom theme file [default: onedark]
  --format               output format (ansi|html|json) [default: ansi]
  --emit-css             print CSS for a theme or dark:light theme pair (e.g. onedark:github-light) and exit
  --focus                line number to focus on (shows only that line with context)
  --context-lines        number of context lines around focus line [default: 2]
  --no-line-numbers      hide line numbers and file path header
  --wrap-lines           enable line wrapping [default: true]
  --no-wrap-lines        disable line wrapping
  --truncate-lines       enable line truncation (mutually exclusive with --wrap-lines)
  --max-width            maximum width for line wrapping/truncation [default: terminal width]
  --diagnostics          JSON string or file path containing diagnostics to render
  --split-diagnostics    render each diagnostic individually (requires --diagnostics)
  --diff                 render a diff instead of a file

Diff two files, which can also be spelled as the `diff` subcommand:

  herb-highlight diff before.html.erb after.html.erb
  herb-highlight --diff before.html.erb after.html.erb

Or render a diff that was made elsewhere, taken from the argument or from stdin:

  git diff -- app/views | herb-highlight diff
  herb-highlight diff fix.json

That accepts unified diff text as produced by `git diff`, or JSON as
{\"original\": \"...\", \"modified\": \"...\"} or {\"hunks\": [...]}";

struct Diff {
  path: String,
  hunks: Option<Vec<DiffHunk>>,
  original: Option<String>,
  modified: Option<String>,
}

struct Arguments {
  positionals: Vec<String>,
  diff_mode: bool,
  theme: String,
  format: String,
  focus_line: Option<usize>,
  context_lines: usize,
  show_line_numbers: bool,
  wrap_lines: bool,
  truncate_lines: bool,
  max_width: Option<usize>,
  diagnostics: Vec<Diagnostic>,
  split_diagnostics: bool,
}

struct DiffOptions {
  theme: String,
  context_lines: usize,
  show_line_numbers: bool,
  wrap_lines: bool,
  truncate_lines: bool,
  max_width: Option<usize>,
}

pub struct CLI;

impl CLI {
  fn usage(&self) -> String {
    USAGE
      .replace("onedark|github-light|dracula|tokyo-night|simple", &THEME_NAMES.join("|"))
      .replace("[default: onedark]", &format!("[default: {}]", DEFAULT_THEME.as_str()))
  }

  fn parse_arguments(&self) -> Arguments {
    let mut values = ParsedValues::default();
    let mut positionals: Vec<String> = Vec::new();

    let arguments: Vec<String> = env::args().skip(1).collect();
    let mut index = 0;

    while index < arguments.len() {
      let argument = arguments[index].clone();

      let (name, inline_value) = match argument.split_once('=') {
        Some((name, value)) if name.starts_with('-') => (name.to_string(), Some(value.to_string())),
        _ => (argument.clone(), None),
      };

      match name.as_str() {
        "-h" | "--help" => values.help = true,
        "-v" | "--version" => values.version = true,
        "--theme" => values.theme = next_value(&arguments, &mut index, &inline_value),
        "--format" => values.format = next_value(&arguments, &mut index, &inline_value),

        "--emit-css" => {
          values.emit_css_present = true;
          values.emit_css = next_value(&arguments, &mut index, &inline_value);
        }

        "--focus" => values.focus = next_value(&arguments, &mut index, &inline_value),
        "--context-lines" => values.context_lines = next_value(&arguments, &mut index, &inline_value),
        "--max-width" => values.max_width = next_value(&arguments, &mut index, &inline_value),
        "--diagnostics" => values.diagnostics = next_value(&arguments, &mut index, &inline_value),
        "--no-line-numbers" => values.no_line_numbers = true,
        "--wrap-lines" => values.wrap_lines = Some(true),
        "--no-wrap-lines" => values.no_wrap_lines = true,
        "--truncate-lines" => values.truncate_lines = true,
        "--split-diagnostics" => values.split_diagnostics = true,
        "--diff" => values.diff = true,

        _ => {
          if argument.starts_with('-') {
            eprintln!("Unknown option: {argument}");
            process::exit(1);
          }

          positionals.push(argument);
        }
      }

      index += 1;
    }

    if values.help {
      println!("{}", self.usage());
      process::exit(0);
    }

    if values.version {
      println!("Versions:");
      println!("  {NAME}@{VERSION}");

      for part in herb::version().split(", ") {
        println!("  {part}");
      }

      process::exit(0);
    }

    if values.emit_css_present {
      self.emit_css(values.emit_css.as_deref());
      process::exit(0);
    }

    let theme = values.theme.clone().unwrap_or_else(|| DEFAULT_THEME.as_str().to_string());

    let format = values.format.clone().unwrap_or_else(|| "ansi".to_string());

    if format != "ansi" && format != "html" && format != "json" {
      eprintln!("Invalid format: {format}. Valid formats: ansi, html, json.");
      process::exit(1);
    }

    let focus_line = values.focus.as_ref().map(|focus| match focus.parse::<usize>() {
      Ok(parsed) if parsed >= 1 => parsed,

      _ => {
        eprintln!("Invalid focus line: {focus}. Must be a positive integer.");
        process::exit(1);
      }
    });

    let context_lines = match &values.context_lines {
      Some(value) => match value.parse::<usize>() {
        Ok(parsed) => parsed,

        Err(_) => {
          eprintln!("Invalid context-lines: {value}. Must be a non-negative integer.");
          process::exit(1);
        }
      },

      None => 2,
    };

    let show_line_numbers = !values.no_line_numbers;

    let mut wrap_lines = true;
    let mut truncate_lines = false;

    if values.truncate_lines {
      truncate_lines = true;
      wrap_lines = false;
    } else if values.no_wrap_lines {
      wrap_lines = false;
    } else if let Some(value) = values.wrap_lines {
      wrap_lines = value;
    }

    if values.wrap_lines == Some(true) && values.truncate_lines {
      eprintln!("Error: --wrap-lines and --truncate-lines cannot be used together.");
      process::exit(1);
    }

    let max_width = values.max_width.as_ref().map(|value| match value.parse::<usize>() {
      Ok(parsed) if parsed >= 1 => parsed,

      _ => {
        eprintln!("Invalid max-width: {value}. Must be a positive integer.");
        process::exit(1);
      }
    });

    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    if let Some(value) = &values.diagnostics {
      match parse_diagnostics(value) {
        Ok(parsed) => diagnostics = parsed,

        Err(error) => {
          eprintln!("Error parsing diagnostics: {error}");
          process::exit(1);
        }
      }
    }

    let mut split_diagnostics = false;

    if values.split_diagnostics {
      if diagnostics.is_empty() {
        eprintln!("Error: --split-diagnostics requires --diagnostics to be specified");

        process::exit(1);
      }

      split_diagnostics = true;
    }

    Arguments {
      positionals,
      diff_mode: values.diff,
      theme,
      format,
      focus_line,
      context_lines,
      show_line_numbers,
      wrap_lines,
      truncate_lines,
      max_width,
      diagnostics,
      split_diagnostics,
    }
  }

  fn emit_css(&self, value: Option<&str>) {
    let value = match value {
      Some(value) if !value.is_empty() => value,

      _ => {
        eprintln!("Error: --emit-css requires a theme name.");
        process::exit(1);
      }
    };

    let (dark_name, light_name) = match value.split_once(':') {
      Some((dark_name, light_name)) => (dark_name, Some(light_name)),
      None => (value, None),
    };

    let dark = match resolve_theme(dark_name) {
      Ok(scheme) => scheme,

      Err(error) => {
        eprintln!("Error: {error}");
        process::exit(1);
      }
    };

    let light = light_name.map(|name| match resolve_theme(name) {
      Ok(scheme) => scheme,

      Err(error) => {
        eprintln!("Error: {error}");
        process::exit(1);
      }
    });

    let stylesheet = generate_stylesheet(&dark, value, light.as_ref().zip(light_name));

    print!("{stylesheet}");
  }

  fn read_diff_input(&self, input: Option<&String>) -> String {
    let from_stdin = input.is_none_or(|input| input == "-");

    if from_stdin {
      if input.is_none() && io::stdin().is_terminal() {
        eprintln!("Error: --diff needs a JSON string, a file path, or input piped in on stdin.");
        process::exit(1);
      }

      let mut buffer = String::new();

      if io::stdin().read_to_string(&mut buffer).is_err() {
        eprintln!("Error: could not read the diff from stdin.");
        process::exit(1);
      }

      return buffer;
    }

    let input = input.expect("a non-stdin input is present");

    if input.trim_start().starts_with('{') || input.trim_start().starts_with('[') {
      return input.clone();
    }

    match fs::read_to_string(input) {
      Ok(contents) => contents,

      Err(error) => {
        eprintln!("Error parsing diff: {error}");
        process::exit(1);
      }
    }
  }

  fn diffs_from(&self, parsed: &serde_json::Value) -> Result<Vec<Diff>, String> {
    let path = parsed.get("filename").and_then(|filename| filename.as_str()).unwrap_or("").to_string();

    if let Some(hunks) = parsed.get("hunks") {
      if hunks.is_array() {
        let hunks: Vec<DiffHunk> = serde_json::from_value(hunks.clone()).map_err(|error| error.to_string())?;

        return Ok(vec![Diff {
          path,
          hunks: Some(hunks),
          original: None,
          modified: None,
        }]);
      }
    }

    if let (Some(original), Some(modified)) = (
      parsed.get("original").and_then(|original| original.as_str()),
      parsed.get("modified").and_then(|modified| modified.as_str()),
    ) {
      return Ok(vec![Diff {
        path,
        hunks: None,
        original: Some(original.to_string()),
        modified: Some(modified.to_string()),
      }]);
    }

    Err("Expected {\"original\", \"modified\"} or {\"hunks\"}".to_string())
  }

  fn diff_of_files(&self, first: &str, second: &str) -> Diff {
    for file in [first, second] {
      if !Path::new(file).exists() {
        eprintln!("File not found: {file}");
        process::exit(1);
      }
    }

    Diff {
      path: format!("{first} → {second}"),
      hunks: None,
      original: Some(fs::read_to_string(first).unwrap_or_default()),
      modified: Some(fs::read_to_string(second).unwrap_or_default()),
    }
  }

  fn run_diff(&self, inputs: &[String], options: &DiffOptions) {
    if inputs.len() > 2 {
      eprintln!("Error: --diff takes at most two files.");
      process::exit(1);
    }

    let diffs = if inputs.len() == 2 {
      vec![self.diff_of_files(&inputs[0], &inputs[1])]
    } else {
      let text = self.read_diff_input(inputs.first());
      let trimmed = text.trim_start();

      let parsed = if trimmed.starts_with('{') || trimmed.starts_with('[') {
        serde_json::from_str::<serde_json::Value>(&text)
          .map_err(|error| error.to_string())
          .and_then(|value| self.diffs_from(&value))
      } else {
        Ok(
          parse_unified_diff(&text)
            .into_iter()
            .map(|file| Diff {
              path: file.path,
              hunks: Some(file.hunks),
              original: None,
              modified: None,
            })
            .collect(),
        )
      };

      match parsed {
        Ok(diffs) => diffs,

        Err(error) => {
          eprintln!("Error parsing diff: {error}");
          process::exit(1);
        }
      }
    };

    if diffs.is_empty() {
      eprintln!("Error parsing diff: Found no hunks. Expected two files, JSON, or unified diff text as produced by `git diff`");
      process::exit(1);
    }

    let highlighter = match Highlighter::new(&options.theme) {
      Ok(highlighter) => highlighter,

      Err(error) => {
        eprintln!("Error: {error}");
        process::exit(1);
      }
    };

    let render_options = DiffRenderOptions {
      context_lines: options.context_lines,
      show_line_numbers: options.show_line_numbers,
      wrap_lines: options.wrap_lines,
      truncate_lines: options.truncate_lines,
      max_width: options.max_width,
      ..Default::default()
    };

    let rendered: Vec<String> = diffs
      .iter()
      .map(|diff| match &diff.hunks {
        Some(hunks) => highlighter.highlight_diff_hunks(&diff.path, hunks, &render_options),

        None => highlighter.highlight_diff(
          &diff.path,
          diff.original.as_deref().unwrap_or(""),
          diff.modified.as_deref().unwrap_or(""),
          &render_options,
        ),
      })
      .filter(|diff| !diff.is_empty())
      .collect();

    if rendered.is_empty() {
      eprintln!("No differences to render.");
      process::exit(1);
    }

    println!("{}", rendered.join("\n\n"));
  }

  pub fn run(&self) {
    let arguments = self.parse_arguments();

    let is_diff_subcommand = arguments.positionals.first().is_some_and(|positional| positional == "diff");
    let html_format = arguments.format == "html";
    let json_format = arguments.format == "json";

    if html_format {
      if !arguments.diagnostics.is_empty() {
        eprintln!("Error: --format html cannot render diagnostics yet.");
        process::exit(1);
      }

      if arguments.diff_mode || is_diff_subcommand {
        eprintln!("Error: --format html cannot render diffs yet.");
        process::exit(1);
      }
    }

    if json_format && (arguments.diff_mode || is_diff_subcommand) {
      eprintln!("Error: --format json cannot render diffs yet.");
      process::exit(1);
    }

    if arguments.diff_mode || is_diff_subcommand {
      let inputs = if is_diff_subcommand {
        arguments.positionals[1..].to_vec()
      } else {
        arguments.positionals.clone()
      };

      self.run_diff(
        &inputs,
        &DiffOptions {
          theme: arguments.theme,
          context_lines: arguments.context_lines,
          show_line_numbers: arguments.show_line_numbers,
          wrap_lines: arguments.wrap_lines,
          truncate_lines: arguments.truncate_lines,
          max_width: arguments.max_width,
        },
      );

      return;
    }

    if arguments.positionals.is_empty() {
      eprintln!("Please specify an input file.");
      process::exit(1);
    }

    let filename = &arguments.positionals[0];
    let file_path = resolve(filename);

    let content = match fs::read_to_string(&file_path) {
      Ok(content) => content,

      Err(error) if error.kind() == io::ErrorKind::NotFound => {
        eprintln!("File not found: {filename}");
        process::exit(1);
      }

      Err(error) => {
        eprintln!("Error: {error}");
        process::exit(1);
      }
    };

    let highlighter = match Highlighter::new(&arguments.theme) {
      Ok(highlighter) => highlighter,

      Err(error) => {
        eprintln!("Error: {error}");
        process::exit(1);
      }
    };

    if html_format {
      let highlighted = highlighter.highlight_html(
        &file_path.to_string_lossy(),
        &content,
        &HTMLRenderOptions {
          focus_line: arguments.focus_line,
          context_lines: arguments.context_lines,
          show_line_numbers: arguments.show_line_numbers,
          theme_label: arguments.theme.clone(),
        },
      );

      println!("{highlighted}");

      return;
    }

    let context_lines = if arguments.focus_line.is_some() || !arguments.diagnostics.is_empty() {
      arguments.context_lines
    } else {
      0
    };

    let options = HighlightOptions {
      diagnostics: &arguments.diagnostics,
      split_diagnostics: arguments.split_diagnostics,
      focus_line: arguments.focus_line,
      context_lines,
      show_line_numbers: arguments.show_line_numbers,
      wrap_lines: arguments.wrap_lines,
      truncate_lines: arguments.truncate_lines,
      max_width: arguments.max_width,
      ..Default::default()
    };

    if json_format {
      let document = highlighter.build_document(&file_path.to_string_lossy(), &content, &options);

      match serde_json::to_string_pretty(&document) {
        Ok(json) => println!("{json}"),

        Err(error) => {
          eprintln!("Error: {error}");
          process::exit(1);
        }
      }

      return;
    }

    let highlighted = highlighter.highlight(&file_path.to_string_lossy(), &content, &options);

    println!("{highlighted}");
  }
}

#[derive(Default)]
struct ParsedValues {
  help: bool,
  version: bool,
  theme: Option<String>,
  format: Option<String>,
  emit_css: Option<String>,
  emit_css_present: bool,
  focus: Option<String>,
  context_lines: Option<String>,
  no_line_numbers: bool,
  wrap_lines: Option<bool>,
  no_wrap_lines: bool,
  truncate_lines: bool,
  max_width: Option<String>,
  diagnostics: Option<String>,
  split_diagnostics: bool,
  diff: bool,
}

fn next_value(arguments: &[String], index: &mut usize, inline_value: &Option<String>) -> Option<String> {
  match inline_value {
    Some(value) => Some(value.clone()),

    None => {
      *index += 1;

      arguments.get(*index).cloned()
    }
  }
}

fn resolve(path: &str) -> PathBuf {
  let path = Path::new(path);

  if path.is_absolute() {
    return path.to_path_buf();
  }

  env::current_dir().unwrap_or_else(|_| PathBuf::from(".")).join(path)
}

fn parse_diagnostics(value: &str) -> Result<Vec<Diagnostic>, String> {
  let diagnostics_data = if value.starts_with('{') || value.starts_with('[') {
    value.to_string()
  } else {
    fs::read_to_string(value).map_err(|error| error.to_string())?
  };

  let parsed: serde_json::Value = serde_json::from_str(&diagnostics_data).map_err(|error| error.to_string())?;

  let entries = match parsed {
    serde_json::Value::Array(entries) => entries,
    other => vec![other],
  };

  let mut diagnostics: Vec<Diagnostic> = Vec::new();

  for entry in entries {
    if entry.get("message").is_none() || entry.get("location").is_none() || entry.get("severity").is_none() {
      return Err("Invalid diagnostic format: each diagnostic must have message, location, and severity".to_string());
    }

    diagnostics.push(serde_json::from_value(entry).map_err(|error| error.to_string())?);
  }

  Ok(diagnostics)
}

fn main() {
  CLI.run();
}
