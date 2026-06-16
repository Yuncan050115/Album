#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const targets = ['.next', 'out', 'dist', 'coverage', 'tsconfig.tsbuildinfo']
for (const target of targets) {
  const full = path.resolve(process.cwd(), target)
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true })
    console.log(`removed ${target}`)
  }
}
