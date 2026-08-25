import { version } from "../package.json"

declare const __HERB_BUILD_METADATA__: string | null | undefined

export const buildMetadata = typeof __HERB_BUILD_METADATA__ === "string" && __HERB_BUILD_METADATA__ !== "" ? __HERB_BUILD_METADATA__ : null

export const serverVersion = buildMetadata ? `${version} (${buildMetadata})` : version
