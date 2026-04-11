import { SSHService } from './sshService'

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

export interface IndexInfo {
  name: string
  unique: number
  origin: string
  partial: number
  columns: string[]
}

export class SQLiteService {
  private sshService: SSHService

  constructor(sshService: SSHService) {
    this.sshService = sshService
  }

  async execute(connectionId: string, dbPath: string, sql: string): Promise<{ 
    success: boolean
    affectedRows?: number
    message?: string 
  }> {
    try {
      // 使用 here-doc 传递 SQL，避免所有 shell 转义问题
      const command = `sqlite3 '${dbPath.replace(/'/g, "'\\''")}' <<'EOSQL'\n${sql}\nEOSQL`
      
      const result = await this.sshService.execCommand(connectionId, command)
      
      if (result.code !== 0) {
        return { 
          success: false, 
          message: result.stderr || '执行失败' 
        }
      }

      // 解析影响行数（对于 INSERT/UPDATE/DELETE）
      const affectedMatch = result.stdout.match(/changes: (\d+)/)
      const affectedRows = affectedMatch ? parseInt(affectedMatch[1]) : undefined

      return { 
        success: true, 
        affectedRows,
        message: result.stdout 
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  async query(connectionId: string, dbPath: string, sql: string): Promise<{
    success: boolean
    columns: string[]
    rows: any[]
    message?: string
  }> {
    try {
      // 使用 here-doc 方式传递 SQL，避免 shell 引号转义问题
      // 这样可以正确处理 SQL 中包含的单引号、双引号等特殊字符
      const escapedPath = dbPath.replace(/'/g, "'\\''")
      const command = `sqlite3 -batch -json '${escapedPath}' <<'EOSQL'\n${sql}\nEOSQL`
      
      const result = await this.sshService.execCommand(connectionId, command)
      
      if (result.code !== 0) {
        return { 
          success: false, 
          columns: [],
          rows: [],
          message: result.stderr || '查询失败' 
        }
      }

      // 解析 JSON 结果
      let rows: any[] = []
      if (result.stdout.trim()) {
        try {
          rows = JSON.parse(result.stdout)
          // 如果是单个对象，转换为数组
          if (!Array.isArray(rows)) {
            rows = [rows]
          }
        } catch {
          // 如果解析失败，返回空结果
          return { 
            success: false, 
            columns: [],
            rows: [],
            message: '解析查询结果失败' 
          }
        }
      }

      // 从第一行数据获取列名
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []

      return { 
        success: true, 
        columns,
        rows 
      }
    } catch (error) {
      return { 
        success: false, 
        columns: [],
        rows: [],
        message: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  private parseColumnLine(line: string): string[] {
    // column 模式使用至少两个空格作为分隔符
    // 注意：此方法保留用于其他可能的用途，不再用于主要查询解析
    const parts: string[] = []
    let current = ''
    let spaceCount = 0
    
    for (const char of line) {
      if (char === ' ') {
        spaceCount++
        if (spaceCount >= 2) {
          if (current.trim()) {
            parts.push(current.trim())
            current = ''
          }
          spaceCount = 0
        }
      } else {
        if (spaceCount > 0 && spaceCount < 2) {
          current += ' '.repeat(spaceCount)
        }
        spaceCount = 0
        current += char
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim())
    }
    
    return parts
  }

  async getTables(connectionId: string, dbPath: string): Promise<{
    success: boolean
    tables: string[]
    message?: string
  }> {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    const result = await this.query(connectionId, dbPath, sql)
    
    if (!result.success) {
      return { success: false, tables: [], message: result.message }
    }

    const tables = result.rows.map(row => row.name)
    return { success: true, tables }
  }

  async getTableInfo(connectionId: string, dbPath: string, tableName: string): Promise<{
    success: boolean
    columns: ColumnInfo[]
    message?: string
  }> {
    const sql = `PRAGMA table_info(${this.escapeIdentifier(tableName)})`
    const result = await this.query(connectionId, dbPath, sql)
    
    if (!result.success) {
      return { success: false, columns: [], message: result.message }
    }

    const columns: ColumnInfo[] = result.rows.map(row => ({
      cid: row.cid,
      name: row.name,
      type: row.type,
      notnull: row.notnull,
      dflt_value: row.dflt_value,
      pk: row.pk,
    }))

    return { success: true, columns }
  }

  async getIndexes(connectionId: string, dbPath: string, tableName: string): Promise<{
    success: boolean
    indexes: IndexInfo[]
    message?: string
  }> {
    const sql = `PRAGMA index_list(${this.escapeIdentifier(tableName)})`
    const result = await this.query(connectionId, dbPath, sql)
    
    if (!result.success) {
      return { success: false, indexes: [], message: result.message }
    }

    const indexes: IndexInfo[] = []
    
    for (const row of result.rows) {
      const indexSql = `PRAGMA index_info(${this.escapeIdentifier(row.name)})`
      const indexResult = await this.query(connectionId, dbPath, indexSql)
      
      const columns = indexResult.success 
        ? indexResult.rows.map(r => r.name).filter(Boolean)
        : []

      indexes.push({
        name: row.name,
        unique: row.unique,
        origin: row.origin,
        partial: row.partial,
        columns,
      })
    }

    return { success: true, indexes }
  }

  async getTableDDL(connectionId: string, dbPath: string, tableName: string): Promise<string> {
    const sql = `SELECT sql FROM sqlite_master WHERE type='table' AND name=${this.escapeString(tableName)}`
    const result = await this.query(connectionId, dbPath, sql)
    
    if (result.success && result.rows.length > 0) {
      return result.rows[0].sql || ''
    }
    return ''
  }

  private escapeIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }

  private escapeString(str: string): string {
    return `'${str.replace(/'/g, "''")}'`
  }
}
