#ifndef HERB_CLOCK_H
#define HERB_CLOCK_H

#ifndef _POSIX_C_SOURCE
  #define _POSIX_C_SOURCE 199309L
#endif

#include <stdint.h>
#include <time.h>

static inline uint64_t hb_monotonic_ms(void) {
  struct timespec now;

  clock_gettime(CLOCK_MONOTONIC, &now);

  return (uint64_t) now.tv_sec * 1000 + (uint64_t) now.tv_nsec / 1000000;
}

#endif
