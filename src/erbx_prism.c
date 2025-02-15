#include "include/io.h"
#include "include/ruby_parser.h"
#include "include/extract.h"

#include <stdio.h>

int main(int argc, char* argv[]) {
  if (argc < 2) {
    printf("Please specify input file.\n");

    return 1;
  }

  char* html_erb_source = erbx_read_file(argv[1]);
  printf("HTML+ERB File: \n%s\n", html_erb_source);

  char* ruby_source = erbx_extract(html_erb_source, ERBX_EXTRACT_LANGUAGE_RUBY);
  printf("Extracted Ruby: \n%s\n", ruby_source);

  erbx_parse_ruby(ruby_source);

  return 0;
}
