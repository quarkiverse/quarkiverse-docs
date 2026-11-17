#!/usr/bin/env node
// Shrinks a built preview site: every file above the size threshold that is byte-for-byte the same size as
// the published copy on production is deleted, and the pages that reference it point at production instead.
// Files that are new or changed in the preview (so differ from production) are kept.
'use strict'

const fs = require('fs')
const path = require('path')

const [siteDir, maxMb = '1', prodUrl = 'https://docs.quarkiverse.io'] = process.argv.slice(2)
if (!siteDir) {
  console.error('usage: offload-large-files.js <site dir> [max size in MB, default 1] [production url]')
  process.exit(1)
}
const root = path.resolve(siteDir)
const maxBytes = Number(maxMb) * 1024 * 1024

function walk (dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    entry.isDirectory() ? walk(p, out) : out.push(p)
  }
  return out
}

const toUrlPath = (file) => path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/')

async function productionSize (file) {
  try {
    const res = await fetch(`${prodUrl}/${toUrlPath(file)}`, { method: 'HEAD', redirect: 'follow' })
    const length = res.headers.get('content-length')
    return res.ok && length ? Number(length) : -1
  } catch {
    return -1
  }
}

async function main () {
  const files = walk(root)
  const large = files.filter((f) => !f.endsWith('.html') && fs.statSync(f).size > maxBytes)

  const offloaded = new Map() // absolute path -> production url
  await Promise.all(large.map(async (file) => {
    const size = fs.statSync(file).size
    if (await productionSize(file) === size) {
      offloaded.set(file, `${prodUrl}/${toUrlPath(file)}`)
    } else {
      console.log(`kept (not on production, or changed): ${path.relative(root, file)}`)
    }
  }))
  if (!offloaded.size) return console.log('nothing to offload')

  // Rewrite references in pages. Attribute values are relative to the page, so resolve them before matching.
  let rewritten = 0
  for (const page of files.filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(page, 'utf8')
    const updated = html.replace(/\b(src|href|data|poster)="([^"#?:]+)([^"]*)"/g, (match, attr, ref, suffix) => {
      const target = offloaded.get(path.resolve(path.dirname(page), decodeURI(ref)))
      return target ? `${attr}="${target}${suffix}"` : match
    })
    if (updated !== html) {
      fs.writeFileSync(page, updated)
      rewritten++
    }
  }

  let saved = 0
  for (const file of offloaded.keys()) {
    saved += fs.statSync(file).size
    fs.rmSync(file)
    console.log(`offloaded: ${path.relative(root, file)}`)
  }
  console.log(`offloaded ${offloaded.size} files (${(saved / 1048576).toFixed(0)} MB), rewrote ${rewritten} pages`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
