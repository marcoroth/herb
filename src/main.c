#include "include/erbx.h"

#include <stdio.h>

int main(int argc, char* argv[]) {
  if (argc < 2) {
    printf("Please specify input file.\n");

    return 1;
  }

  erbx_compile_file(argv[1]);

  return 0;
}
