/**
 * AI Tools 定义
 * 
 * 为 LangChain Agent 提供数据库操作能力
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import type { SQLiteService } from '../../services/sqliteService'
import type { SSHService } from '../../services/sshService'
import { 
  classifySQLSafety, 
  estimateImpact, 
  generatePreview,
  extractTableNames 
} from '../utils/sql-safety'
import type { 
  DatabaseContext, 
  DatabaseSchema, 
  TableInfo, 
  AnalysisType,
  SafetyLevel 
} from '../../../src/types/ai'

/**
 * 创建 Tool 上下文
 */
export interface ToolContext {
  sqliteService: SQLiteService
  sshService: SSHService
  dbContext: DatabaseContext
  getConfig: () => { warningThreshold: number }
}

// ==================== Tool 1: get_database_schema ====================

export const createGetDatabaseSchemaTool = (context: ToolContext) => tool({
  name: 'get_database_schema',
  description: `获取当前数据库的完整结构信息，包括所有表、列、索引。
用途：
1. 了解数据库有哪些表
2. 查看表的结构（列名、类型、约束）
3. 查看索引信息

当需要查询数据但不确定表结构时，优先调用此工具。`,
  parameters: z.object({
    includeSampleData: z.boolean().optional()
      .describe('是否包含样本数据（前3行），默认 false')
  }),
  execute: async ({ includeSampleData }) => {
    const { sqliteService, dbContext } = context
    
    try {
      // 获取所有表
      const tablesResult = await sqliteService.getTables(
        dbContext.connectionId, 
        dbContext.dbPath
      )
      
      if (!tablesResult.success) {
        return { error: tablesResult.message || '获取表列表失败' }
      }
      
      // 获取每个表的详细信息
      const tables: TableInfo[] = []
      for (const tableName of tablesResult.tables) {
        const tableInfo = await sqliteService.getTableInfo(
          dbContext.connectionId,
          dbContext.dbPath,
          tableName
        )
        
        if (tableInfo.success) {
          const table: TableInfo = {
            name: tableName,
            columns: tableInfo.columns,
            indexes: []
          }
          
          // 获取索引信息
          const indexesResult = await sqliteService.getIndexes(
            dbContext.connectionId,
            dbContext.dbPath,
            tableName
          )
          
          if (indexesResult.success) {
            table.indexes = indexesResult.indexes
          }
          
          // 可选：获取样本数据
          if (includeSampleData) {
            const sampleResult = await sqliteService.query(
              dbContext.connectionId,
              dbContext.dbPath,
              `SELECT * FROM "${tableName}" LIMIT 3`
            )
            ;(table as any).sampleData = sampleResult.success ? sampleResult.rows : []
          }
          
          tables.push(table)
        }
      }
      
      const schema: DatabaseSchema = {
        tables,
        views: [], // SQLite 视图暂不支持
        indexes: [], // 已经在表信息中
        fetchedAt: Date.now()
      }
      
      // 更新上下文缓存
      dbContext.schemaCache = schema
      
      return {
        success: true,
        schema: {
          tables: tables.map(t => ({
            name: t.name,
            columns: t.columns.map(c => ({
              name: c.name,
              type: c.type,
              notNull: c.notnull === 1,
              defaultValue: c.dflt_value,
              isPrimaryKey: c.pk === 1
            })),
            indexes: t.indexes,
            sampleData: (t as any).sampleData
          })),
          tableCount: tables.length
        }
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '获取数据库结构失败'
      }
    }
  }
})

// ==================== Tool 2: get_table_info ====================

