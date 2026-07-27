require('dotenv').config()

const express = require('express')
const path = require('path')
const processRouter = require('./routes/process')

const app = express()
const PORT = process.env.PORT || 3100

// 中间件
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 静态文件托管（前端页面）
app.use(express.static(path.join(__dirname, 'public')))

// API 路由
app.use('/api', processRouter)

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 启动
app.listen(PORT, () => {
  console.log(`✅ 考公错题整理助手启动: http://localhost:${PORT}`)
  console.log(`   API 识别: POST /api/process`)
  console.log(`   Notion 同步: POST /api/sync`)
})
