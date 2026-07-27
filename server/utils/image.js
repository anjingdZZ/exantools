/**
 * 图片预处理工具
 * 目前不做复杂处理，直接透传。后续可加：
 * - 方向纠正（读取 EXIF 信息自动旋转）
 * - 压缩（减小尺寸降低 API 费用）
 * - 裁剪（去除无关区域）
 */

/**
 * 校验图片是否有效
 */
function validateImage(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('图片为空')
  }
  if (buffer.length > 20 * 1024 * 1024) {
    throw new Error('图片超过 20MB 限制')
  }
  return true
}

/**
 * 获取图片的 MIME 类型（根据文件头 magic number）
 */
function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return 'image/jpeg'

  const header = buffer.toString('hex', 0, 4)
  if (header.startsWith('89504e47')) return 'image/png'
  if (header.startsWith('ffd8')) return 'image/jpeg'
  if (header.startsWith('474946')) return 'image/gif'
  if (header.startsWith('52494646')) return 'image/webp'

  return 'image/jpeg'
}

module.exports = { validateImage, detectMimeType }
