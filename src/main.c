#include "include/buffer.h"
#include "include/erbx.h"
#include "include/io.h"

#include <string.h>
#include <stdint.h>
#include <stdio.h>

int main(int argc, char* argv[]) {
  if (argc < 2) {
    printf("Please specify input file.\n");

    return 1;
  }

  char* source = erbx_read_file(argv[1]);
  buffer_T output;
  const char *ruby_code = "def hello\n  puts 'Hello, World!'\nend\n";
  const uint8_t *sourcee = (const uint8_t *)ruby_code;
  size_t length = strlen(ruby_code);
  erbx_parse(sourcee, length);

  if (!buffer_init(&output)) return 1;

  erbx_lex_to_buffer(source, &output);

  printf("%s", output.value);

  buffer_free(&output);
  free(source);

  return 0;
}
