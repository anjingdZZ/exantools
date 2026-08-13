// ===== 枚举值 =====
const ENUMS = {
  module: ['判断推理', '言语理解', '数量关系', '资料分析', '常识判断'],
  questionType: {
    '判断推理': ['图形推理', '定义判断', '类比推理', '逻辑判断'],
    '言语理解': ['逻辑填空', '片段阅读', '语句表达', '篇章阅读'],
    '数量关系': ['数学运算', '数字推理'],
    '资料分析': ['资料分析'],
    '常识判断': ['常识判断'],
  },
}

// ===== DOM =====
const aiModeBtn = document.getElementById('aiModeBtn')
const manualModeBtn = document.getElementById('manualModeBtn')
const uploadArea = document.getElementById('uploadArea')
const uploadPlaceholder = document.getElementById('uploadPlaceholder')
const uploadPreview = document.getElementById('uploadPreview')
const previewImage = document.getElementById('previewImage')
const changePhoto = document.getElementById('changePhoto')
const fileInput = document.getElementById('fileInput')
const loadingState = document.getElementById('loadingState')
const resultArea = document.getElementById('resultArea')
const formTitle = document.getElementById('formTitle')
const errorMessage = document.getElementById('errorMessage')
const syncBtn = document.getElementById('syncBtn')
const syncStatus = document.getElementById('syncStatus')
const hintText = document.getElementById('hintText')

// 手动模式的图片上传
const manualUploadSection = document.getElementById('manualUploadSection')
const manualUploadPreview = document.getElementById('manualUploadPreview')
const manualPreviewImage = document.getElementById('manualPreviewImage')
const manualDeleteBtn = document.getElementById('manualDeleteBtn')
const manualChangePhoto = document.getElementById('manualChangePhoto')
const manualFileInput = document.getElementById('manualFileInput')
const manualPasteBox = document.getElementById('manualPasteBox')
const manualPasteText = document.getElementById('manualPasteText')
const manualSelectBtn = document.getElementById('manualSelectBtn')

const F = {
  module: document.getElementById('fieldModule'),
  type: document.getElementById('fieldType'),
  error: document.getElementById('fieldErrorReason'),
  knowledge: document.getElementById('fieldKnowledge'),
  source: document.getElementById('fieldSource'),
  myAnswer: document.getElementById('fieldMyAnswer'),
  correct: document.getElementById('fieldCorrect'),
  solution: document.getElementById('fieldSolution'),
}

let currentImageBase64 = null
let isManual = false

// ===== 初始化下拉 =====
ENUMS.module.forEach(m => {
  const opt = document.createElement('option')
  opt.value = m; opt.textContent = m
  F.module.appendChild(opt)
})

F.module.addEventListener('change', () => {
  const types = ENUMS.questionType[F.module.value] || []
  F.type.innerHTML = '<option value="">请选择</option>'
  types.forEach(t => {
    const opt = document.createElement('option')
    opt.value = t; opt.textContent = t
    F.type.appendChild(opt)
  })
})

// ===== 模式切换 =====
function setMode(manual) {
  isManual = manual
  aiModeBtn.className = `mode-btn ${manual ? 'inactive' : 'active'}`
  manualModeBtn.className = `mode-btn ${manual ? 'active' : 'inactive'}`

  clearForm()
  errorMessage.classList.add('hidden')
  syncStatus.classList.add('hidden')
  // 重置图片
  currentImageBase64 = null
  uploadPlaceholder.classList.remove('hidden')
  uploadPreview.classList.add('hidden')
  manualPasteBox.classList.remove('hidden')
  manualUploadPreview.classList.add('hidden')

  if (manual) {
    uploadArea.classList.add('hidden')
    loadingState.classList.add('hidden')
    resultArea.classList.remove('hidden')
    formTitle.textContent = '✏️ 手动填写'
    hintText.textContent = '填写信息后同步到 Notion'
    manualUploadSection.classList.remove('hidden')
  } else {
    uploadArea.classList.remove('hidden')
    resultArea.classList.add('hidden')
    formTitle.textContent = '📋 编辑内容'
    hintText.textContent = '拍照上传 → AI 自动识别 → 确认修改 → 同步到 Notion'
    manualUploadSection.classList.add('hidden')
  }
}

aiModeBtn.addEventListener('click', () => setMode(false))
manualModeBtn.addEventListener('click', () => setMode(true))

// ===== AI 模式上传 =====
uploadArea.addEventListener('click', () => fileInput.click())
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover') })
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'))
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadArea.classList.remove('dragover')
  if (e.dataTransfer.files[0]) handleAIFile(e.dataTransfer.files[0])
})
changePhoto.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click() })
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleAIFile(fileInput.files[0]) })

