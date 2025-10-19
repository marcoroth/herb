#include "include/io.h"
#include "include/util/hb_buffer.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

#define FILE_READ_CHUNK 4096

char* herb_read_file(const char* filename) {
  if (!filename) { return NULL; }

  FILE* fp = fopen(filename, "rb");

  if (fp == NULL) {
    fprintf(stderr, "Could not read file '%s'\n", filename);
    exit(1);
  }

  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 4096);

  char chunk[FILE_READ_CHUNK];
  size_t bytes_read;

  while ((bytes_read = fread(chunk, 1, FILE_READ_CHUNK, fp)) > 0) {
    hb_buffer_append_with_length(&buffer, chunk, bytes_read);
  }

  fclose(fp);

  return hb_buffer_value(&buffer);
}
