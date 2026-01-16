#include "../include/util/hb_system.h"

#ifdef __linux__
#  define _GNU_SOURCE
#endif

#ifdef HB_USE_MALLOC
#  include <stdlib.h>
#else
#  include <sys/mman.h>
#endif

void* hb_system_allocate_memory(size_t size) {
#ifdef HB_USE_MALLOC
  return malloc(size);
#else
  void* memory = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (memory == MAP_FAILED) { return NULL; }

  return memory;
#endif
}

void hb_system_free_memory(void* ptr, size_t size) {
#ifdef HB_USE_MALLOC
  free(ptr);
#else
  munmap(ptr, size);
#endif
}
