const OpenAI = require('openai')
const Tesseract = require('tesseract.js')
const { SYSTEM_PROMPT } = require('../prompts/extract')

// 代理支持
let agent = undefined
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
if (proxyUrl) {
  const { HttpsProxyAgent } = require('https-proxy-agent')
  agent = new HttpsProxyAgent(proxyUrl)
}

const deepseek = new OpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
  httpAgent: agent,
})

/**
 * OCR: 从图片中提取文字
 */
async function ocrImage(imageBuffer) {
  const { data } = await Tesseract.recognize(imageBuffer, 'chi_sim+eng', {
    logger: (info) => {
      if (info.status === 'recognizing text') {
        console.log(`  OCR 进度: ${Math.round(info.progress * 100)}%`)
      }
    },
  })
  return data.text
}

/**
 * 调用 DeepSeek + OCR 识别错题图片
 * 流程: 图片 → OCR 提取文字 → DeepSeek 结构化
 */
async function extractFromImage(imageBuffer, mimeType) {
  console.log('📸 步骤1: OCR 识别图片文字...')
  const rawText = await ocrImage(imageBuffer)
  console.log(`   OCR 结果 (${rawText.length} 字符):`)
  console.log(`   ${rawText.slice(0, 400)}...`)

  if (!rawText.trim()) {
    throw new Error('OCR 未能识别出文字，请确认图片清晰')
  }

  console.log('🤖 步骤2: DeepSeek 结构化...')
  const response = await deepseek.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `以下是从一张考公错题图片中提取的文字，请分析并整理成结构化信息：\n\n${rawText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('LLM 返回为空')
  }

  // 尝试解析 JSON，如果被截断了尝试修复
  try {
    const result = JSON.parse(content)
    result._ocrRaw = rawText
    return result
  } catch (e) {
    // 如果 JSON 被截断，尝试补全
    const fixed = tryFixJson(content)
    if (fixed) {
      fixed._ocrRaw = rawText
      return fixed
    }
    throw new Error(`LLM 返回非 JSON: ${content.slice(0, 500)}...`)
  }
}

/**
 * 尝试修复被截断的 JSON
 */
function tryFixJson(str) {
  // 找到最后一个完整的 key-value
  try {
    return JSON.parse(str + '"}')
  } catch (_) {}
  try {
    return JSON.parse(str + '"]}')
  } catch (_) {}
  try {
    return JSON.parse(str + '"}')
  } catch (_) {}
  return null
}

module.exports = { extractFromImage }
