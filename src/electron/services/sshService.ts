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
}