export const createGetTableInfoTool = (context: ToolContext) => tool({
  name: 'get_table_info',
  description: `获取指定表的详细信息，包括列定义、索引、外键、统计信息。
用途：
1. 查看特定表的结构
2. 获取表的行数统计
3. 查看表的索引情况`,
  parameters: z.object({
    tableName: z.string().describe('表名'),
    includeStatistics: z.boolean().optional()
      .describe('是否包含统计信息（行数、大小），默认 false')
  }),
  execute: async ({ tableName, includeStatistics }) => {
    const { sqliteService, dbContext } = context
    
    try {
      // 获取表结构
      const tableInfo = await sqliteService.getTableInfo(
        dbContext.connectionId,
        dbContext.dbPath,
        tableName
      )
      
      if (!tableInfo.success) {
        return { error: `获取表 "${tableName}" 信息失败: ${tableInfo.message}` }
      }
      
      // 获取索引
      const indexesResult = await sqliteService.getIndexes(
        dbContext.connectionId,
        dbContext.dbPath,
        tableName
      )
      
      const result: any = {
        name: tableName,
        columns: tableInfo.columns.map(c => ({
          name: c.name,
          type: c.type,
          notNull: c.notnull === 1,
          defaultValue: c.dflt_value,
          isPrimaryKey: c.pk === 1
        })),
        indexes: indexesResult.success ? indexesResult.indexes : []
      }
      
      // 获取统计信息
      if (includeStatistics) {
        const countResult = await sqliteService.query(
          dbContext.connectionId,
          dbContext.dbPath,
          `SELECT COUNT(*) as count FROM "${tableName}"`
        )
        
        if (countResult.success) {
          result.rowCount = countResult.rows[0]?.count || 0
        }
      }
      
      return { success: true, table: result }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '获取表信息失败'
      }
    }
  }
})

// ==================== Tool 3: execute_query ====================

export const createExecuteQueryTool = (context: ToolContext) => tool({
  name: 'execute_query',
  description: `执行 SELECT/PRAGMA/EXPLAIN 查询并返回结果。
限制：
- 只读操作，不会修改数据
- 最多返回 1000 行（可通过 limit 参数调整）

用途：
1. 查询数据
2. 执行 PRAGMA 命令获取数据库元数据
3. 使用 EXPLAIN 分析查询计划`,
  parameters: z.object({
    sql: z.string().describe('SQL 查询语句'),
    limit: z.number().optional().default(100)
      .describe('最大返回行数，默认 100，最大 1000')
  }),
  execute: async ({ sql, limit }) => {
    const { sqliteService, dbContext } = context
    
    try {
      // 安全级别检查
      const safety = classifySQLSafety(sql)
      if (safety !== 'safe') {
        return {
          error: `此 SQL 被分类为 ${safety} 级别，不能使用 execute_query 工具。请使用 execute_dml 工具。`
        }
      }
      
      // 限制返回行数
      const maxLimit = Math.min(limit, 1000)
      let finalSql = sql.trim()
      
      // 如果不是 PRAGMA 或 EXPLAIN，添加 LIMIT
      if (!/^\s*(PRAGMA|EXPLAIN)/i.test(finalSql)) {
        // 移除现有的 LIMIT
        finalSql = finalSql.replace(/\s+LIMIT\s+\d+\s*$/i, '')
        finalSql = `${finalSql} LIMIT ${maxLimit}`
      }
      
      const result = await sqliteService.query(
        dbContext.connectionId,
        dbContext.dbPath,
        finalSql
      )
      
      if (!result.success) {
        return { error: result.message || '查询失败' }
      }
      
      return {
        success: true,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rows.length,
        truncated: result.rows.length >= maxLimit
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '查询执行失败'
      }
    }
  }
})

// ==================== Tool 4: execute_dml ====================

