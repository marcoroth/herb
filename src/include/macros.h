#ifndef ERBX_MACROS_H
#define ERBX_MACROS_H

#define MAX(a, b) (a) > (b) ? (a) : (b)

#define MIN(a, b) (a) < (b) ? (a) : (b)

#define unlikely(x) __builtin_expect(!!(x), 0)

#endif
