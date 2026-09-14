// malloc_count.c — tiny malloc interposer used by bench/engine to track
// native allocations inside Herb's C extension (which are invisible to
// Ruby's GC.stat).
//
// On macOS we use Apple's __interpose section; on Linux we use the
// dlsym(RTLD_NEXT, ...) pattern with LD_PRELOAD. Either way, the shim
// increments atomic counters on every malloc/calloc/realloc and writes
// a JSON blob to $MALLOC_COUNT_OUT when the process exits.
//
// Notes / limits:
//   - We count *allocation-side* bytes only (calls to malloc/calloc/realloc).
//     Free is not counted. That matches what we want: total native memory
//     churn per compile pass.
//   - realloc growth is counted as (new_size). We don't try to subtract the
//     old block's size, so realloc-heavy workloads slightly over-count vs
//     "peak live bytes". This is fine for comparing engines relative to
//     each other on the same workload.
//   - Counters are process-wide. Each engine already runs in its own
//     subprocess, so numbers attribute cleanly.

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdatomic.h>
#include <stdint.h>

#ifndef __APPLE__
#define _GNU_SOURCE
#include <dlfcn.h>
#endif

static _Atomic uint64_t g_bytes   = 0;
static _Atomic uint64_t g_calls   = 0;
static _Atomic uint64_t g_reallocs = 0;
static _Atomic uint64_t g_callocs  = 0;

static void write_counters(void) {
    const char *out = getenv("MALLOC_COUNT_OUT");
    if (!out || !*out) return;

    FILE *f = fopen(out, "w");
    if (!f) return;

    // Snapshot the atomics into locals so the fprintf format specifiers
    // don't have to deal with _Atomic-qualified types.
    uint64_t bytes    = atomic_load(&g_bytes);
    uint64_t calls    = atomic_load(&g_calls);
    uint64_t reallocs = atomic_load(&g_reallocs);
    uint64_t callocs  = atomic_load(&g_callocs);

    fprintf(f,
            "{\"bytes\":%llu,\"calls\":%llu,\"reallocs\":%llu,\"callocs\":%llu}\n",
            (unsigned long long)bytes,
            (unsigned long long)calls,
            (unsigned long long)reallocs,
            (unsigned long long)callocs);
    fclose(f);
}

__attribute__((constructor))
static void init(void) {
    atexit(write_counters);
}

#ifdef __APPLE__
// On macOS, use Apple's __interpose section. The interpose table is a
// list of {replacement, original} pointers; dyld swaps calls to the
// original for calls to the replacement across every image in the
// process. This works without DYLD_FORCE_FLAT_NAMESPACE.

typedef struct interpose_s {
    const void *replacement;
    const void *original;
} interpose_t;

static void *my_malloc(size_t size) {
    atomic_fetch_add_explicit(&g_calls, 1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_bytes, size, memory_order_relaxed);
    return malloc(size);
}

static void *my_calloc(size_t nmemb, size_t size) {
    atomic_fetch_add_explicit(&g_callocs, 1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_calls,   1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_bytes,   nmemb * size, memory_order_relaxed);
    return calloc(nmemb, size);
}

static void *my_realloc(void *ptr, size_t size) {
    atomic_fetch_add_explicit(&g_reallocs, 1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_calls,    1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_bytes,    size, memory_order_relaxed);
    return realloc(ptr, size);
}

__attribute__((used))
static const interpose_t interposers[] __attribute__((section("__DATA,__interpose"))) = {
    { (const void *)my_malloc,  (const void *)malloc  },
    { (const void *)my_calloc,  (const void *)calloc  },
    { (const void *)my_realloc, (const void *)realloc },
};

#else
// Linux: LD_PRELOAD + dlsym(RTLD_NEXT, ...). Guard against recursive
// entry during dlsym itself, which allocates on some libc versions.

static void *(*real_malloc)(size_t)              = NULL;
static void *(*real_calloc)(size_t, size_t)      = NULL;
static void *(*real_realloc)(void *, size_t)     = NULL;

static _Thread_local int in_hook = 0;

static void resolve_real(void) {
    if (!real_malloc)  real_malloc  = dlsym(RTLD_NEXT, "malloc");
    if (!real_calloc)  real_calloc  = dlsym(RTLD_NEXT, "calloc");
    if (!real_realloc) real_realloc = dlsym(RTLD_NEXT, "realloc");
}

void *malloc(size_t size) {
    if (in_hook || !real_malloc) { resolve_real(); if (!real_malloc) return NULL; }
    atomic_fetch_add_explicit(&g_calls, 1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_bytes, size, memory_order_relaxed);
    return real_malloc(size);
}

void *calloc(size_t nmemb, size_t size) {
    // dlsym itself calls calloc on glibc; short-circuit until we have
    // resolved the real symbol.
    if (!real_calloc) {
        if (in_hook) return NULL;
        in_hook = 1;
        resolve_real();
        in_hook = 0;
    }
    atomic_fetch_add_explicit(&g_callocs, 1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_calls,   1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_bytes,   nmemb * size, memory_order_relaxed);
    return real_calloc(nmemb, size);
}

void *realloc(void *ptr, size_t size) {
    if (!real_realloc) resolve_real();
    atomic_fetch_add_explicit(&g_reallocs, 1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_calls,    1, memory_order_relaxed);
    atomic_fetch_add_explicit(&g_bytes,    size, memory_order_relaxed);
    return real_realloc(ptr, size);
}
#endif
