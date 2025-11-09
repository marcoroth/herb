#ifndef HERB_SYSTEM_H
#define HERB_SYSTEM_H

#include <stddef.h>

void* hb_system_allocate_memory(size_t size);
void hb_system_free_memory(void* ptr, size_t size);

#endif
