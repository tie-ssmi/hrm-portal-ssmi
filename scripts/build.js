const { writeFileSync, unlinkSync, existsSync } = require('fs')
const { execSync } = require('child_process')

// Usage: node scripts/build.js prod | staging
const target = process.argv[2]
const deployTarget = target === 'prod' ? 'production' : 'staging'

writeFileSync('.env.local', `NEXT_PUBLIC_DEPLOY_TARGET=${deployTarget}\n`)

try {
  execSync('next build', { stdio: 'inherit' })
} finally {
  if (existsSync('.env.local')) unlinkSync('.env.local')
}
