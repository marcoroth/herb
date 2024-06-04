#include "include/erbx.h"
#include "include/buffer.h"

#include <stdio.h>

int main(int argc, char* argv[]) {
  if (argc < 2) {
    printf("Please specify input file.\n");

    return 1;
  }

  buffer output;

  erbx_compile_file(argv[1], &output);

  printf("%s", output.value);

  buffer_free(&output);

  return 0;
}