function handleAIFile(file) {
  if (!file.type.startsWith('image/')) { showToast('请选择图片文件'); return }
  if (file.size > 20 * 1024 * 1024) { showToast('图片超过 20MB 限制'); return }
  const reader = new FileReader()
  reader.onload = (e) => {
    currentImageBase64 = e.target.result
    previewImage.src = currentImageBase64
    uploadPlaceholder.classList.add('hidden')
    uploadPreview.classList.remove('hidden')
    resultArea.classList.add('hidden')
    errorMessage.classList.add('hidden')
    submitImage(currentImageBase64)
  }
  reader.readAsDataURL(file)
}

// ===== 手动模式图片上传 =====

// 📁 右侧图标：点击弹出文件选择器
manualSelectBtn.addEventListener('click', () => manualFileInput.click())
// 点击输入框：聚焦，接收粘贴
manualPasteBox.addEventListener('click', () => manualPasteBox.focus())
manualPasteBox.addEventListener('paste', handlePaste)
// ✕ 删除图片
manualDeleteBtn.addEventListener('click', () => {
  currentImageBase64 = null
  manualFileInput.value = ''
  manualUploadPreview.classList.add('hidden')
  manualPasteBox.classList.remove('hidden')
})
// 重新选择
manualChangePhoto.addEventListener('click', (e) => { e.stopPropagation(); manualFileInput.click() })
manualFileInput.addEventListener('change', () => {
  if (manualFileInput.files[0]) handleManualFile(manualFileInput.files[0])
})

function handlePaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) handleManualFile(file)
      break
    }
  }
}

function handleManualFile(file) {
  if (!file.type.startsWith('image/')) { showToast('请选择图片文件'); return }
  if (file.size > 20 * 1024 * 1024) { showToast('图片超过 20MB 限制'); return }
  const reader = new FileReader()
  reader.onload = (e) => {
    currentImageBase64 = e.target.result
    manualPreviewImage.src = currentImageBase64
    manualPasteBox.classList.add('hidden')
    manualUploadPreview.classList.remove('hidden')
  }
  reader.readAsDataURL(file)
}


// ===== AI 识别 =====
async function submitImage(base64) {
  loadingState.classList.remove('hidden')
  try {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '识别失败')
    fillResult(json.data)
    resultArea.classList.remove('hidden')
    errorMessage.classList.add('hidden')
  } catch (err) {
    errorMessage.textContent = `❌ ${err.message}`
    errorMessage.classList.remove('hidden')
    resultArea.classList.remove('hidden')
  } finally {
    loadingState.classList.add('hidden')
  }
}

function fillResult(data) {
  if (data.module && ENUMS.module.includes(data.module)) {
    F.module.value = data.module
    F.module.dispatchEvent(new Event('change'))
  }
  if (data.questionType) F.type.value = data.questionType
  if (data.errorReason) F.error.value = data.errorReason
  if (data.knowledgePoints?.length) F.knowledge.value = data.knowledgePoints.join(', ')
  if (data.source) F.source.value = data.source
  if (data.myAnswer) F.myAnswer.value = data.myAnswer
  if (data.correctAnswer) F.correct.value = data.correctAnswer
  if (data.solution) F.solution.value = data.solution
}

function clearForm() {
  Object.values(F).forEach(el => {
    if (el && el.tagName === 'SELECT') el.value = ''
    else if (el) el.value = ''
  })
  F.type.innerHTML = '<option value="">请选择</option>'
  syncStatus.classList.add('hidden')
  syncStatus.onclick = null
  syncStatus.style.cursor = 'default'
  syncStatus.style.textDecoration = 'none'
}

// ===== 同步 =====
syncBtn.addEventListener('click', async () => {
  const payload = {
    module: F.module.value,
    questionType: F.type.value,
    errorReason: F.error.value,
    knowledgePoints: F.knowledge.value ? F.knowledge.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    source: F.source.value,
    myAnswer: F.myAnswer.value,
    correctAnswer: F.correct.value,
    solution: F.solution.value,
    imageUrl: currentImageBase64,
  }

  if (!payload.module) { showToast('请选择模块'); return }

  syncBtn.disabled = true
  syncBtn.textContent = '⏳ 同步中...'
  syncStatus.classList.remove('hidden')
  syncStatus.textContent = '正在写入 Notion...'
  syncStatus.className = 'text-center text-sm mt-2 text-gray-500'

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '同步失败')

    syncStatus.textContent = '✅ 同步成功！点此在 Notion 中查看'
    syncStatus.className = 'text-center text-sm mt-2 text-green-600 font-medium'
    syncStatus.onclick = () => window.open(json.notionUrl, '_blank')
    syncStatus.style.cursor = 'pointer'
    syncStatus.style.textDecoration = 'underline'
    showToast('🎉 同步成功！')
  } catch (err) {
    syncStatus.textContent = `❌ ${err.message}`
    syncStatus.className = 'text-center text-sm mt-2 text-red-500'
  } finally {
    syncBtn.disabled = false
    syncBtn.textContent = '📥 同步到 Notion'
  }
})

function showToast(msg) {
  const t = document.createElement('div')
  t.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg z-50 fade-in'
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2500)
}
