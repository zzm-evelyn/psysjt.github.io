/* ============================================================
   questionnaire.js — 问卷页面逻辑（水平视觉 Likert 量表）
   ============================================================ */

let currentQuestionIndex = 0;
let currentSelection = null;

/* ---- 初始化 ---- */
function initQuestionnaire() {
  markQuestionnaireStart();

  const startBtn = document.getElementById('startQuestionnaire');
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      this.style.display = 'none';
      document.getElementById('questionnaireIntro').style.display = 'none';
      document.getElementById('questionnaireBody').style.display = 'block';
      renderQuestion(0);
    });
    return;
  }
  renderQuestion(0);
}

/* ---- 渲染题目 ---- */
function renderQuestion(index) {
  const items = questionnaireItems;
  if (index < 0 || index >= items.length) return;

  currentQuestionIndex = index;
  const item = items[index];

  // 进度条
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  if (progressFill) {
    progressFill.style.width = (((index + 1) / items.length) * 100) + '%';
  }
  if (progressText) {
    progressText.textContent = (index + 1) + ' / ' + items.length;
  }

  // 题号
  const qNum = document.getElementById('questionNumber');
  if (qNum) qNum.textContent = '第 ' + (index + 1) + ' 题（共 ' + items.length + ' 题）';

  // 题目文本（带入场动画）
  const qText = document.getElementById('questionText');
  if (qText) {
    qText.style.animation = 'none';
    qText.offsetHeight; // reflow
    qText.textContent = item.question_text;
    qText.style.animation = 'cardEntrance 0.4s ease-out';
  }

  // 渲染 Likert 水平量表
  renderLikertScale(item);

  // 导航按钮
  updateNavButtons();

  // 隐藏错误
  const err = document.getElementById('errorMessage');
  if (err) err.style.display = 'none';
}

/* ---- 渲染 Likert 水平视觉量表 ---- */
function renderLikertScale(item) {
  const container = document.getElementById('likertOptions');
  if (!container) return;

  const total = item.options.length;
  currentSelection = null;

  // 检查已保存答案
  const savedResponse = JSON.parse(localStorage.getItem('questionnaire_responses') || '[]')
    .find(r => r.question_id === item.question_id);

  // 生成选项
  container.innerHTML = '';
  item.options.forEach((opt, i) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'likert-option';
    optionDiv.dataset.value = i + 1;
    optionDiv.dataset.optionId = opt.option_id;

    // 圆圈
    const dot = document.createElement('button');
    dot.className = 'likert-dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', opt.option_text);

    // 标签
    const label = document.createElement('span');
    label.className = 'likert-label';
    label.textContent = opt.option_text;

    optionDiv.appendChild(dot);
    optionDiv.appendChild(label);

    // 点击事件
    optionDiv.addEventListener('click', function (e) {
      e.stopPropagation();
      handleLikertSelect(opt.option_id, i + 1, item.options.length);
    });

    // 入场动画（错开）
    optionDiv.style.animation = 'cardEntrance 0.4s ease-out ' + (i * 0.07) + 's both';

    container.appendChild(optionDiv);

    // 恢复已选状态
    if (savedResponse && savedResponse.selected_option_id === opt.option_id) {
      handleLikertSelect(opt.option_id, i + 1, item.options.length);
    }
  });
}

/* ---- 处理 Likert 选择 ---- */
function handleLikertSelect(optionId, value, totalOptions) {
  currentSelection = optionId;

  const dots = document.querySelectorAll('.likert-option');
  let selectedEl = null;

  dots.forEach((opt, idx) => {
    const dot = opt.querySelector('.likert-dot');
    const label = opt.querySelector('.likert-label');
    const isSelected = (idx + 1) <= value;

    if (isSelected) {
      dot.classList.add('filled');
      label.classList.add('active');
      // 记录最后一个选中元素（用于反弹效果）
      if (idx + 1 === value) {
        selectedEl = dot;
      }
    } else {
      dot.classList.remove('filled');
      label.classList.remove('active');
    }
  });

  // 选中圆点反弹动画
  if (selectedEl) {
    selectedEl.style.transition = 'none';
    selectedEl.style.transform = 'scale(1.3)';
    selectedEl.offsetHeight;
    selectedEl.style.transition = '';
    selectedEl.style.transform = '';
  }

  // 更新连接线填充
  updateLikertFill(value, totalOptions);

  // 隐藏错误
  const err = document.getElementById('errorMessage');
  if (err) err.style.display = 'none';
}

