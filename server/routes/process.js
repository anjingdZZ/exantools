const express = require('express')
const multer = require('multer')
const { extractFromImage } = require('../services/llm')
const { createWrongAnswerPage } = require('../services/notion')

const router = express.Router()

// 图片上传（兼容：multipart 和 base64 JSON 两种方式）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片文件'))
    }
  },
})

/**
 * POST /api/process
 * 上传图片 → DeepSeek Vision 识别 → 返回结构化 JSON
 * 支持两种传图方式：
 *   1. multipart/form-data: field name = "image"
 *   2. application/json: { image: "data:image/...;base64,..." }
 */
router.post('/process', upload.single('image'), async (req, res) => {
  try {
    let imageBuffer, mimeType

    // 方式1: multipart 上传
    if (req.file) {
      imageBuffer = req.file.buffer
      mimeType = req.file.mimetype
    }
    // 方式2: base64 JSON
    else if (req.body && req.body.image) {
      const matches = req.body.image.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return res.status(400).json({ error: '图片格式无效，请使用 data:image/...;base64,... 格式' })
      }
      mimeType = `image/${matches[1]}`
      imageBuffer = Buffer.from(matches[2], 'base64')
    } else {
      return res.status(400).json({ error: '请上传图片' })
    }

    const result = await extractFromImage(imageBuffer, mimeType)

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('识别失败:', error.message)
    res.status(500).json({ error: `识别失败: ${error.message}` })
  }
})

/**
 * POST /api/sync
 * 接收结构化数据 → 写入 Notion
 */
router.post('/sync', async (req, res) => {
  try {
    const data = req.body

    if (!data || !data.module) {
      return res.status(400).json({ error: '缺少必要字段（module）' })
    }

    const page = await createWrongAnswerPage(data, req.body.imageUrl)

    res.json({
      success: true,
      notionUrl: page.url,
      pageId: page.id,
    })
  } catch (error) {
    console.error('同步失败:', error.message)
    res.status(500).json({ error: `同步到 Notion 失败: ${error.message}` })
  }
})

module.exports = router
