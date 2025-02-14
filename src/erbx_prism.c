#include "include/io.h"
#include "include/ruby_parser.h"

#include <stdio.h>

int main(int argc, char* argv[]) {
  if (argc < 2) {
    printf("Please specify input file.\n");

    return 1;
  }

  char* source = erbx_read_file(argv[1]);

  erbx_parse_ruby(source);

  return 0;
}
