const OpenAI = require('openai')
const { SYSTEM_PROMPT } = require('../prompts/extract')

const deepseek = new OpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

/**
 * 将图片转 base64
 */
function imageToBase64(buffer, mimeType) {
  return buffer.toString('base64')
}

/**
 * 调用 DeepSeek Vision 识别错题图片
 * @param {Buffer} imageBuffer - 图片二进制数据
 * @param {string} mimeType - 图片类型（image/jpeg, image/png 等）
 * @returns {Object} 结构化错题信息
 */
async function extractFromImage(imageBuffer, mimeType) {
  const base64 = imageToBase64(imageBuffer, mimeType)

  const response = await deepseek.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请识别这张错题图片，提取结构化信息。',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 2000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('LLM 返回为空')
  }

  try {
    return JSON.parse(content)
  } catch (e) {
    throw new Error(`LLM 返回非 JSON: ${content}`)
  }
}

module.exports = { extractFromImage }
