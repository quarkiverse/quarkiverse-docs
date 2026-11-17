#!/usr/bin/env node
// Generates a smaller Antora playbook for PR previews.
// Keeps only the latest version of each source, except sources added or edited in the PR (compared with
// --base), and optionally swaps one source for a local checkout. See preview/README.md.
'use strict'

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

function usage (msg) {
  if (msg) console.error(`error: ${msg}`)
  console.error(`usage: trim-playbook.js --playbook <file> --output <file>
    [--base <file>]            unchanged-vs-base sources are trimmed, changed ones kept whole
    [--component <url>=<dir>]  build this source from a local checkout instead (sub-project previews)`)
  process.exit(1)
}

const args = process.argv.slice(2)
const opts = {}
while (args.length) {
  const flag = args.shift()
  const value = args.shift()
  if (!flag.startsWith('--') || value === undefined) usage(`bad argument ${flag}`)
  opts[flag.slice(2)] = value
}
if (!opts.playbook || !opts.output) usage('--playbook and --output are required')

const normalise = (url) => String(url).toLowerCase().replace(/\.git$/, '').replace(/\/$/, '')
const load = (file) => yaml.load(fs.readFileSync(file, 'utf8'))

const playbook = load(opts.playbook)
const sources = playbook.content.sources

// Sources whose entry differs from the base playbook (added or edited in this PR) are left alone,
// so a PR that adds a version branch still previews it.
const baseEntries = new Map()
if (opts.base) {
  for (const s of load(opts.base).content.sources) baseEntries.set(normalise(s.url), JSON.stringify(s))
}
const isChanged = (s) => opts.base && baseEntries.get(normalise(s.url)) !== JSON.stringify(s)

let component
if (opts.component) {
  const i = opts.component.indexOf('=')
  if (i < 0) usage('--component must be <url>=<dir>')
  component = { url: normalise(opts.component.slice(0, i)), dir: path.resolve(opts.component.slice(i + 1)) }
}

let componentFound = false
for (const source of sources) {
  if (component && normalise(source.url) === component.url) {
    // Use the local worktree (the PR's checked-out content), keeping start_path etc.
    source.url = component.dir
    source.branches = 'HEAD'
    source.worktrees = true
    delete source.tags
    componentFound = true
    console.log(`component: ${component.url} -> ${component.dir}`)
    continue
  }
  if (isChanged(source)) {
    console.log(`changed, kept whole: ${source.url}`)
    continue
  }
  // Only the latest version: the first branch listed (HEAD, or e.g. main), no tags.
  const branches = [].concat(source.branches ?? 'HEAD')
  source.branches = branches[0]
  delete source.tags
}

if (component && !componentFound) {
  // Not in the playbook yet (e.g. a new extension): add it.
  sources.push({ url: component.dir, branches: 'HEAD', worktrees: true, start_path: 'docs' })
  console.log(`component: ${component.url} not in playbook, added from ${component.dir}`)
}

fs.writeFileSync(opts.output, yaml.dump(playbook, { lineWidth: -1 }))
console.log(`wrote ${opts.output}`)