export const createExecuteDmlTool = (context: ToolContext) => tool({
  name: 'execute_dml',
  description: `执行 INSERT/UPDATE/DELETE 数据修改操作。
安全机制：
- 对于 UPDATE/DELETE，会预估影响行数
- 如果影响行数超过阈值，会拒绝执行
- 无 WHERE 条件的 UPDATE/DELETE 会被拒绝

用途：
1. 插入新数据
2. 更新现有数据
3. 删除数据`,
  parameters: z.object({
    sql: z.string().describe('DML 语句（INSERT/UPDATE/DELETE）'),
    requireConfirmation: z.boolean().optional()
      .describe('是否要求确认（覆盖默认配置），默认 false')
  }),
  execute: async ({ sql, requireConfirmation }) => {
    const { sqliteService, dbContext, getConfig } = context
    
    try {
      // 安全级别检查
      const safety = classifySQLSafety(sql)
      
      if (safety === 'safe') {
        return {
          error: '此 SQL 是只读查询，请使用 execute_query 工具'
        }
      }
      
      if (safety === 'dangerous') {
        return {
          error: '此 SQL 被判定为危险操作（如 DROP、无 WHERE 的 DELETE/UPDATE），不允许自动执行。请向用户说明风险并请求确认。',
          safety: 'dangerous',
          sql
        }
      }
      
      // 影响预估
      const impact = await estimateImpact(
        sql,
        dbContext.connectionId,
        dbContext.dbPath,
        sqliteService,
        getConfig().warningThreshold
      )
      
      // 如果影响较大或要求确认
      if (requireConfirmation || impact.level === 'dangerous' || !impact.canAutoExecute) {
        // 生成预览
        const preview = await generatePreview(
          sql,
          dbContext.connectionId,
          dbContext.dbPath,
          sqliteService,
          5
        )
        
        return {
          requiresConfirmation: true,
          safety: impact.level,
          affectedRows: impact.affectedRows,
          sql,
          preview: preview ? {
            columns: preview.columns,
            rows: preview.rows
          } : null,
          message: `此操作将影响 ${impact.affectedRows} 行数据，需要用户确认。`
        }
      }
      
      // 执行操作
      const result = await sqliteService.execute(
        dbContext.connectionId,
        dbContext.dbPath,
        sql
      )
      
      if (!result.success) {
        return { error: result.message || '执行失败' }
      }
      
      return {
        success: true,
        affectedRows: result.affectedRows,
        message: `执行成功，影响 ${result.affectedRows || '未知'} 行`
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'DML 执行失败'
      }
    }
  }
})

// ==================== Tool 5: analyze_data ====================

export const createAnalyzeDataTool = (context: ToolContext) => tool({
  name: 'analyze_data',
  description: `对查询结果进行统计分析，生成洞察报告。
支持的分析类型：
- trend: 趋势分析（时间序列数据的增长率、环比）
- distribution: 分布分析（字段值的分布情况、占比）
- correlation: 关联分析（多字段之间的相关性）
- anomaly: 异常检测（识别异常值）

用途：
1. 分析数据趋势
2. 了解数据分布
3. 发现数据异常
4. 字段间关联分析`,
  parameters: z.object({
    query: z.string().describe('要分析的查询 SQL（必须是 SELECT）'),
    analysisType: z.enum(['trend', 'distribution', 'correlation', 'anomaly'])
      .describe('分析类型'),
    dimensions: z.array(z.string()).optional()
      .describe('分析维度字段，用于 distribution/correlation 分析'),
    timeField: z.string().optional()
      .describe('时间字段名，用于 trend 分析'),
    valueField: z.string().optional()
      .describe('数值字段名，用于趋势/分布分析')
  }),
  execute: async ({ query, analysisType, dimensions, timeField, valueField }) => {
    const { sqliteService, dbContext } = context
    
    try {
      // 验证是 SELECT 语句
      if (!/^\s*SELECT/i.test(query)) {
        return { error: '分析查询必须是 SELECT 语句' }
      }
      
      // 执行查询获取数据
      const result = await sqliteService.query(
        dbContext.connectionId,
        dbContext.dbPath,
        query
      )
      
      if (!result.success) {
        return { error: result.message || '数据查询失败' }
      }
      
      if (result.rows.length === 0) {
        return { error: '没有数据可供分析' }
      }
      
      const rows = result.rows
      const columns = result.columns
      
      // 根据分析类型执行不同分析
      let analysis: any = {
        type: analysisType,
        totalRows: rows.length,
        columns: columns
      }
      
      switch (analysisType) {
        case 'trend':
          if (!timeField || !valueField) {
            return { error: '趋势分析需要指定 timeField 和 valueField' }
          }
          analysis = analyzeTrend(rows, timeField, valueField)
          break
          
        case 'distribution':
          if (!dimensions || dimensions.length === 0) {
            // 自动选择第一个非数值列
            const firstColumn = columns[0]
            analysis = analyzeDistribution(rows, firstColumn)
          } else {
            analysis = analyzeDistribution(rows, dimensions[0])
          }
          break
          
        case 'correlation':
          if (!dimensions || dimensions.length < 2) {
            // 尝试分析所有数值列
            analysis = analyzeCorrelation(rows, columns)
          } else {
            analysis = analyzeCorrelation(rows, dimensions)
          }
          break
          
        case 'anomaly':
          if (!valueField) {
            // 自动选择第一个数值列
            const numericColumn = columns.find(col => 
              rows.length > 0 && typeof rows[0][col] === 'number'
            )
            if (!numericColumn) {
              return { error: '未能找到数值列进行异常检测' }
            }
            analysis = analyzeAnomaly(rows, numericColumn)
          } else {
            analysis = analyzeAnomaly(rows, valueField)
          }
          break
      }
      
      return {
        success: true,
        analysis
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '数据分析失败'
      }
    }
  }
})

