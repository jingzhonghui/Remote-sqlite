/**
 * SQL 安全级别判断与影响预估
 * 
 * 提供 SQL 语句的安全分类和影响预估功能
 */

import type { SafetyLevel, ImpactEstimate, QueryResult } from '../../../src/types/ai'
import type { SQLiteService } from '../../services/sqliteService'

/**
 * 判断 SQL 语句的安全级别
 */
export function classifySQLSafety(sql: string): SafetyLevel {
  const normalized = sql.trim().toUpperCase()
  
  // SAFE: 只读操作
  if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\s/i.test(normalized)) {
    return 'safe'
  }
  
  // DANGEROUS: 结构性修改
  if (/^(DROP|ALTER|TRUNCATE|CREATE|REINDEX)\s/i.test(normalized)) {
    return 'dangerous'
  }
  
  // DANGEROUS: DELETE 无 WHERE 或 WHERE 恒真
  if (/^DELETE\s+FROM\s+\w+\s*;?\s*$/i.test(normalized)) {
    return 'dangerous'
  }
  // DELETE 带 WHERE，但 WHERE 1=1 或 WHERE TRUE
  if (/^DELETE\s+FROM\s+\w+\s+WHERE\s+(1\s*=\s*1|TRUE|1)\s*;?\s*$/i.test(normalized)) {
    return 'dangerous'
  }
  
  // DANGEROUS: UPDATE 无 WHERE 或 WHERE 恒真
  if (/^UPDATE\s+\w+\s+SET\s+/i.test(normalized) && !/WHERE\s+/i.test(normalized)) {
    return 'dangerous'
  }
  if (/^UPDATE\s+\w+\s+SET\s+.+WHERE\s+(1\s*=\s*1|TRUE|1)\s*;?\s*$/i.test(normalized)) {
    return 'dangerous'
  }
  
  // WARNING: 数据修改操作（带明确条件的 DELETE/UPDATE）
  if (/^(INSERT|UPDATE|DELETE)/i.test(normalized)) {
    return 'warning'
  }
  
  return 'warning'
}

/**
 * 检测 SQL 是否为批量操作
 */
export function isBulkOperation(sql: string): boolean {
  const normalized = sql.trim().toUpperCase()
  
  // 检测 INSERT INTO ... SELECT
  if (/INSERT\s+INTO\s+\w+\s+SELECT/i.test(normalized)) {
    return true
  }
  
  // 检测 UPDATE ... FROM
  if (/UPDATE\s+\w+\s+SET\s+.+FROM\s+/i.test(normalized)) {
    return true
  }
  
  // 检测 DELETE ... FROM ... JOIN
  if (/DELETE\s+(FROM\s+)?\w+\s+.*JOIN\s+/i.test(normalized)) {
    return true
  }
  
  return false
}

/**
 * 从 SQL 中提取表名
 */
export function extractTableNames(sql: string): string[] {
  const normalized = sql.trim().toUpperCase()
  const tables: string[] = []
  
  // SELECT ... FROM table
  const fromMatch = normalized.match(/FROM\s+(\w+)/gi)
  if (fromMatch) {
    fromMatch.forEach(match => {
      const table = match.replace(/FROM\s+/i, '').trim()
      if (table && !tables.includes(table)) {
        tables.push(table)
      }
    })
  }
  
  // INSERT INTO table
  const insertMatch = normalized.match(/INSERT\s+INTO\s+(\w+)/i)
  if (insertMatch) {
    const table = insertMatch[1]
    if (!tables.includes(table)) {
      tables.push(table)
    }
  }
  
  // UPDATE table
  const updateMatch = normalized.match(/UPDATE\s+(\w+)/i)
  if (updateMatch) {
    const table = updateMatch[1]
    if (!tables.includes(table)) {
      tables.push(table)
    }
  }
  
  // DELETE FROM table
  const deleteMatch = normalized.match(/DELETE\s+FROM\s+(\w+)/i)
  if (deleteMatch) {
    const table = deleteMatch[1]
    if (!tables.includes(table)) {
      tables.push(table)
    }
  }
  
  return tables
}

/**
 * 预估 SQL 操作影响
 */
