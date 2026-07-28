// ===== 枚举值预设 =====
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

// ===== DOM 引用 =====
const modeToggle = document.getElementById('modeToggle')
const toggleLabel = document.getElementById('toggleLabel')
const aiSection = document.getElementById('aiSection')
const fileInput = document.getElementById('fileInput')
const uploadArea = document.getElementById('uploadArea')
const uploadPlaceholder = document.getElementById('uploadPlaceholder')
const uploadPreview = document.getElementById('uploadPreview')
const previewImage = document.getElementById('previewImage')
const changePhoto = document.getElementById('changePhoto')
const loadingState = document.getElementById('loadingState')
const resultArea = document.getElementById('resultArea')
const formTitle = document.getElementById('formTitle')
const errorMessage = document.getElementById('errorMessage')
const syncBtn = document.getElementById('syncBtn')
const syncStatus = document.getElementById('syncStatus')
const hintText = document.getElementById('hintText')

const fieldModule = document.getElementById('fieldModule')
const fieldType = document.getElementById('fieldType')
const fieldErrorReason = document.getElementById('fieldErrorReason')
const fieldKnowledge = document.getElementById('fieldKnowledge')
const fieldSource = document.getElementById('fieldSource')
const fieldQuestion = document.getElementById('fieldQuestion')
const fieldOptA = document.getElementById('fieldOptA')
const fieldOptB = document.getElementById('fieldOptB')
const fieldOptC = document.getElementById('fieldOptC')
const fieldOptD = document.getElementById('fieldOptD')
const fieldMyAnswer = document.getElementById('fieldMyAnswer')
const fieldCorrect = document.getElementById('fieldCorrect')
const fieldSolution = document.getElementById('fieldSolution')

let currentImageBase64 = null
let isManualMode = false

// ===== 初始化下拉框 =====
ENUMS.module.forEach((m) => {
  const opt = document.createElement('option')
  opt.value = m
  opt.textContent = m
  fieldModule.appendChild(opt)
})

fieldModule.addEventListener('change', () => {
  const module = fieldModule.value
  const types = ENUMS.questionType[module] || []
  fieldType.innerHTML = '<option value="">请选择</option>'
  types.forEach((t) => {
    const opt = document.createElement('option')
    opt.value = t
    opt.textContent = t
    fieldType.appendChild(opt)
  })
})

// ===== 模式切换 =====
modeToggle.addEventListener('click', () => {
  isManualMode = !isManualMode
  modeToggle.classList.toggle('active', isManualMode)
  toggleLabel.textContent = isManualMode ? '✏️ 手动' : '🤖 AI'

  if (isManualMode) {
    // 手动模式：隐藏上传区，清空表单，展示表单
    aiSection.classList.add('hidden')
    resultArea.classList.remove('hidden')
    formTitle.textContent = '✏️ 手动填写'
    hintText.textContent = '填写完整信息后同步到 Notion'
    clearForm()
    errorMessage.classList.add('hidden')
    syncStatus.classList.add('hidden')
  } else {
    // AI 模式：隐藏表单，展示上传区
    aiSection.classList.remove('hidden')
    resultArea.classList.add('hidden')
    formTitle.textContent = '📋 编辑内容'
    hintText.textContent = '拍照或选图后自动识别，确认后同步到 Notion'
    clearForm()
    errorMessage.classList.add('hidden')
    syncStatus.classList.add('hidden')
  }
})

// ===== 清空表单 =====
function clearForm() {
  fieldModule.value = ''
  fieldType.innerHTML = '<option value="">请选择</option>'
  fieldErrorReason.value = ''
  fieldKnowledge.value = ''
  fieldSource.value = ''
  fieldQuestion.value = ''
  fieldOptA.value = ''
  fieldOptB.value = ''
  fieldOptC.value = ''
  fieldOptD.value = ''
  fieldMyAnswer.value = ''
  fieldCorrect.value = ''
  fieldSolution.value = ''
  syncStatus.classList.add('hidden')
  syncStatus.onclick = null
  syncStatus.style.cursor = 'default'
  syncStatus.style.textDecoration = 'none'
}

// ===== 上传逻辑 =====
uploadArea.addEventListener('click', () => fileInput.click())

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadArea.classList.add('dragover')
})
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover')
})
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadArea.classList.remove('dragover')
  const file = e.dataTransfer.files[0]
  if (file) handleFile(file)
})

changePhoto.addEventListener('click', (e) => {
  e.stopPropagation()
  fileInput.click()
})

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0])
})

// ===== 处理图片 =====
function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('图片超过 20MB 限制')
    return
  }

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

// ===== 提交识别 =====
async function submitImage(base64) {
  loadingState.classList.remove('hidden')

  try {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })

    const json = await res.json()

    if (!json.success) {
      throw new Error(json.error || '识别失败')
    }

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

// ===== 填充识别结果 =====
function fillResult(data) {
  // 模块
  if (data.module && ENUMS.module.includes(data.module)) {
    fieldModule.value = data.module
    const event = new Event('change')
    fieldModule.dispatchEvent(event)
  }

  // 题型
  if (data.questionType) fieldType.value = data.questionType

  // 错误原因
  if (data.errorReason) fieldErrorReason.value = data.errorReason

  // 知识点
  if (data.knowledgePoints && data.knowledgePoints.length) {
    fieldKnowledge.value = data.knowledgePoints.join(', ')
  }

  // 来源
  if (data.source) fieldSource.value = data.source

  // 题目
  if (data.question) fieldQuestion.value = data.question

  // 选项
  if (data.options) {
    if (data.options.A) fieldOptA.value = data.options.A
    if (data.options.B) fieldOptB.value = data.options.B
    if (data.options.C) fieldOptC.value = data.options.C
    if (data.options.D) fieldOptD.value = data.options.D
  }

  // 答案
  if (data.myAnswer) fieldMyAnswer.value = data.myAnswer
  if (data.correctAnswer) fieldCorrect.value = data.correctAnswer

  // 解题思路
  if (data.solution) fieldSolution.value = data.solution
}

// ===== 同步到 Notion =====
syncBtn.addEventListener('click', async () => {
  const payload = {
    module: fieldModule.value,
    questionType: fieldType.value,
    errorReason: fieldErrorReason.value,
    knowledgePoints: fieldKnowledge.value
      ? fieldKnowledge.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
      : [],
    source: fieldSource.value,
    question: fieldQuestion.value,
    options: {},
    myAnswer: fieldMyAnswer.value,
    correctAnswer: fieldCorrect.value,
    solution: fieldSolution.value,
    imageUrl: currentImageBase64,
  }

  // 选项
  if (fieldOptA.value) payload.options.A = fieldOptA.value
  if (fieldOptB.value) payload.options.B = fieldOptB.value
  if (fieldOptC.value) payload.options.C = fieldOptC.value
  if (fieldOptD.value) payload.options.D = fieldOptD.value
  if (Object.keys(payload.options).length === 0) payload.options = null

  if (!payload.module) {
    showToast('请选择模块')
    return
  }

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

    if (!json.success) {
      throw new Error(json.error || '同步失败')
    }

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

// ===== Toast =====
function showToast(msg) {
  const toast = document.createElement('div')
  toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg z-50 fade-in'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2500)
}