// ==================== Tool 6: generate_and_execute ====================

export const createGenerateAndExecuteTool = (context: ToolContext) => tool({
  name: 'generate_and_execute',
  description: `根据自然语言需求生成 SQL 并立即执行。
此工具是 AI 助手的核心能力，会自动：
1. 分析需求
2. 生成合适的 SQL
3. 判断安全级别
4. 自动执行安全的查询
5. 对于危险操作返回待确认状态

用途：
1. 用户用自然语言描述数据需求
2. 自动生成并执行查询
3. 展示结果或请求确认`,
  parameters: z.object({
    goal: z.string().describe('数据需求描述'),
    generateOnly: z.boolean().optional()
      .describe('仅生成 SQL 不执行，默认 false'),
    context: z.object({
      tableHint: z.string().optional(),
      timeRange: z.object({ start: z.string(), end: z.string() }).optional()
    }).optional()
  }),
  execute: async ({ goal, generateOnly, context: paramContext }) => {
    const { sqliteService, dbContext, getConfig } = context
    
    // 此工具的实际实现在 Agent 层
    // 这里只返回需要生成的信号
    return {
      requiresGeneration: true,
      goal,
      generateOnly: generateOnly || false,
      context: paramContext
    }
  }
})

// ==================== 分析函数 ====================

/**
 * 趋势分析
 */
function analyzeTrend(rows: any[], timeField: string, valueField: string) {
  // 按时间排序
  const sortedRows = [...rows].sort((a, b) => {
    const timeA = new Date(a[timeField]).getTime()
    const timeB = new Date(b[timeField]).getTime()
    return timeA - timeB
  })
  
  const values = sortedRows.map(r => Number(r[valueField]) || 0)
  const total = values.reduce((a, b) => a + b, 0)
  const avg = total / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  
  // 计算增长率（最后一段 vs 第一段）
  const firstValue = values[0] || 0
  const lastValue = values[values.length - 1] || 0
  const growthRate = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0
  
  // 计算平均值趋势
  const mid = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, mid)
  const secondHalf = values.slice(mid)
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const trendDirection = secondHalfAvg > firstHalfAvg ? 'up' : secondHalfAvg < firstHalfAvg ? 'down' : 'stable'
  
  return {
    type: 'trend',
    timeField,
    valueField,
    total,
    average: avg.toFixed(2),
    min,
    max,
    growthRate: growthRate.toFixed(2) + '%',
    trendDirection,
    dataPoints: values.length,
    summary: `总体趋势${trendDirection === 'up' ? '上升' : trendDirection === 'down' ? '下降' : '平稳'}，总增长 ${growthRate.toFixed(2)}%`
  }
}

