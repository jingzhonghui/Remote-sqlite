import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist-electron')

// 需要复制的依赖
const deps = [
  'ssh2',
  'cpu-features',
  'nan',
  'buildcheck',
  'asn1',
  'bcrypt-pbkdf',
  'safer-buffer',
  'tweetnacl'
]

async function copyDeps() {
  for (const dep of deps) {
    const src = path.join(rootDir, 'node_modules', dep)
    const dest = path.join(distDir, 'node_modules', dep)
    
    if (fs.existsSync(src)) {
      await fs.ensureDir(path.dirname(dest))
      await fs.copy(src, dest, { overwrite: true })
      console.log(`Copied ${dep}`)
    } else {
      console.warn(`Warning: ${dep} not found`)
    }
  }
}

copyDeps().catch(console.error)
