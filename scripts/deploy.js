// Deploy dist/ to gh-pages branch
// Bypasses gh-pages lib to avoid ENAMETOOLONG on Windows with many files
import { execSync } from 'child_process'
import { mkdtempSync, cpSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const DIST = 'dist'
const BRANCH = 'gh-pages'

// Get remote URL from current repo
const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
console.log(`Remote: ${remoteUrl}`)

// Create temp dir and copy dist into it
const tmp = mkdtempSync(join(tmpdir(), 'gh-pages-'))
console.log(`Copying ${DIST}/ to ${tmp}...`)
cpSync(DIST, tmp, { recursive: true })

// Init a fresh repo, commit everything, force-push to gh-pages
const run = (cmd) => execSync(cmd, { cwd: tmp, stdio: 'inherit' })

run('git init')
run(`git checkout -b ${BRANCH}`)
run('git add -A')
run(`git commit -m "Deploy ${new Date().toISOString()}"`)
run(`git push --force "${remoteUrl}" ${BRANCH}`)

// Cleanup
rmSync(tmp, { recursive: true, force: true })
console.log('Deployed to gh-pages successfully!')
