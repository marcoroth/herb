#include "include/buffer.h"
#include "include/erbx.h"
#include "include/io.h"

#include <stdio.h>
#include <string.h>

int main(int argc, char* argv[]) {
  if (argc < 2) {
    printf("./erbx [command] [options]\n\n");

    printf("ERBX - Seamless and powerful HTML+ERB parsing.\n\n");

    printf("./erbx lex [file]     -  Lex a file\n");
    printf("./erbx parse [file]   -  Parse a file\n");
    printf("./erbx ruby [file]    -  Extract Ruby from a file\n");
    printf("./erbx html [file]    -  Extract HTML from a file\n");
    printf("./erbx prism [file]   -  Extract Ruby from a file and parse the Ruby source with Prism\n");

    return 1;
  }

  if (argc < 3) {
    printf("Please specify input file.\n");
    return 1;
  }

  buffer_T output;

  if (!buffer_init(&output)) return 1;

  char* source = erbx_read_file(argv[2]);

  if (strcmp(argv[1], "lex") == 0) {
    erbx_lex_to_buffer(source, &output);

    printf("%s", output.value);

    buffer_free(&output);
    free(source);

    return 0;
  }

  if (strcmp(argv[1], "parse") == 0) {
    printf("Not implemented yet.\n");
    return 1;
  }

  if (strcmp(argv[1], "ruby") == 0) {
    erbx_extract_ruby_to_buffer(source, &output);

    printf("%s", output.value);

    buffer_free(&output);
    free(source);

    return 0;
  }

  if (strcmp(argv[1], "html") == 0) {
    erbx_extract_html_to_buffer(source, &output);

    printf("%s", output.value);

    buffer_free(&output);
    free(source);

    return 0;
  }

  if (strcmp(argv[1], "prism") == 0) {
    printf("Not implemented yet.\n");
    return 1;
  }

  printf("Unknown Command: %s\n", argv[1]);
  return 1;
}
