<script setup>
  import { VPTeamMembers } from "vitepress/theme"

  const creator = {
    avatar: "https://www.github.com/marcoroth.png",
    name: "Marco Roth",
    title: "Creator and Project Lead",
    links: [
      { icon: "github", link: "https://github.com/marcoroth" },
      { icon: "twitter", link: "https://twitter.com/marcoroth_" },
      { icon: "mastodon", link: "https://ruby.social/@marcoroth" },
      { icon: "bluesky", link: "https://bsky.app/profile/marcoroth.dev" },
    ]
  }
</script>

# About Herb

The Herb Project was created and is led by Marco Roth.

## Maintainers

<VPTeamMembers size="small" :members="[creator]" />

## Contributors

Herb wouldn't be possible without all its contributors. Thank you to all the amazing people who have directly contributed to the project:

<GitHubContributors owner="marcoroth" repo="herb" :limit="30" />
