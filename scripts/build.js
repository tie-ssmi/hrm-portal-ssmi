const { writeFileSync, readFileSync, unlinkSync, existsSync } = require('fs')
const { execSync } = require('child_process')

const target = process.argv[2]
const deployTarget = target === 'prod' ? 'production' : 'staging'

if (target === 'staging' && existsSync('.env.development')) {
  const devEnv = readFileSync('.env.development', 'utf8')
  writeFileSync('.env.local', `NEXT_PUBLIC_DEPLOY_TARGET=${deployTarget}\n${devEnv}`)
} else {
  writeFileSync('.env.local', `NEXT_PUBLIC_DEPLOY_TARGET=${deployTarget}\n`)
}

try {
  execSync('next build', { stdio: 'inherit' })
} finally {
  if (existsSync('.env.local')) unlinkSync('.env.local')
}
