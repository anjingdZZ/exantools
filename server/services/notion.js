const { Client } = require('@notionhq/client')

const notion = new Client({ auth: process.env.NOTION_API_KEY })
const databaseId = process.env.NOTION_DATABASE_ID

/**
 * 将结构化错题数据写入 Notion Database
 * @param {Object} data - 从 LLM 返回的结构化错题数据
 * @param {string} [imageUrl] - 可选的图片 URL
 * @returns {Object} Notion 创建的 Page 对象
 */
async function createWrongAnswerPage(data, imageUrl) {
  // 构建属性
  const properties = {
    '题目摘要': {
      title: [
        {
          text: {
            content: data.question
              ? data.question.slice(0, 80)
              : '未识别题目',
          },
        },
      ],
    },
    '模块': data.module
      ? { select: { name: data.module } }
      : undefined,
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
    '上次错误日期': { date: { start: new Date().toISOString().split('T')[0] } },
    '掌握状态': { select: { name: '待复习' } },
  }

  // 过滤掉 undefined 属性
  const cleanProperties = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) {
      cleanProperties[key] = value
    }
  }

  // 构建内容 blocks
  const children = []

  // 原图
  if (imageUrl) {
    children.push({
      object: 'block',
      type: 'heading2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '📝 原题' } }],
      },
    })
    children.push({
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
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: data.question } }],
      },
    })
  }

  // 选项
  if (data.options) {
    children.push({
      object: 'block',
      type: 'heading2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '📋 选项' } }],
      },
    })
    const optionText = Object.entries(data.options)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}. ${v}`)
      .join('\n')
    if (optionText) {
      children.push({
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
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: answerText } }],
      },
    })
  }

  // 解析
  if (data.solution) {
    children.push({
      object: 'block',
      type: 'heading2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '🔍 解析' } }],
      },
    })
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: data.solution } }],
      },
    })
  }

  // 预留笔记区域
  children.push({
    object: 'block',
    type: 'heading2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: '💡 我的笔记' } }],
    },
  })
  children.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '' } }],
    },
  })

  // 创建 Notion Page
  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: cleanProperties,
    children,
  })

  return response
}

module.exports = { createWrongAnswerPage }
