import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function run(command) {
  console.log(`\n> ${command}`)
  execSync(command, { stdio: 'inherit' })
}

if (process.platform !== 'darwin') {
  console.error('The iPad project must be generated on macOS because Xcode is required.')
  process.exit(1)
}

run('npm install @capacitor/core @capacitor/ios')
run('npm install -D @capacitor/cli')
run('npm run build')

if (!existsSync('ios')) run('npx cap add ios')
run('npx cap sync ios')

console.log('\nPlayFooty Club iPad project is ready.')
console.log('Open it with: npx cap open ios')
