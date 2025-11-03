# frozen_string_literal: true

module CompareHelpers
  def box_header(title, width = 80)
    padding = width - title.length - 2
    left_pad = padding / 2
    right_pad = padding - left_pad

    puts "╔#{'═' * (width - 2)}╗"
    puts "║#{' ' * left_pad}#{title}#{' ' * right_pad}║"
    puts "╚#{'═' * (width - 2)}╝"
  end

  def box_with_content(title, content, width = 80)
    padding = width - title.length - 2
    left_pad = padding / 2
    right_pad = padding - left_pad

    puts "╔#{'═' * (width - 2)}╗"
    puts "║#{' ' * left_pad}#{title}#{' ' * right_pad}║"
    puts "╠#{'═' * (width - 2)}╣"
    puts content
    puts "╚#{'═' * (width - 2)}╝"
  end

  def section_header(title, width = 80)
    puts ""
    puts ""
    puts "#{title}:"
    puts "─" * width
  end

  def show_template(file_path, template, width = 80)
    puts "Template: #{file_path}"
    puts "─" * width
    puts template
    puts "─" * width
    puts ""
  end

  def load_dependencies
    $LOAD_PATH.unshift File.expand_path("../../lib", __dir__)
    require "herb"

    begin
      original_verbose = $VERBOSE
      $VERBOSE = nil
      require "erubi"
    rescue LoadError
      puts "Error: Erubi gem is not available."
      puts "Install with: gem install erubi"
      exit(1)
    ensure
      $VERBOSE = original_verbose
    end

    begin
      require "difftastic"
    rescue LoadError
      puts "Error: Difftastic gem is not available."
      puts "Install with: gem install difftastic"
      exit(1)
    end
  end

  def parse_common_options(opts, options)
    opts.on("--no-escape", "Disable HTML escaping") do
      options[:escape] = false
    end

    opts.on("--escape", "Enable HTML escaping") do
      options[:escape] = true
    end

    opts.on("--no-template", "Don't show the input template") do
      options[:show_template] = false
    end

    opts.on("-h", "--help", "Show this help message") do
      yield if block_given?
    end
  end

  def require_erubi_silently
    original_verbose = $VERBOSE
    $VERBOSE = nil
    require "erubi"
  ensure
    $VERBOSE = original_verbose
  end

  def diff_compiled_sources(erubi_src, herb_src)
    return nil if erubi_src == herb_src

    output = ""
    output += "String Comparison (including formatting differences):\n"
    output += "─" * 80 + "\n"

    string_diff = Difftastic::Differ.new(
      color: :always,
      left_label: "Erubi::Engine compiled",
      right_label: "Herb::Engine compiled"
    ).diff_strings(erubi_src, herb_src)

    output += string_diff

    if !string_diff.strip.empty? && !string_diff.include?("No changes.")
      output += "\n\n"
      output += "Ruby AST Comparison (semantic differences only):\n"
      output += "─" * 80 + "\n"

      begin
        ast_diff = Difftastic::Differ.new(
          color: :always,
          left_label: "Erubi::Engine compiled",
          right_label: "Herb::Engine compiled"
        ).diff_ruby(erubi_src, herb_src)

        if ast_diff.strip.empty? || ast_diff.include?("No changes.")
          output += "✓ ASTs are identical (only formatting differs)"
        else
          output += ast_diff
        end
      rescue StandardError => e
        output += "Could not parse as Ruby: #{e.message}"
      end
    end

    output
  end

  def diff_rendered_outputs(erubi_output, herb_output)
    return nil if erubi_output == herb_output

    output = ""
    output += "String Comparison:\n"
    output += "─" * 80 + "\n"

    string_diff = Difftastic::Differ.new(
      color: :always,
      left_label: "Erubi::Engine output",
      right_label: "Herb::Engine output"
    ).diff_strings(erubi_output, herb_output)

    output += string_diff

    if !string_diff.strip.empty? && !string_diff.include?("No changes.")
      output += "\n\n"
      output += "HTML Semantic Comparison:\n"
      output += "─" * 80 + "\n"

      begin
        html_diff = Difftastic::Differ.new(
          color: :always,
          left_label: "Erubi::Engine output",
          right_label: "Herb::Engine output"
        ).diff_html(erubi_output, herb_output)

        if html_diff.strip.empty? || html_diff.include?("No changes.")
          output += "✓ HTML semantics are identical (only formatting/whitespace differs)"
        else
          output += html_diff
        end
      rescue StandardError => e
        output += "Could not parse as HTML: #{e.message}"
      end
    end

    output
  end
end