/**
 * 分布分析
 */
function analyzeDistribution(rows: any[], field: string) {
  const distribution: Record<string, number> = {}
  
  rows.forEach(row => {
    const value = String(row[field] ?? 'NULL')
    distribution[value] = (distribution[value] || 0) + 1
  })
  
  const total = rows.length
  const entries = Object.entries(distribution)
    .map(([value, count]) => ({
      value,
      count,
      percentage: ((count / total) * 100).toFixed(2) + '%'
    }))
    .sort((a, b) => b.count - a.count)
  
  return {
    type: 'distribution',
    field,
    total,
    uniqueValues: entries.length,
    topValues: entries.slice(0, 10),
    summary: `共 ${entries.length} 个不同值，最常见的是 "${entries[0]?.value}" (${entries[0]?.percentage})`
  }
}

/**
 * 关联分析
 */
function analyzeCorrelation(rows: any[], columns: string[]) {
  // 找出数值列
  const numericColumns = columns.filter(col => 
    rows.length > 0 && typeof rows[0][col] === 'number'
  )
  
  if (numericColumns.length < 2) {
    return {
      type: 'correlation',
      message: '数据中没有足够的数值列进行关联分析'
    }
  }
  
  // 计算相关系数矩阵
  const correlations: any[] = []
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i]
      const col2 = numericColumns[j]
      const correlation = calculateCorrelation(
        rows.map(r => Number(r[col1]) || 0),
        rows.map(r => Number(r[col2]) || 0)
      )
      correlations.push({
        field1: col1,
        field2: col2,
        correlation: correlation.toFixed(3),
        strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.3 ? 'moderate' : 'weak'
      })
    }
  }
  
  correlations.sort((a, b) => Math.abs(Number(b.correlation)) - Math.abs(Number(a.correlation)))
  
  return {
    type: 'correlation',
    numericColumns,
    correlations: correlations.slice(0, 5),
    summary: correlations.length > 0 
      ? `"${correlations[0].field1}" 和 "${correlations[0].field2}" 相关性最强 (${correlations[0].correlation})`
      : '未找到明显的字段关联'
  }
}

/**
 * 计算皮尔逊相关系数
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * 异常检测
 */
function analyzeAnomaly(rows: any[], field: string) {
  const values = rows.map(r => Number(r[field]) || 0)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  // 使用 3-sigma 法则检测异常
  const anomalies = rows.filter((row, index) => {
    const value = values[index]
    const zScore = Math.abs((value - mean) / stdDev)
    return zScore > 3
  }).map(row => ({
    ...row,
    _anomalyScore: Math.abs((Number(row[field]) - mean) / stdDev).toFixed(2)
  }))
  
  return {
    type: 'anomaly',
    field,
    total: rows.length,
    anomalyCount: anomalies.length,
    anomalyRate: ((anomalies.length / rows.length) * 100).toFixed(2) + '%',
    mean: mean.toFixed(2),
    stdDev: stdDev.toFixed(2),
    anomalies: anomalies.slice(0, 5),
    summary: anomalies.length > 0
      ? `发现 ${anomalies.length} 个异常值（ ${((anomalies.length / rows.length) * 100).toFixed(2)}% ）`
      : '未发现明显异常值'
  }
}

// ==================== 导出所有 Tools ====================

export function createAllTools(context: ToolContext) {
  return [
    createGetDatabaseSchemaTool(context),
    createGetTableInfoTool(context),
    createExecuteQueryTool(context),
    createExecuteDmlTool(context),
    createAnalyzeDataTool(context),
    createGenerateAndExecuteTool(context)
  ]
}
