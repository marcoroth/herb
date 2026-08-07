#ifndef HERB_HASH_H
#define HERB_HASH_H

#include <stddef.h>
#include <stdint.h>

#include "../lib/hb_string.h"

typedef uint64_t herb_hash_T;

// FNV-1a 64-bit hash constants
// Fowler-Noll-Vo hash function: http://www.isthe.com/chongo/tech/comp/fnv/
// Created by Glenn Fowler, Landon Curt Noll, and Kiem-Phong Vo
#define HERB_HASH_INIT ((herb_hash_T) 0xcbf29ce484222325ULL)
#define HERB_HASH_FNV_PRIME ((herb_hash_T) 0x100000001b3ULL)

herb_hash_T herb_hash_byte(herb_hash_T hash, uint8_t byte);
herb_hash_T herb_hash_bytes(herb_hash_T hash, const void* data, size_t length);
herb_hash_T herb_hash_uint32(herb_hash_T hash, uint32_t value);
herb_hash_T herb_hash_uint64(herb_hash_T hash, uint64_t value);
herb_hash_T herb_hash_bool(herb_hash_T hash, bool value);
herb_hash_T herb_hash_string(herb_hash_T hash, hb_string_T string);
herb_hash_T herb_hash_combine(herb_hash_T hash, herb_hash_T other);

#endif
