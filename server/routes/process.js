const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { extractFromImage } = require('../services/llm')
const { syncWrongAnswer } = require('../services/notion')

const router = express.Router()

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// 图片上传（内存存储，用于 process 接口）
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
 * 上传图片 → OCR → DeepSeek 结构化 → 返回 JSON
 */
router.post('/process', upload.single('image'), async (req, res) => {
  try {
    let imageBuffer, mimeType

    if (req.file) {
      imageBuffer = req.file.buffer
      mimeType = req.file.mimetype
    } else if (req.body && req.body.image) {
      const matches = req.body.image.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return res.status(400).json({ error: '图片格式无效' })
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
 * 接收结构化数据 + base64 图片 → 保存图片 → 写入 Notion
 */
router.post('/sync', async (req, res) => {
  try {
    const data = req.body

    if (!data || !data.module) {
      return res.status(400).json({ error: '缺少必要字段（module）' })
    }

    // 保存图片到本地，获取可访问的 URL
    let imageUrl = null
    if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
      const matches = data.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches) {
        const ext = matches[1] === 'png' ? 'png' : 'jpg'
        const fileName = `wt_${Date.now()}.${ext}`
        const filePath = path.join(uploadsDir, fileName)
        const buffer = Buffer.from(matches[2], 'base64')
        fs.writeFileSync(filePath, buffer)
        imageUrl = `/uploads/${fileName}`
        console.log('  📷 图片已保存:', imageUrl)
      }
    }

    // 构造完整 URL（如果是相对路径，补全为绝对地址）
    if (imageUrl && imageUrl.startsWith('/')) {
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
      imageUrl = `${baseUrl}${imageUrl}`
    }

    const result = await syncWrongAnswer(data, imageUrl)

    res.json({
      success: true,
      notionUrl: result.url,
      pageId: result.id,
    })
  } catch (error) {
    console.error('同步失败:', error.message)
    res.status(500).json({ error: `同步到 Notion 失败: ${error.message}` })
  }
})

module.exports = router