/* ---- 更新 Likert 连接线填充 ---- */
function updateLikertFill(value, totalOptions) {
  const trackFill = document.getElementById('likertFill');
  const track = document.getElementById('likertTrack');
  const dots = document.querySelectorAll('.likert-dot');
  if (!trackFill || !track || dots.length < 2) return;

  // 像素精确计算填充宽度
  const trackRect = track.getBoundingClientRect();
  const firstDot = dots[0].getBoundingClientRect();
  const lastDot = dots[dots.length - 1].getBoundingClientRect();

  const startX = firstDot.left + firstDot.width / 2;
  const endX = lastDot.left + lastDot.width / 2;
  const totalWidth = endX - startX;

  if (totalWidth <= 0) return;

  const ratio = (value - 1) / (totalOptions - 1);
  const fillEndX = startX + totalWidth * ratio;
  const fillPct = ((fillEndX - trackRect.left) / trackRect.width) * 100;

  trackFill.style.width = Math.min(Math.max(fillPct, 0), 100) + '%';
}

/* ---- 导航按钮 ---- */
function updateNavButtons() {
  const items = questionnaireItems;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) {
    prevBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
  }
  if (nextBtn) {
    nextBtn.textContent = currentQuestionIndex === items.length - 1 ? '完成问卷' : '下一题';
  }
}

/* ---- 上一题 ---- */
function goToPrev() {
  if (currentQuestionIndex > 0) {
    renderQuestion(currentQuestionIndex - 1);
  }
}

/* ---- 下一题 / 完成 ---- */
function goToNext() {
  const items = questionnaireItems;
  const item = items[currentQuestionIndex];

  if (!currentSelection) {
    const err = document.getElementById('errorMessage');
    if (err) {
      err.style.display = 'block';
      err.style.animation = 'none';
      err.offsetHeight;
      err.style.animation = 'shake 0.4s ease-out';
    }
    return;
  }

  // 保存答案
  const selectedOption = item.options.find(o => o.option_id === currentSelection);
  const responseData = {
    participant_id: JSON.parse(localStorage.getItem('participant_id')),
    question_id: item.question_id,
    selected_option_id: currentSelection,
    selected_option_text: selectedOption ? selectedOption.option_text : '',
    raw_score: selectedOption ? selectedOption.score : 0,
    final_score: 0,
    dimension_name: item.dimension_name,
    dimension_code: item.dimension_code,
    parent_dimension: item.parent_dimension,
    parent_dimension_code: item.parent_dimension_code,
    facet_name: item.facet_name,
    facet_code: item.facet_code,
    answered_at: new Date().toISOString()
  };
  saveQuestionnaireResponse(responseData);

  // 最后一题 → 完成
  if (currentQuestionIndex === items.length - 1) {
    completeQuestionnaire();
    document.getElementById('nextBtn').style.display = 'none';
    document.getElementById('completeArea').style.display = 'block';
    document.getElementById('completeArea').style.animation = 'cardEntrance 0.5s ease-out';
    return;
  }

  renderQuestion(currentQuestionIndex + 1);
}

/* ---- shake 动画 ---- */
const styleShake = document.createElement('style');
styleShake.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(styleShake);

/* ---- 页面初始化 ---- */
document.addEventListener('DOMContentLoaded', function () {
  if (!localStorage.getItem('participant_id')) {
    startParticipantSession();
  }
  initQuestionnaire();
});
