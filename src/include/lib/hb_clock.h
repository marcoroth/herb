#ifndef HERB_CLOCK_H
#define HERB_CLOCK_H

#include <stdint.h>
#include <time.h>

static inline uint64_t hb_monotonic_ms(void) {
  struct timespec now;

#ifdef _MSC_VER
  // MSVC has no `clock_gettime()`. The wall clock is good enough for a parse deadline.
  timespec_get(&now, TIME_UTC);
#else
  clock_gettime(CLOCK_MONOTONIC, &now);
#endif

  return (uint64_t) now.tv_sec * 1000 + (uint64_t) now.tv_nsec / 1000000;
}

#endif
