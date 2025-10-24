#ifndef HERB_MACROS_H
#define HERB_MACROS_H

#define MAX(a, b) ((a) > (b) ? (a) : (b))

#define MIN(a, b) ((a) < (b) ? (a) : (b))

#define KB(kb) (1024 * kb)

#define MB(mb) (1024 * KB(mb))

#define unlikely(x) __builtin_expect(!!(x), 0)

#endif
