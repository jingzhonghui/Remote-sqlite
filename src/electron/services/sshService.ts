import { EventEmitter } from 'events'
import type { Client as SSHClient } from 'ssh2'

// 动态导入 ssh2，避免 Vite 打包时处理原生模块
let Client: typeof SSHClient
async function getSSHClient(): Promise<typeof SSHClient> {
  if (!Client) {
    const ssh2 = await import('ssh2')
    Client = ssh2.Client
  }
  return Client
}

export interface SSHConfig {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey' | 'agent'
  password?: string
  privateKey?: string
  passphrase?: string
  useAgent?: boolean
  jumpHost?: SSHConfig
}

interface Connection {
  id: string
  config: SSHConfig
  client: SSHClient
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  connectedAt?: Date
  errorMessage?: string
}

export class SSHService extends EventEmitter {
  private connections: Map<string, Connection> = new Map()

  async testConnection(config: SSHConfig): Promise<{ success: boolean; message: string }> {
    const SSHClient = await getSSHClient()
    return new Promise((resolve) => {
      const client = new SSHClient()
      const timeout = setTimeout(() => {
        client.end()
        resolve({ success: false, message: '连接超时' })
      }, 10000)

      client.on('ready', () => {
        clearTimeout(timeout)
        client.end()
        resolve({ success: true, message: '连接成功' })
      })

      client.on('error', (err) => {
        clearTimeout(timeout)
        resolve({ success: false, message: `连接失败: ${err.message}` })
      })

      this.connectClient(client, config)
    })
  }

