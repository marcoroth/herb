#include "include/buffer.h"
#include "include/erbx.h"
#include "include/io.h"

#include <stdio.h>

int main(int argc, char *argv[]) {
  if (argc < 2) {
    printf("Please specify input file.\n");

    return 1;
  }

  char *source = erbx_read_file(argv[1]);
  buffer_T output;

  buffer_init(&output);

  erbx_lex_to_buffer(source, &output);

  printf("%s", output.value);

  buffer_free(&output);
  free(source);

  return 0;
}
