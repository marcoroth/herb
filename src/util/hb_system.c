#include "../include/util/hb_system.h"

#ifdef __linux__
#define _GNU_SOURCE
#endif

#ifdef HB_USE_MMAP
#include <sys/mman.h>
#else
#include <stdlib.h>
#endif

void* hb_system_allocate_memory(size_t size) {
#ifdef HB_USE_MMAP
  void* memory = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (memory == MAP_FAILED) { return NULL; }

  return memory;
#else
  return malloc(size);
#endif
}

void hb_system_free_memory(void* ptr, size_t size) {
#ifdef HB_USE_MMAP
  munmap(ptr, size);
#else
  free(ptr);
#endif
}
