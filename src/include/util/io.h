#ifndef HERB_IO_H
#define HERB_IO_H

#include <stdio.h>
#include <stdlib.h>

struct hb_allocator;

char* herb_read_file(const char* filename, struct hb_allocator* allocator);

#endif
