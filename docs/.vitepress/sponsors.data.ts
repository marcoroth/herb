import { defineLoader } from "vitepress"

export interface Sponsor {
  login: string
  name: string
}

export interface Sponsors {
  companies: Sponsor[]
  people: Sponsor[]
  total: number
}

declare const data: Sponsors
export { data }

const query = `{
  user(login: "marcoroth") {
    sponsors(first: 100) {
      totalCount
      nodes {
        __typename
        ... on User { login name }
        ... on Organization { login name }
      }
    }
  }
}`

function toSponsor(node: { login: string; name: string | null }): Sponsor {
  return { login: node.login, name: node.name || node.login }
}

export default defineLoader({
  async load(): Promise<Sponsors> {
    try {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

      if (!token) throw new Error("neither GITHUB_TOKEN nor GH_TOKEN is set")

      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) throw new Error(`GitHub answered ${response.status}`)

      const body = await response.json()

      if (body.errors) throw new Error(body.errors.map((error: { message: string }) => error.message).join(", "))

      const sponsors = body.data?.user?.sponsors
      const nodes = (sponsors?.nodes ?? []).filter(Boolean)

      if (nodes.length === 0) throw new Error("GitHub returned no sponsors")

      return {
        companies: nodes.filter((node: { __typename: string }) => node.__typename === "Organization").map(toSponsor),
        people: nodes.filter((node: { __typename: string }) => node.__typename === "User").map(toSponsor),
        total: sponsors.totalCount,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      if (process.env.CI) {
        throw new Error(
          `[sponsors] could not read sponsors from GitHub (${reason}). A deploy must not drop the sponsors, so ` +
            `give the build a token that can read them, such as a PAT with the read:user scope.`,
        )
      }

      console.warn(`[sponsors] building without the sponsors section (${reason})`)

      return { companies: [], people: [], total: 0 }
    }
  },
})