export async function estimateImpact(
  sql: string,
  connectionId: string,
  dbPath: string,
  sqliteService: SQLiteService,
  warningThreshold: number = 1000
): Promise<ImpactEstimate> {
  const safety = classifySQLSafety(sql)
  
  if (safety === 'safe') {
    return { level: 'safe', canAutoExecute: true }
  }
  
  // 对于 DELETE/UPDATE，执行 COUNT 预估
  if (/^(DELETE|UPDATE)/i.test(sql)) {
    try {
      // 构建 COUNT 查询
      let countSql: string
      
      if (/^DELETE/i.test(sql)) {
        // DELETE FROM table WHERE condition -> SELECT COUNT(*) FROM table WHERE condition
        countSql = sql.replace(/^DELETE/i, 'SELECT COUNT(*) as count')
      } else {
        // UPDATE table SET ... WHERE condition -> SELECT COUNT(*) FROM table WHERE condition
        // 需要移除 SET 部分
        countSql = sql.replace(/^UPDATE\s+(\w+)\s+SET\s+.+WHERE/i, 'SELECT COUNT(*) as count FROM $1 WHERE')
        // 如果没有 WHERE，使用 LIMIT 1 来避免全表更新预估（但实际上应该被判定为 dangerous）
        if (!/WHERE/i.test(countSql)) {
          return { level: 'dangerous', canAutoExecute: false }
        }
      }
      
      const result = await sqliteService.query(connectionId, dbPath, countSql)
      const affectedRows = result.rows[0]?.count || 0
      
      // 如果影响行数超过阈值，升级为 dangerous
      if (affectedRows > warningThreshold) {
        return {
          level: 'dangerous',
          affectedRows,
          canAutoExecute: false
        }
      }
      
      return {
        level: 'warning',
        affectedRows,
        canAutoExecute: true
      }
    } catch (error) {
      console.error('预估影响失败:', error)
      // 预估失败时，保守起见要求确认
      return {
        level: 'warning',
        canAutoExecute: false
      }
    }
  }
  
  // INSERT 默认 warning，除非检测为批量操作
  if (/^INSERT/i.test(sql)) {
    if (isBulkOperation(sql)) {
      return {
        level: 'dangerous',
        canAutoExecute: false
      }
    }
    return {
      level: 'warning',
      canAutoExecute: true
    }
  }
  
  // 其他情况（DROP, ALTER 等）
  return {
    level: 'dangerous',
    canAutoExecute: false
  }
}

/**
 * 生成 SQL 预览（用于危险操作确认）
 * 获取将要被修改的数据的前几行
 */
export async function generatePreview(
  sql: string,
  connectionId: string,
  dbPath: string,
  sqliteService: SQLiteService,
  limit: number = 5
): Promise<QueryResult | null> {
  try {
    let previewSql: string
    
    if (/^DELETE/i.test(sql)) {
      // DELETE FROM table WHERE condition -> SELECT * FROM table WHERE condition LIMIT 5
      previewSql = sql.replace(/^DELETE/i, 'SELECT *')
      previewSql = previewSql.replace(/;?\s*$/, ` LIMIT ${limit}`)
    } else if (/^UPDATE/i.test(sql)) {
      // UPDATE table SET ... WHERE condition -> SELECT * FROM table WHERE condition LIMIT 5
      // 提取表名和 WHERE 条件
      const tableMatch = sql.match(/UPDATE\s+(\w+)/i)
      const whereMatch = sql.match(/WHERE\s+(.+)$/i)
      
      if (tableMatch && whereMatch) {
        previewSql = `SELECT * FROM ${tableMatch[1]} WHERE ${whereMatch[1]} LIMIT ${limit}`
      } else {
        return null
      }
    } else {
      return null
    }
    
    return await sqliteService.query(connectionId, dbPath, previewSql)
  } catch (error) {
    console.error('生成预览失败:', error)
    return null
  }
}

/**
 * 获取安全级别的中文描述
 */
export function getSafetyLabel(level: SafetyLevel): string {
  const labels: Record<SafetyLevel, string> = {
    safe: '安全',
    warning: '警告',
    dangerous: '危险'
  }
  return labels[level]
}

/**
 * 获取安全级别的颜色
 */
export function getSafetyColor(level: SafetyLevel): string {
  const colors: Record<SafetyLevel, string> = {
    safe: '#10b981',
    warning: '#f59e0b',
    dangerous: '#ef4444'
  }
  return colors[level]
}