  async connect(config: SSHConfig): Promise<{ success: boolean; connectionId: string; message: string }> {
    const SSHClient = await getSSHClient()
    const connectionId = config.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 如果已存在连接，先断开
    if (this.connections.has(connectionId)) {
      await this.disconnect(connectionId)
    }

    const client = new SSHClient()
    const connection: Connection = {
      id: connectionId,
      config,
      client,
      status: 'connecting',
    }

    this.connections.set(connectionId, connection)

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        connection.status = 'error'
        connection.errorMessage = '连接超时'
        client.end()
        resolve({ success: false, connectionId, message: '连接超时' })
      }, 30000)

      client.on('ready', () => {
        clearTimeout(timeout)
        connection.status = 'connected'
        connection.connectedAt = new Date()
        this.emit('connected', connectionId)
        resolve({ success: true, connectionId, message: '连接成功' })
      })

      client.on('error', (err) => {
        clearTimeout(timeout)
        connection.status = 'error'
        connection.errorMessage = err.message
        this.emit('error', connectionId, err)
        resolve({ success: false, connectionId, message: `连接失败: ${err.message}` })
      })

      client.on('close', () => {
        connection.status = 'disconnected'
        this.emit('disconnected', connectionId)
      })

      this.connectClient(client, config)
    })
  }

  async disconnect(connectionId: string): Promise<{ success: boolean }> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return { success: false }
    }

    connection.client.end()
    this.connections.delete(connectionId)
    return { success: true }
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(id => this.disconnect(id))
    await Promise.all(promises)
  }

  listConnections(): Array<{ id: string; name: string; host: string; status: string }> {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      name: conn.config.name,
      host: `${conn.config.host}:${conn.config.port}`,
      status: conn.status,
    }))
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId)
  }

  private connectClient(client: SSHClient, config: SSHConfig): void {
    const connectConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 20000,
    }

    if (config.authType === 'password' && config.password) {
      connectConfig.password = config.password
    } else if (config.authType === 'privateKey' && config.privateKey) {
      connectConfig.privateKey = config.privateKey
      if (config.passphrase) {
        connectConfig.passphrase = config.passphrase
      }
    } else if (config.authType === 'agent' || config.useAgent) {
      connectConfig.agent = process.platform === 'win32' 
        ? 'pageant'
        : process.env.SSH_AUTH_SOCK
    }

    client.connect(connectConfig)
  }

  // 执行远程命令
  async execCommand(connectionId: string, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    const connection = this.connections.get(connectionId)
    if (!connection || connection.status !== 'connected') {
      throw new Error('连接未建立')
    }

    return new Promise((resolve, reject) => {
      connection.client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('close', (code: number) => {
          resolve({ stdout, stderr, code })
        })

        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
      })
    })
  }

  // 列出远程目录内容
  async listDirectory(connectionId: string, dirPath: string): Promise<{
    success: boolean
    path: string
    parent: string | null
    items: Array<{
      name: string
      type: 'file' | 'directory' | 'link'
      size: number
      modified: string
      isDbFile: boolean
    }>
    message?: string
  }> {
    const connection = this.connections.get(connectionId)
    if (!connection || connection.status !== 'connected') {
      return { success: false, path: dirPath, parent: null, items: [], message: '连接未建立' }
    }

    try {
      // 规范化路径
      let normalizedPath = dirPath.trim() || '~'
      
      // 对于 ~ 开头的路径，不加引号让 shell 展开；其他路径加引号处理空格
      // 使用 cd 进入目录再 ls，这样可以正确处理路径
      const cdPath = normalizedPath.startsWith('~') ? normalizedPath : `"${normalizedPath}"`
      const command = `cd ${cdPath} 2>/dev/null && ls -la 2>/dev/null || echo "ERROR: Permission denied or directory not found"`
      
      const { stdout, code } = await this.execCommand(connectionId, command)
      
      if (stdout.includes('ERROR:') || code !== 0) {
        return { success: false, path: dirPath, parent: null, items: [], message: '无法访问该目录' }
      }

      // 获取实际路径（将 ~ 展开为实际路径）
      const pwdCommand = `cd ${cdPath} 2>/dev/null && pwd`
      const { stdout: pwdStdout } = await this.execCommand(connectionId, pwdCommand)
      const actualPath = pwdStdout.trim() || normalizedPath
      normalizedPath = actualPath

      // 获取父目录
      const parentCommand = `dirname "${normalizedPath}"`
      const { stdout: parentStdout } = await this.execCommand(connectionId, parentCommand)
      const parent = parentStdout.trim() === normalizedPath ? null : parentStdout.trim()

      // 解析 ls 输出
      const lines = stdout.split('\n').filter(line => line.trim())
      const items: Array<{
        name: string
        type: 'file' | 'directory' | 'link'
        size: number
        modified: string
        isDbFile: boolean
      }> = []

      for (const line of lines) {
        // 跳过总计行和 . 目录
        if (line.startsWith('total') || line.endsWith(' .')) continue

        const match = line.match(/^([\-dlcbsp])([rwx\-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\S+\s+\S+)\s+(.+)$/)
        if (!match) continue

        const [, typeChar, , sizeStr, dateStr, name] = match
        const nameWithoutDot = name.replace(/ \.$/, '').replace(/ \.\.$/, '')
        
        // 跳过 . 和 .. 
        if (nameWithoutDot === '.' || nameWithoutDot === '..') continue

        const type: 'file' | 'directory' | 'link' = 
          typeChar === 'd' ? 'directory' : 
          typeChar === 'l' ? 'link' : 'file'
        
        const isDbFile = type === 'file' && (nameWithoutDot.endsWith('.db') || nameWithoutDot.endsWith('.sqlite') || nameWithoutDot.endsWith('.sqlite3'))

        items.push({
          name: nameWithoutDot,
          type,
          size: parseInt(sizeStr, 10),
          modified: dateStr,
          isDbFile
        })
      }

      // 排序：目录在前，文件在后，按名称排序
      items.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })

      return { success: true, path: normalizedPath, parent, items }
    } catch (error) {
      return { 
        success: false, 
        path: dirPath, 
        parent: null, 
        items: [], 
        message: error instanceof Error ? error.message : '列出目录失败' 
      }
    }
  }
}
