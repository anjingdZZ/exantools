const { Client } = require('@notionhq/client')

// 代理支持（本地开发需要走代理连 Notion API）
let agent = undefined
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
if (proxyUrl) {
  const { HttpsProxyAgent } = require('https-proxy-agent')
  agent = new HttpsProxyAgent(proxyUrl)
}

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  agent,
})
const databaseId = process.env.NOTION_DATABASE_ID
const summaryPageId = process.env.SUMMARY_PAGE_ID

/**
 * 同步错题：
 * 1. 表格里新建一行（属性摘要，方便筛选）
 * 2. 行详情页里放链接指向汇总页面
 * 3. 全部详细内容追加到汇总页面
 */
async function syncWrongAnswer(data, imageUrl) {
  const now = new Date().toISOString().split('T')[0]

  // === 1. 创建表格行 ===
  const properties = {
    '模块': {
      title: [
        {
          text: {
            content: data.module || '考公错题',
          },
        },
      ],
    },
    '题型': data.questionType
      ? { select: { name: data.questionType } }
      : undefined,
    '错误原因': data.errorReason
      ? { select: { name: data.errorReason } }
      : undefined,
    '知识点': data.knowledgePoints?.length
      ? { multi_select: data.knowledgePoints.map((kp) => ({ name: kp })) }
      : undefined,
    '我的答案': data.myAnswer
      ? { rich_text: [{ text: { content: data.myAnswer } }] }
      : undefined,
    '正确答案': data.correctAnswer
      ? { rich_text: [{ text: { content: data.correctAnswer } }] }
      : undefined,
    '来源': data.source
      ? { select: { name: data.source } }
      : undefined,
    '错题次数': { number: 1 },
    '上次错误日期': { date: { start: now } },
    '掌握状态': { select: { name: '待复习' } },
    '原图': imageUrl
      ? { files: [{ name: '错题原图.jpg', type: 'external', external: { url: imageUrl } }] }
      : undefined,
  }

  // 过滤 undefined
  const cleanProperties = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) {
      cleanProperties[key] = value
    }
  }

  // 行详情页的 blocks：展示原图 + 链接到汇总页面
  const pageBlocks = []

  // 原图
  if (imageUrl) {
    pageBlocks.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url: imageUrl },
      },
    })
  }

  // 链接到汇总页面
  if (summaryPageId) {
    pageBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '📚 ' } },
          {
            type: 'text',
            text: { content: '查看全部错题汇总', link: { url: `https://notion.so/${summaryPageId.replace(/-/g, '')}` } },
          },
        ],
      },
    })
  }

  console.log('  📋 创建表格行...')
  const dbPage = await retryOnFail(() =>
    notion.pages.create({
      parent: { database_id: databaseId },
      properties: cleanProperties,
      children: pageBlocks,
    })
  )

  // === 2. 追加内容到汇总页面 ===
  if (summaryPageId) {
    const summaryBlocks = buildSummaryBlocks(data, imageUrl)
    console.log('  📄 追加到汇总页面...')
    await retryOnFail(() =>
      notion.blocks.children.append({
        block_id: summaryPageId,
        children: summaryBlocks,
      })
    )
  }

  return {
    url: summaryPageId
      ? `https://notion.so/${summaryPageId.replace(/-/g, '')}`
      : dbPage.url,
    id: summaryPageId || dbPage.id,
  }
}

/**
 * 构建汇总页面中的错题内容 blocks
 */
function buildSummaryBlocks(data, imageUrl) {
  const blocks = []

  // 分隔线
  blocks.push({ object: 'block', type: 'divider', divider: {} })

  // 标签行：模块 · 题型 · 错误原因 · 知识点
  const tags = [
    data.module,
    data.questionType,
    data.errorReason,
    data.knowledgePoints?.length ? data.knowledgePoints.join('、') : null,
  ]
    .filter(Boolean)
    .join(' · ')
  if (tags) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: `🏷 ${tags}` } }],
      },
    })
  }

  // 原题图片
  if (imageUrl) {
    blocks.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url: imageUrl },
      },
    })
  }

  // 题目文本
  if (data.question) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: data.question } }],
      },
    })
  }

  // 选项
  if (data.options) {
    const optionText = Object.entries(data.options)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}. ${v}`)
      .join('\n')
    if (optionText) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: optionText } }],
        },
      })
    }
  }

  // 答案
  if (data.myAnswer || data.correctAnswer) {
    const answerText = [
      data.myAnswer ? `❌ 我的答案: ${data.myAnswer}` : '',
      data.correctAnswer ? `✅ 正确答案: ${data.correctAnswer}` : '',
    ]
      .filter(Boolean)
      .join('    ')
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: answerText } }],
      },
    })
  }

  // 解析
  if (data.solution) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: `🔍 ${data.solution}` } }],
      },
    })
  }

  return blocks
}

/**
 * 网络请求自动重试
 */
async function retryOnFail(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.status === 429 ||
        err.status >= 500
      if (isRetryable && i < retries - 1) {
        console.log(`  ⚠️ Notion API 请求失败 (${err.code || err.status}), 第 ${i + 2}/${retries} 次重试...`)
        await new Promise((r) => setTimeout(r, 2000))
      } else {
        throw err
      }
    }
  }
}

module.exports = { syncWrongAnswer }
