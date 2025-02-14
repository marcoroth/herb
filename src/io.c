#include "include/io.h"
#include "include/buffer.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

#define FILE_READ_CHUNK 4096

char* erbx_read_file(const char* filename) {
  FILE* fp = fopen(filename, "rb");

  if (fp == NULL) {
    fprintf(stderr, "Could not read file '%s'\n", filename);
    exit(1);
  }

  buffer_T buffer = buffer_new();

  char chunk[FILE_READ_CHUNK];
  size_t bytes_read;

  while ((bytes_read = fread(chunk, 1, FILE_READ_CHUNK, fp)) > 0) {
    buffer_append(&buffer, chunk);
  }

  fclose(fp);

  return buffer_value(&buffer);
}
