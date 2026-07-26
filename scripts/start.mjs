// 智能启动脚本：非必要不重新构建
// - 已有构建产物 (out/main/index.js) 时直接启动 Electron，跳过构建
// - 没有产物时自动构建一次再启动
// - 传入 --rebuild / -r 强制重新构建后启动
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const mainEntry = join(root, 'out', 'main', 'index.js')

const argv = process.argv.slice(2)
const forceRebuild = argv.includes('--rebuild') || argv.includes('-r')

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const hasBuild = existsSync(mainEntry)

if (forceRebuild) {
  console.log('[start] 收到 --rebuild，强制重新构建…')
  run('npx', ['electron-vite', 'build'])
} else if (!hasBuild) {
  console.log('[start] 未检测到构建产物 (out/main/index.js)，先执行构建…')
  run('npx', ['electron-vite', 'build'])
} else {
  console.log('[start] 检测到已有构建产物，跳过构建直接启动。')
  console.log('[start] 如需重建：npm start -- --rebuild  或  npm run build')
}

run('npx', ['electron', '.'])
