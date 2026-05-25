# RemoteSQLite AI 助手功能设计文档

> **文档版本**: v1.0  
> **创建日期**: 2026-05-25  
> **状态**: 设计阶段  
> **适用范围**: AI 助手功能开发

---

## 目录

1. [概述](#1-概述)
2. [核心能力](#2-核心能力)
3. [系统架构](#3-系统架构)
4. [功能模块设计](#4-功能模块设计)
5. [AI Tools 设计](#5-ai-tools-设计)
6. [安全与权限](#6-安全与权限)
7. [用户界面设计](#7-用户界面设计)
8. [数据流与交互流程](#8-数据流与交互流程)
9. [配置管理](#9-配置管理)
10. [错误处理](#10-错误处理)
11. [实现计划](#11-实现计划)

---

## 1. 概述

### 1.1 功能定位

RemoteSQLite AI 助手是一个集成在桌面应用中的智能数据库助手，具备以下核心能力：

- **智能 SQL 生成**：根据自然语言描述自动生成 SQL 语句
- **自动执行能力**：根据安全级别自动执行 SQL，减少用户操作步骤
- **数据分析洞察**：自动获取数据并进行多维度分析
- **智能过滤与查询**：根据需求自动构建复杂查询条件
- **错误诊断修复**：分析 SQL 错误并提供修复建议

### 1.2 设计理念

- **自动化优先**：SAFE 和 WARNING 级别操作默认自动执行
- **安全可控**：DANGEROUS 级别操作强制用户确认
- **上下文感知**：自动获取数据库结构，理解当前操作环境
- **多轮推理**：复杂分析任务自动分解为多步执行

---

## 2. 核心能力

### 2.1 自动执行 SQL 能力

#### 2.1.1 安全级别定义

| 级别 | 操作类型 | 自动执行 | 说明 |
|------|----------|----------|------|
| **SAFE** | SELECT, PRAGMA, EXPLAIN | ✅ 是 | 只读操作，无风险 |
| **WARNING** | INSERT, UPDATE, DELETE (有 WHERE) | ✅ 是（可配置） | 修改数据，但条件明确 |
| **DANGEROUS** | DROP, ALTER, TRUNCATE, DELETE (无 WHERE) | ❌ 否 | 高风险操作，必须确认 |

#### 2.1.2 执行策略

```typescript
interface ExecutionPolicy {
  safe: {
    autoExecute: true        // 始终自动执行
    showConfirmation: false  // 不显示确认
  }
  warning: {
    autoExecute: true        // 默认自动执行
    showConfirmation: false  // 不显示确认（可配置）
    maxRows: 1000           // 影响行数超过此值需确认
  }
  dangerous: {
    autoExecute: false       // 永不自动执行
    showConfirmation: true   // 始终显示确认
    requireDoubleConfirm: true  // 危险操作需二次确认
  }
}
```

#### 2.1.3 影响预估机制

对于 DELETE/UPDATE 操作，AI 助手会先执行预估查询：

```sql
-- 用户要求: DELETE FROM users WHERE status = 'inactive'
-- AI 先执行:
SELECT COUNT(*) as affected_rows FROM users WHERE status = 'inactive'

-- 如果 affected_rows > threshold，则显示确认对话框
```

### 2.2 自动数据获取与分析能力

#### 2.2.1 分析流程

```
用户输入: "分析最近一周注册用户增长趋势"
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Step 1: 结构发现                                        │
│    └─> Tool: get_database_schema                        │
│    └─> 识别 users 表，定位 created_at 字段               │
├─────────────────────────────────────────────────────────┤
│  Step 2: 数据获取                                        │
│    └─> 生成统计查询 SQL                                  │
│    └─> 自动执行（SAFE级别）                              │
│    └─> 获取时间序列数据                                  │
├─────────────────────────────────────────────────────────┤
│  Step 3: 数据分析                                        │
│    └─> 计算日增长率、环比、累计值                        │
│    └─> 识别峰值、异常点                                  │
│    └─> 生成趋势预测                                      │
├─────────────────────────────────────────────────────────┤
│  Step 4: 结果呈现                                        │
│    └─> 文本图表可视化                                    │
│    └─> 关键指标摘要                                      │
│    └─>  actionable insights                              │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.2 分析类型支持

| 分析类型 | 描述 | 示例 |
|----------|------|------|
| **趋势分析** | 时间序列数据的趋势、周期、预测 | "用户增长趋势" |
| **分布分析** | 字段值的分布情况、占比 | "年龄分布统计" |
| **关联分析** | 多表关联数据的统计 | "用户购买偏好" |
| **异常检测** | 识别异常值、重复数据 | "找出重复邮箱" |
| **对比分析** | 多维度数据对比 | "本月vs上月销售" |

#### 2.2.3 多轮查询能力

复杂分析任务自动分解为多轮查询：

```
场景: "找出高价值客户并分析其购买偏好"

Round 1: 识别相关表（orders, customers, order_items）
Round 2: 计算客户价值排名（TOP 100）
Round 3: 获取高价值客户画像数据
Round 4: 分析购买品类分布
Round 5: 生成综合分析报告
```

---

## 3. 系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      用户交互层 (React 前端)                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  AIAssistantPanel.tsx - AI助手对话面板                        │ │
│  │  ├─ 消息列表（用户/AI/系统）                                   │ │
│  │  ├─ SQL 结果卡片（可执行/可复制/可编辑）                       │ │
│  │  ├─ 数据分析报告（文本图表 + 指标）                            │ │
│  │  ├─ 确认对话框（危险操作）                                     │ │
│  │  └─ 快捷分析按钮                                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼ IPC (EventEmitter)                    │
├─────────────────────────────────────────────────────────────────────┤
│           LangChain ReAct Agent 层 (Electron Main 进程)             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  sql-agent.ts - SQL智能Agent                                  │ │
│  │  ├─ ChatModel (OpenAI/兼容API)                                │ │
│  │  ├─ System Prompt (动态上下文)                                │ │
│  │  ├─ Tool Registry (6个核心Tools)                             │ │
│  │  ├─ 安全级别判断器                                            │ │
│  │  ├─ 影响预估器                                                │ │
│  │  └─ 流式输出管理器                                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│              langchain + @langchain/openai                          │
│                              │                                       │
│                              ▼                                       │
│                    OpenAI API / 兼容 API                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| AI 入口 | `electron/ai/index.ts` | IPC 注册、流式事件转发、生命周期管理 |
| Agent 核心 | `electron/ai/agents/sql-agent.ts` | ReAct Agent、流式生成、安全判断 |
| Tools | `electron/ai/tools/sql-tools.ts` | 数据库操作 Tools 定义 |
| Prompts | `electron/ai/prompts/sql-prompts.ts` | System Prompt 模板 |
| 配置管理 | `electron/ai/config/provider-config.ts` | AI 配置存储与验证 |
| UI 组件 | `src/components/AIAssistantPanel.tsx` | 对话界面、结果展示 |
| 状态管理 | `src/stores/useAIStore.ts` | AI 状态、对话历史 |
| 类型定义 | `src/types/ai.ts` | TypeScript 类型定义 |

---

## 4. 功能模块设计

### 4.1 AI Agent 核心

#### 4.1.1 Agent 能力

```typescript
interface SQLAgent {
  // 流式对话
  chatStream(input: string, context: DatabaseContext): AsyncGenerator<StreamEvent>
  
  // 单轮 SQL 生成
  generateSQL(description: string, context: DatabaseContext): Promise<SQLGenerationResult>
  
  // 自动分析与执行
  analyzeAndExecute(goal: string, context: DatabaseContext): Promise<AnalysisReport>
  
  // 错误诊断
  diagnoseError(error: SQLError, context: DatabaseContext): Promise<DiagnosisResult>
}
```

#### 4.1.2 流式事件类型

```typescript
type StreamEvent =
  | { type: 'token'; content: string }                    // 文本流
  | { type: 'tool_start'; tool: string; params?: any }    // 工具调用开始
  | { type: 'tool_end'; tool: string; result: any }       // 工具调用结束
  | { type: 'sql_generated'; sql: string; safety: SafetyLevel }  // SQL生成
  | { type: 'sql_executing'; sql: string }                // SQL执行中
  | { type: 'sql_result'; result: QueryResult }           // SQL执行结果
  | { type: 'analysis'; data: AnalysisData }              // 分析数据
  | { type: 'confirmation_required'; operation: DangerousOperation }  // 需要确认
  | { type: 'complete'; summary?: string }                // 完成
  | { type: 'error'; message: string; code?: string }     // 错误
```

### 4.2 数据库上下文

```typescript
interface DatabaseContext {
  // 连接信息
  connectionId: string
  host: string
  port: number
  username: string
  
  // 数据库信息
  dbPath: string
  dbName: string
  
  // 当前选中
  currentTable?: string
  currentSQL?: string
  lastResult?: QueryResult
  lastError?: SQLError
  
  // 缓存的表结构（减少重复查询）
  schemaCache?: DatabaseSchema
}

interface DatabaseSchema {
  tables: TableInfo[]
  views: ViewInfo[]
  indexes: IndexInfo[]
  fetchedAt: number
}
```

---

## 5. AI Tools 设计

### 5.1 Tools 列表

#### Tool 1: get_database_schema

```typescript
const getDatabaseSchema = tool({
  name: 'get_database_schema',
  description: '获取当前数据库的完整结构信息，包括所有表、列、索引',
  parameters: z.object({
    includeSampleData: z.boolean().optional()
      .describe('是否包含样本数据（前3行）')
  }),
  execute: async ({ includeSampleData }) => {
    // 调用 sqliteService 获取表列表
    // 对每个表获取列信息
    // 可选：获取样本数据
    return { tables: [...], indexes: [...] }
  }
})
```

#### Tool 2: get_table_info

```typescript
const getTableInfo = tool({
  name: 'get_table_info',
  description: '获取指定表的详细信息，包括列定义、索引、外键',
  parameters: z.object({
    tableName: z.string().describe('表名'),
    includeStatistics: z.boolean().optional()
      .describe('是否包含统计信息（行数、大小）')
  }),
  execute: async ({ tableName, includeStatistics }) => {
    // 获取表结构
    // 获取索引
    // 可选：执行 COUNT(*) 等统计
    return { columns: [...], indexes: [...], stats: {...} }
  }
})
```

#### Tool 3: execute_query

```typescript
const executeQuery = tool({
  name: 'execute_query',
  description: '执行 SELECT/PRAGMA 查询并返回结果（SAFE级别自动执行）',
  parameters: z.object({
    sql: z.string().describe('SQL查询语句'),
    limit: z.number().optional().default(1000)
      .describe('最大返回行数')
  }),
  execute: async ({ sql, limit }) => {
    // 安全级别检查（必须是 SAFE）
    // 添加 LIMIT 限制
    // 执行查询
    return { columns: [...], rows: [...], rowCount: 100 }
  }
})
```

#### Tool 4: execute_dml

```typescript
const executeDml = tool({
  name: 'execute_dml',
  description: '执行 INSERT/UPDATE/DELETE（WARNING级别，可配置自动执行）',
  parameters: z.object({
    sql: z.string().describe('DML语句'),
    requireConfirmation: z.boolean().optional()
      .describe('是否要求确认（覆盖默认配置）')
  }),
  execute: async ({ sql, requireConfirmation }) => {
    // 安全级别检查
    // 预估影响行数
    // 根据配置决定是否自动执行
    return { affectedRows: 10, executionTime: 50 }
  }
})
```

#### Tool 5: analyze_data

```typescript
const analyzeData = tool({
  name: 'analyze_data',
  description: '对查询结果进行统计分析',
  parameters: z.object({
    query: z.string().describe('要分析的查询SQL'),
    analysisType: z.enum(['trend', 'distribution', 'correlation', 'anomaly'])
      .describe('分析类型'),
    dimensions: z.array(z.string()).optional()
      .describe('分析维度字段')
  }),
  execute: async ({ query, analysisType, dimensions }) => {
    // 执行查询获取数据
    // 根据 analysisType 执行不同分析
    // 返回分析结果
    return {
      statistics: {...},
      insights: [...],
      visualization: {...}  // 图表数据
    }
  }
})
```

#### Tool 6: generate_and_execute

```typescript
const generateAndExecute = tool({
  name: 'generate_and_execute',
  description: '根据需求生成SQL并立即执行（核心自动流程）',
  parameters: z.object({
    goal: z.string().describe('数据需求描述'),
    context: z.object({
      tableHint: z.string().optional(),
      timeRange: z.object({ start: z.string(), end: z.string() }).optional()
    }).optional()
  }),
  execute: async ({ goal, context }) => {
    // 1. 分析需求
    // 2. 生成 SQL
    // 3. 判断安全级别
    // 4. 自动执行（SAFE/WARNING）或返回待确认（DANGEROUS）
    // 5. 分析结果
    return {
      sql: '...',
      safetyLevel: 'safe',
      result: {...},
      analysis: {...}
    }
  }
})
```

### 5.2 Tool 调用流程

```
用户: "分析用户表的数据分布"
  │
  ▼
AI: 调用 get_database_schema
  │
  ▼
系统: 返回 users 表结构
  │
  ▼
AI: 调用 analyze_data
     query: "SELECT age, COUNT(*) FROM users GROUP BY age"
     analysisType: "distribution"
  │
  ▼
系统: 返回分析结果
  │
  ▼
AI: 生成分析报告（文本图表 + 洞察）
```

---

## 6. 安全与权限

### 6.1 安全级别判断

```typescript
function classifySQLSafety(sql: string): SafetyLevel {
  const normalized = sql.trim().toUpperCase()
  
  // SAFE: 只读操作
  if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\s/i.test(normalized)) {
    return 'safe'
  }
  
  // DANGEROUS: 结构性修改或无条件删除
  if (/^(DROP|ALTER|TRUNCATE|CREATE|DELETE\s+FROM\s+\w+\s*;?\s*$)/i.test(normalized)) {
    return 'dangerous'
  }
  
  // DANGEROUS: DELETE 无 WHERE
  if (/^DELETE\s+FROM\s+\w+\s*(?!WHERE)/i.test(normalized)) {
    return 'dangerous'
  }
  
  // WARNING: 数据修改
  if (/^(INSERT|UPDATE|DELETE)/i.test(normalized)) {
    return 'warning'
  }
  
  return 'warning'
}
```

### 6.2 影响预估

```typescript
async function estimateImpact(
  sql: string, 
  connectionId: string, 
  dbPath: string
): Promise<ImpactEstimate> {
  const safety = classifySQLSafety(sql)
  
  if (safety === 'safe') {
    return { level: 'safe', canAutoExecute: true }
  }
  
  // 对于 DELETE/UPDATE，执行 COUNT 预估
  if (/^(DELETE|UPDATE)/i.test(sql)) {
    const countSql = sql
      .replace(/^DELETE/i, 'SELECT COUNT(*) as count')
      .replace(/^UPDATE/i, 'SELECT COUNT(*) as count')
      .replace(/SET\s+.+$/i, '')  // 移除 UPDATE 的 SET 部分
    
    const result = await sqliteService.query(connectionId, dbPath, countSql)
    const affectedRows = result.rows[0]?.count || 0
    
    return {
      level: affectedRows > 1000 ? 'dangerous' : 'warning',
      affectedRows,
      canAutoExecute: affectedRows <= 1000
    }
  }
  
  return { level: 'dangerous', canAutoExecute: false }
}
```

### 6.3 确认对话框设计

```typescript
interface ConfirmationDialog {
  title: string           // "确认执行危险操作"
  operation: string       // "DELETE FROM users WHERE ..."
  level: 'warning' | 'dangerous'
  
  // 影响信息
  impact: {
    affectedRows: number
    affectedTables: string[]
    isDestructive: boolean  // 是否破坏性操作
  }
  
  // 预览数据
  preview?: {
    columns: string[]
    rows: any[]            // 前5行受影响数据
  }
  
  // 用户操作
  actions: {
    cancel: { label: '取消', primary: false }
    preview: { label: '查看受影响数据', primary: false }
    confirm: { label: '确认执行', primary: true, danger: true }
  }
}
```

---

## 7. 用户界面设计

### 7.1 AI 助手面板布局

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 AI 助手                                    [自动模式 🔵] [⚙️] │
├─────────────────────────────────────────────────────────────────┤
│  💡 快捷分析:                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ 📊 数据分布  │ │ 📈 趋势分析  │ │ 🔍 异常检测  │ │ 🎯 智能查询  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  💬 对话历史                                                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 👤 查询最近一周用户注册情况                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🤖 正在分析...                                              ││
│  │ 🔧 获取表结构 ✓                                             ││
│  │ 🔧 执行查询 ✓                                               ││
│  │                                                             ││
│  │ 📊 查询结果:                                                ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 日期       │ 新注册 │ 累计    │ 增长率                  │ ││
│  │ │────────────│────────│─────────│─────────────────────────│ ││
│  │ │ 2024-01-20 │   45   │  1,245  │  +3.7%                  │ ││
│  │ │ 2024-01-21 │   52   │  1,297  │  +15.6%                 │ ││
│  │ │ 2024-01-22 │   38   │  1,335  │  -26.9%                 │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ 📈 趋势图表:                                                ││
│  │ 周一  周二  周三  周四  周五  周六  周日                     ││
│  │  45    52    38    61    89    72    48                     ││
│  │  █     █    ▂     █    ██    ██    █                       ││
│  │                                                             ││
│  │ 💡 洞察:                                                    ││
│  │ • 周五达到峰值 (89人)，建议在这天推送营销内容               ││
│  │ • 周三最低 (38人)，可考虑发送召回邮件                       ││
│  │ • 平均日注册: 57.6人，周总计 403人                          ││
│  │                                                             ││
│  │ [在编辑器中打开] [导出CSV] [深度分析]                       ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ⚠️ 待确认操作                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔴 DELETE FROM logs WHERE created_at < '2024-01-01'         ││
│  │                                                             ││
│  │ 影响: 将删除 12,580 条记录                                   ││
│  │ [查看预览] [取消] [确认删除]                                 ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  [🎤] [输入您的问题或需求...                           ] [发送] │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 消息类型渲染

```typescript
type MessageType = 
  | 'user'           // 用户消息
  | 'assistant'      // AI 文本回复
  | 'sql'            // SQL 代码块（可执行）
  | 'result'         // 查询结果表格
  | 'analysis'       // 分析报告
  | 'chart'          // 图表数据
  | 'confirmation'   // 确认请求
  | 'system'         // 系统消息（工具调用状态）
  | 'error'          // 错误信息
```

### 7.3 SQL 结果卡片

```
┌─────────────────────────────────────────────────────────┐
│ 📋 生成的 SQL                                        [📋]│
├─────────────────────────────────────────────────────────┤
│ SELECT u.username, COUNT(o.id) as order_count          │
│ FROM users u                                           │
│ LEFT JOIN orders o ON u.id = o.user_id                 │
│ WHERE u.created_at >= date('now', '-30 days')          │
│ GROUP BY u.id                                          │
│ HAVING order_count > 5                                 │
│ ORDER BY order_count DESC                              │
│ LIMIT 100                                              │
├─────────────────────────────────────────────────────────┤
│ 说明: 查询近30天注册且下单超过5次的活跃用户              │
│ 安全级别: 🟢 SAFE (只读查询)                             │
├─────────────────────────────────────────────────────────┤
│ [▶️ 立即执行] [📝 插入编辑器] [🔄 重新生成]              │
└─────────────────────────────────────────────────────────┘
```

---

## 8. 数据流与交互流程

### 8.1 标准查询流程

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. 前端接收输入                                          │
│    - 添加到消息列表                                      │
│    - 显示"思考中"状态                                    │
│    - 调用 window.electronAPI.ai.chatStream()            │
└─────────────────────────────────────────────────────────┘
    │
    ▼ IPC
┌─────────────────────────────────────────────────────────┐
│ 2. Agent 处理                                            │
│    - 解析用户意图                                        │
│    - 决定是否需要工具调用                                │
│    - 生成响应                                            │
└─────────────────────────────────────────────────────────┘
    │
    ├── 需要获取结构 ──> Tool: get_database_schema
    │                      │
    │                      ▼
    │                   返回表结构
    │                      │
    ├── 需要查询数据 ──> Tool: execute_query
    │                      │
    │                      ▼
    │                   返回结果集
    │                      │
    └── 生成 SQL ──────> Tool: generate_and_execute
                           │
                           ├── SAFE ──> 自动执行
                           │              │
                           │              ▼
                           │           返回结果
                           │
                           └── DANGEROUS -> 返回待确认
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. 流式返回结果                                          │
│    - token 流: 实时显示文本                              │
│    - tool_start: 显示工具调用状态                        │
│    - sql_generated: 显示 SQL 卡片                        │
│    - sql_result: 显示结果表格                            │
│    - complete: 结束流                                    │
└─────────────────────────────────────────────────────────┘
    │
    ▼ IPC
┌─────────────────────────────────────────────────────────┐
│ 4. 前端渲染                                              │
│    - 更新消息内容                                        │
│    - 渲染 SQL 卡片                                       │
│    - 渲染结果表格                                        │
│    - 启用操作按钮                                        │
└─────────────────────────────────────────────────────────┘
```

### 8.2 危险操作确认流程

```
AI 生成 DANGEROUS 级别 SQL
    │
    ▼
前端显示确认对话框
    │
    ├── 用户点击"取消"
    │       │
    │       ▼
    │    取消执行，显示"已取消"
    │
    ├── 用户点击"查看预览"
    │       │
    │       ▼
    │    执行 SELECT 预览受影响数据
    │    在对话框内显示前5行
    │
    └── 用户点击"确认执行"
            │
            ▼
    发送 'ai:confirmExecution' IPC
            │
            ▼
    后端执行 SQL
            │
            ▼
    返回执行结果
            │
            ▼
    前端显示结果
```

---

## 9. 配置管理

### 9.1 AI 配置接口

```typescript
interface AIConfig {
  // 基础配置
  enabled: boolean
  provider: 'openai' | 'openai-compatible'
  apiKey: string
  baseUrl?: string
  model: string
  
  // 生成参数
  temperature: number      // 0-1，默认 0.3
  maxTokens: number        // 默认 4096
  
  // 执行配置
  execution: {
    autoExecuteSafe: boolean      // 默认 true
    autoExecuteWarning: boolean   // 默认 true
    warningThreshold: number      // 影响行数阈值，默认 1000
    requireConfirmDangerous: boolean  // 默认 true
  }
  
  // 分析配置
  analysis: {
    autoAnalyze: boolean          // 查询后自动分析，默认 true
    maxAnalysisRows: number       // 最大分析行数，默认 10000
    generateVisualization: boolean // 生成文本图表，默认 true
  }
  
  // 上下文配置
  context: {
    maxHistoryMessages: number    // 保留历史消息数，默认 20
    cacheSchema: boolean          // 缓存表结构，默认 true
    schemaCacheTTL: number        // 缓存有效期(秒)，默认 300
  }
}
```

### 9.2 配置界面

在 SettingsPanel 中添加 AI 配置区域：

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 AI 助手配置                                           │
├─────────────────────────────────────────────────────────┤
│ ☑️ 启用 AI 助手                                          │
├─────────────────────────────────────────────────────────┤
│ Provider: [OpenAI ▼]                                    │
│ API Key: [••••••••••••••••••••••••••••••••••••]         │
│ Base URL: [https://api.openai.com/v1        ] (兼容API) │
│ Model: [gpt-4 ▼] 或 [自定义输入]                         │
├─────────────────────────────────────────────────────────┤
│ 执行设置:                                                │
│ ☑️ 自动执行 SAFE 级别查询 (SELECT)                       │
│ ☑️ 自动执行 WARNING 级别查询 (INSERT/UPDATE/DELETE)      │
│    当影响行数超过 [1000] 时要求确认                      │
│ ☑️ 危险操作需要确认 (DROP/ALTER/无WHERE删除)             │
├─────────────────────────────────────────────────────────┤
│ 分析设置:                                                │
│ ☑️ 查询后自动数据分析                                    │
│ ☑️ 生成文本图表                                          │
│ 最大分析行数: [10000]                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 10. 错误处理

### 10.1 错误类型

| 错误类型 | 描述 | 处理方式 |
|----------|------|----------|
| **配置错误** | API Key 无效、模型不存在 | 提示用户检查配置 |
| **连接错误** | AI 服务无法连接 | 重试3次后提示网络错误 |
| **生成错误** | SQL 生成失败 | 显示错误信息，提供重试 |
| **执行错误** | SQL 执行失败 | 自动诊断并提供修复建议 |
| **超时错误** | 查询超时 | 提示添加 LIMIT 优化 |
| **安全错误** | 检测到危险操作 | 要求用户确认 |

### 10.2 错误诊断示例

```
用户: "查询用户表"
AI生成: "SELECT * FORM users"  (拼写错误)
    │
    ▼
执行失败: "near 'FORM': syntax error"
    │
    ▼
AI 自动诊断:
┌─────────────────────────────────────────────────────────┐
│ ❌ SQL 执行失败                                          │
│                                                         │
│ 错误: near "FORM": syntax error                         │
│ 位置: 第1行第10列                                        │
│                                                         │
│ 🔍 诊断:                                                 │
│ "FORM" 不是有效的 SQL 关键字，您是否想输入 "FROM"?       │
│                                                         │
│ 💡 修复建议:                                             │
│ SELECT * FROM users;                                    │
│                                                         │
│ [应用修复] [重新生成] [手动编辑]                         │
└─────────────────────────────────────────────────────────┘
```

---

## 11. 实现计划

### 11.1 第一阶段：基础框架

- [ ] 添加 AI 相关依赖（langchain, @langchain/openai, zod）
- [ ] 创建 AI 模块目录结构
- [ ] 实现配置管理（provider-config.ts）
- [ ] 实现 IPC 通信接口
- [ ] 创建基础 UI 组件框架

### 11.2 第二阶段：核心功能

- [ ] 实现 SQL Agent 基础能力
- [ ] 实现 6 个核心 Tools
- [ ] 实现流式输出
- [ ] 实现安全级别判断
- [ ] 集成到 SettingsPanel

### 11.3 第三阶段：自动执行

- [ ] 实现自动执行逻辑
- [ ] 实现影响预估
- [ ] 实现确认对话框
- [ ] 实现执行结果反馈

### 11.4 第四阶段：数据分析

- [ ] 实现 analyze_data Tool
- [ ] 实现文本图表生成
- [ ] 实现多轮查询
- [ ] 实现快捷分析按钮

### 11.5 第五阶段：优化完善

- [ ] 错误诊断与修复建议
- [ ] 性能优化（缓存、限流）
- [ ] 用户体验优化
- [ ] 文档完善

---

## 附录

### A. 参考资源

- [LangChain 文档](https://js.langchain.com/)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [SQLite 语法参考](https://www.sqlite.org/lang.html)

### B. 相关文档

- [产品需求文档](./产品需求文档.md)
- [技术文档](./技术文档.md)
- [部署指南](./部署指南.md)

---

*文档结束*
