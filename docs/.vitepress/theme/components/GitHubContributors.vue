<script setup>
import { ref, onMounted } from 'vue'
import contributorsFile from '../../data/contributors.json'

const props = defineProps({
  owner: {
    type: String,
    required: true
  },
  repo: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    default: 20
  }
})

const contributors = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const excludedUsernames = ['marcoroth', 'dependabot[bot]']
    const filteredContributors = contributorsFile.filter(contributor => !excludedUsernames.includes(contributor.login))
    contributors.value = filteredContributors.slice(0, props.limit)

    loading.value = false
  } catch (err) {
    error.value = `Failed to load contributors data for ${props.owner}/${props.repo}. Make sure the data file exists.`
    loading.value = false
    console.error('Error loading contributors data:', err)
  }
})
</script>

<template>
  <div class="github-contributors">
    <div v-if="loading" class="loading">
      Loading contributors...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="contributors-grid">
      <a
        v-for="contributor in contributors"
        :key="contributor.id"
        :href="contributor.html_url"
        target="_blank"
        rel="noopener noreferrer"
        class="contributor-card"
      >
        <img
          :src="contributor.avatar_url"
          :alt="`${contributor.login}'s avatar`"
          class="avatar"
        />
        <div class="details">
          <span class="username">{{ contributor.login }}</span>
          <span class="contributions">{{ contributor.contributions }} {{ contributor.contributions === 1 ? 'commit' : 'commits' }}</span>
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.github-contributors {
  margin: 2rem 0;
}

.loading, .error {
  padding: 1rem;
  text-align: center;
}

.error {
  color: #e53935;
}

.contributors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.contributor-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: var(--vp-c-bg-soft);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-bottom: 0.5rem;
}

.details {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.username {
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.contributions {
  font-size: 0.875rem;
  opacity: 0.8;
}
</style>
