#!/usr/bin/env node

// @ts-ignore - This import will work at runtime after @herb-tools/language-server is built
import { CLI } from "@herb-tools/language-server"

const cli = new CLI()
cli.run()
