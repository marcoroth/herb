<script setup lang="ts">
  import { data as posts } from '../blog.data'

  function getDateTime(time: number) {
    return new Date(time).toISOString()
  }
</script>

<template>
  <div class="blog-grid">
    <div v-for="post of posts" :key="post.url" class="blog-entry">
      <article>
        <time :datetime="getDateTime(post.date.time)">{{
          post.date.string
        }}</time>

        <h2 class="title">
          <a :href="post.url">{{ post.title }}</a>
        </h2>

        <a v-if="post.image" :href="post.url" class="hero-link">
          <img :src="post.image" :alt="post.title" class="hero-image" data-no-zoom />
        </a>
      </article>
    </div>
  </div>
</template>

<style scoped>
  .blog-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2em;
    padding: 0;
  }

  @media (max-width: 640px) {
    .blog-grid {
      grid-template-columns: 1fr;
    }
  }

  .blog-entry {
    border-bottom: 1px solid var(--vp-c-divider);
    padding-bottom: 1.5em;
  }

  .blog-entry time {
    font-size: 14px;
  }

  .title {
    border: none;
    margin-top: 0;
    margin-bottom: 0.75em;
    padding-top: 0;
    font-size: 22px;
  }

  .title a {
    font-weight: 600;
    text-decoration: none;
  }

  .hero-link {
    display: block;
    margin-bottom: 1em;
  }

  .hero-image {
    width: 100%;
    border-radius: 8px;
  }
</style>
