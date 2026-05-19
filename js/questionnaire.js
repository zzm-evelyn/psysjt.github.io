/* ============================================================
   questionnaire.js — 问卷页面逻辑（分页 + Likert + text_input + 提交流程）
   ============================================================ */

let currentPageIndex = 0;     // 当前页索引
let pageGroups = [];          // 按 page 分组的页面列表 [[item, ...], ...]
let currentSelections = {};   // {question_id: {optionId, value, rawScore}} 或 {question_id: {text: '...'}}

async function loadQuestionnaireItemsFromApi() {
  try {
    const remoteItems = await apiGet('/questionnaire');
    if (Array.isArray(remoteItems) && remoteItems.length > 0) {
      questionnaireItems = remoteItems.map(function (item, idx) {
        var displayOrder = item.display_order || idx + 1;
        return {
          question_id: item.question_id || '',
          question_text: item.question_text || '',
          question_type: item.question_type || 'likert',
          required: item.required !== false,
          page: item.page || Math.ceil(displayOrder / 5),
          display_order: displayOrder,
          scale_min: item.scale_min || 1,
          scale_max: item.scale_max || 5,
          options: (item.options || []).map(function (opt, optIdx) {
            return {
              option_id: opt.option_id || String(optIdx + 1),
              option_text: opt.option_text || '',
              score: opt.score
            };
          })
        };
      });
      console.log('[questionnaire] 已从后端加载问卷题目:', questionnaireItems.length);
    }
  } catch (e) {
    console.warn('[questionnaire] 后端问卷加载失败，使用本地备用数据:', e.message);
  }
}

function showQuestionnaireLoadError(message) {
  var intro = document.getElementById('questionnaireIntro');
  if (!intro) return;
  intro.innerHTML = '<div class="error-message" style="display:block;">' + message + '</div>';
}

/* ---- 初始化 ---- */
async function initQuestionnaire() {
  markQuestionnaireStart();
  await loadQuestionnaireItemsFromApi();

  // 如果问卷已提交完成，直接显示完成区域（防止刷新后回到题目页）
  var alreadyCompleted = false;
  try {
    alreadyCompleted = JSON.parse(localStorage.getItem('questionnaire_completed')) === true;
  } catch (e) { /* ignore */ }
  if (alreadyCompleted) {
    document.getElementById('questionnaireIntro').style.display = 'none';
    document.getElementById('questionnaireBody').style.display = 'block';
    document.getElementById('questionArea').style.display = 'none';
    var navBtns = document.querySelector('.nav-buttons');
    if (navBtns) navBtns.style.display = 'none';
    var progContainer = document.querySelector('.progress-container');
    if (progContainer) progContainer.style.display = 'none';
    document.getElementById('questionNumber').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('completeArea').style.display = 'block';
    return;
  }

  // 构建分页
  buildPageGroups();
  if (!pageGroups.length) {
    showQuestionnaireLoadError('暂时没有可作答的问卷题目，请联系研究者检查后台配置。');
    return;
  }

  const startBtn = document.getElementById('startQuestionnaire');
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      this.style.display = 'none';
      document.getElementById('questionnaireIntro').style.display = 'none';
      document.getElementById('questionnaireBody').style.display = 'block';
      renderPage(0);
    });
    return;
  }
  renderPage(0);
}

/* ---- 按 page 字段分组 ---- */
function buildPageGroups() {
  const pageMap = {};
  (questionnaireItems || []).forEach(function (item) {
    var p = item.page || 1;
    if (!pageMap[p]) pageMap[p] = [];
    pageMap[p].push(item);
  });
  pageGroups = Object.keys(pageMap).sort(function (a, b) {
    return parseInt(a) - parseInt(b);
  }).map(function (key) {
    return pageMap[key].sort(function (a, b) {
      return (a.display_order || 0) - (b.display_order || 0);
    });
  });
}

/* ---- 渲染指定页 ---- */
function renderPage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= pageGroups.length) return;
  currentPageIndex = pageIndex;
  var items = pageGroups[pageIndex];

  // 进度条 — 显示 当前页码 / 总页数
  var progressFill = document.getElementById('progressFill');
  var progressText = document.getElementById('progressText');
  if (progressFill) {
    progressFill.style.width = (((pageIndex + 1) / pageGroups.length) * 100) + '%';
  }
  if (progressText) {
    progressText.textContent = '第 ' + (pageIndex + 1) + ' 页 / 共 ' + pageGroups.length + ' 页';
  }

  // 题号信息
  var qNum = document.getElementById('questionNumber');
  if (qNum) {
    var totalQ = questionnaireItems.length;
    var startIdx = 0;
    for (var i = 0; i < pageIndex; i++) {
      startIdx += pageGroups[i].length;
    }
    qNum.textContent = '第 ' + (startIdx + 1) + '–' + (startIdx + items.length) + ' 题（共 ' + totalQ + ' 题）';
  }

  // 渲染所有题目
  var questionArea = document.getElementById('questionArea');
  if (!questionArea) return;
  questionArea.innerHTML = '';
  questionArea.style.animation = 'none';
  questionArea.offsetHeight;
  questionArea.style.animation = 'cardEntrance 0.4s ease-out';

  items.forEach(function (item, idx) {
    var qBlock = document.createElement('div');
    qBlock.className = 'question-block';
    qBlock.style.animation = 'cardEntrance 0.35s ease-out ' + (idx * 0.08) + 's both';

    // 题目标题
    var qText = document.createElement('div');
    qText.className = 'question-text';
    qText.textContent = item.question_text;
    qBlock.appendChild(qText);

    // 必答标记
    if (item.required) {
      var reqMark = document.createElement('span');
      reqMark.className = 'required-mark';
      reqMark.textContent = ' *必答';
      qText.appendChild(reqMark);
    }

    // 渲染对应控件
    if (item.question_type === 'text_input') {
      renderTextInput(qBlock, item);
    } else {
      renderLikertScale(qBlock, item);
    }

    questionArea.appendChild(qBlock);
  });

  // 更新导航按钮
  updateNavButtons();
}

/* ---- 渲染 Likert 水平量表 ---- */
function renderLikertScale(container, item) {
  var wrapper = document.createElement('div');
  wrapper.className = 'likert-wrapper';
  wrapper.dataset.questionId = item.question_id;

  var total = item.options.length;

  // 轨道 + 填充
  var track = document.createElement('div');
  track.className = 'likert-track';
  track.id = 'likertTrack_' + item.question_id;

  var fill = document.createElement('div');
  fill.className = 'likert-fill';
  fill.id = 'likertFill_' + item.question_id;
  track.appendChild(fill);
  wrapper.appendChild(track);

  // 选项圆点
  var optionsRow = document.createElement('div');
  optionsRow.className = 'likert-options-row';

  var savedResponse = JSON.parse(localStorage.getItem('questionnaire_responses') || '[]')
    .find(function (r) { return r.question_id === item.question_id; });

  item.options.forEach(function (opt, i) {
    var optDiv = document.createElement('div');
    optDiv.className = 'likert-option';

    var dot = document.createElement('button');
    dot.className = 'likert-dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', opt.option_text);

    var label = document.createElement('span');
    label.className = 'likert-label';
    label.textContent = opt.option_text;

    optDiv.appendChild(dot);
    optDiv.appendChild(label);

    optDiv.addEventListener('click', function (e) {
      e.stopPropagation();
      handleLikertSelect(item.question_id, opt.option_id, i + 1, item.options.length);
    });

    optDiv.style.animation = 'cardEntrance 0.35s ease-out ' + (i * 0.06) + 's both';

    optionsRow.appendChild(optDiv);

    // 恢复已选状态
    if (savedResponse && savedResponse.selected_option_id === opt.option_id) {
      handleLikertSelect(item.question_id, opt.option_id, i + 1, item.options.length);
    }
  });

  wrapper.appendChild(optionsRow);
  container.appendChild(wrapper);
}

/* ---- 处理 Likert 选择 ---- */
function handleLikertSelect(questionId, optionId, value, totalOptions) {
  // 保存到当前选择
  currentSelections[questionId] = {
    optionId: optionId,
    value: value,
    rawScore: value  // Likert 中 score 与序号一致（实际在产品中有 mapping）
  };

  // 视觉更新 — 在本 wrapper 内查找
  var wrapper = document.querySelector('.likert-wrapper[data-question-id="' + questionId + '"]');
  if (!wrapper) return;

  var dots = wrapper.querySelectorAll('.likert-option');
  var selectedEl = null;

  dots.forEach(function (opt, idx) {
    var dot = opt.querySelector('.likert-dot');
    var label = opt.querySelector('.likert-label');
    var isSelected = (idx + 1) <= value;

    if (isSelected) {
      dot.classList.add('filled');
      label.classList.add('active');
      if (idx + 1 === value) {
        selectedEl = dot;
      }
    } else {
      dot.classList.remove('filled');
      label.classList.remove('active');
    }
  });

  // 反弹效果
  if (selectedEl) {
    selectedEl.style.transition = 'none';
    selectedEl.style.transform = 'scale(1.3)';
    selectedEl.offsetHeight;
    selectedEl.style.transition = '';
    selectedEl.style.transform = '';
  }

  // 更新连接线
  updateLikertFill(questionId, value, totalOptions);

  // 隐藏错误
  var errContainer = wrapper.closest('.question-block').querySelector('.q-error');
  if (errContainer) errContainer.style.display = 'none';
}

/* ---- 更新 Likert 连接线填充 ---- */
function updateLikertFill(questionId, value, totalOptions) {
  var wrapper = document.querySelector('.likert-wrapper[data-question-id="' + questionId + '"]');
  if (!wrapper) return;
  var trackFill = wrapper.querySelector('.likert-fill');
  var track = wrapper.querySelector('.likert-track');
  var dots = wrapper.querySelectorAll('.likert-dot');
  if (!trackFill || !track || dots.length < 2) return;

  var trackRect = track.getBoundingClientRect();
  var firstDot = dots[0].getBoundingClientRect();
  var lastDot = dots[dots.length - 1].getBoundingClientRect();

  var startX = firstDot.left + firstDot.width / 2;
  var endX = lastDot.left + lastDot.width / 2;
  var totalWidth = endX - startX;

  if (totalWidth <= 0) return;

  var ratio = (value - 1) / (totalOptions - 1);
  var fillEndX = startX + totalWidth * ratio;
  var fillPct = ((fillEndX - trackRect.left) / trackRect.width) * 100;

  trackFill.style.width = Math.min(Math.max(fillPct, 0), 100) + '%';
}

/* ---- 渲染 text_input 文本框 ---- */
function renderTextInput(container, item) {
  var wrapper = document.createElement('div');
  wrapper.className = 'text-input-wrapper';
  wrapper.dataset.questionId = item.question_id;

  var textarea = document.createElement('textarea');
  textarea.className = 'question-textarea';
  textarea.rows = 3;
  textarea.placeholder = '请输入您的回答...';
  textarea.id = 'textarea_' + item.question_id;

  // 恢复已保存的文本
  var savedResponse = JSON.parse(localStorage.getItem('questionnaire_responses') || '[]')
    .find(function (r) { return r.question_id === item.question_id; });
  if (savedResponse && savedResponse.raw_answer_text) {
    textarea.value = savedResponse.raw_answer_text;
    currentSelections[item.question_id] = { text: savedResponse.raw_answer_text };
  }

  // 输入时自动保存
  textarea.addEventListener('input', function () {
    currentSelections[item.question_id] = { text: this.value };
    // 隐藏错误
    var errEl = container.querySelector('.q-error');
    if (errEl) errEl.style.display = 'none';
  });

  wrapper.appendChild(textarea);
  container.appendChild(wrapper);
}

/* ---- 导航按钮 ---- */
function updateNavButtons() {
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var submitArea = document.getElementById('submitArea');
  var completeArea = document.getElementById('completeArea');

  // 隐藏提交和完成区域
  if (submitArea) submitArea.style.display = 'none';
  if (completeArea) completeArea.style.display = 'none';

  if (prevBtn) {
    prevBtn.style.display = currentPageIndex === 0 ? 'none' : 'inline-block';
  }
  if (nextBtn) {
    if (currentPageIndex === pageGroups.length - 1) {
      // 最后一页 → 显示"完成作答"
      nextBtn.textContent = '完成作答';
      nextBtn.style.display = 'inline-block';
    } else {
      nextBtn.textContent = '下一页';
      nextBtn.style.display = 'inline-block';
    }
  }
}

/* ---- 上一页 ---- */
function goToPrev() {
  if (currentPageIndex > 0) {
    // 保存当前页答案再翻页
    saveCurrentPageResponses();
    renderPage(currentPageIndex - 1);
  }
}

/* ---- 下一页 / 完成作答 ---- */
async function goToNext() {
  var items = pageGroups[currentPageIndex];

  // 验证当前页所有必答题
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.required) {
      var sel = currentSelections[item.question_id];
      if (!sel) {
        showPageError(item.question_id, '请先完成本题');
        return;
      }
      if (item.question_type === 'text_input' && (!sel.text || !sel.text.trim())) {
        showPageError(item.question_id, '请填写回答');
        return;
      }
      if (item.question_type !== 'text_input' && !sel.optionId) {
        showPageError(item.question_id, '请先完成本题');
        return;
      }
    }
  }

  // 保存当前页所有答案到 localStorage，并等待后端确认
  try {
    await saveCurrentPageResponses();
  } catch (e) {
    console.error('[questionnaire] 保存作答失败:', e);
    var err = document.getElementById('errorMessage');
    if (err) {
      err.textContent = '保存失败：' + e.message + '。请检查网络后重试。';
      err.style.display = 'block';
    }
    return;
  }

  // 如果是最后一页 → 显示提交确认
  if (currentPageIndex === pageGroups.length - 1) {
    // 注意：不能隐藏 questionnaireBody（submitArea / completeArea 都在其内部）
    // 改为隐藏题目渲染区和导航按钮
    document.getElementById('questionArea').style.display = 'none';
    var navBtns = document.querySelector('.nav-buttons');
    if (navBtns) navBtns.style.display = 'none';
    var progContainer = document.querySelector('.progress-container');
    if (progContainer) progContainer.style.display = 'none';
    document.getElementById('questionNumber').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('submitArea').style.display = 'block';
    document.getElementById('submitArea').style.animation = 'cardEntrance 0.5s ease-out';
    return;
  }

  // 下一页
  renderPage(currentPageIndex + 1);
}

/* ---- 保存当前页所有回答 ---- */
async function saveCurrentPageResponses() {
  var items = pageGroups[currentPageIndex];
  var participantId = JSON.parse(localStorage.getItem('participant_id'));

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var sel = currentSelections[item.question_id];
    if (!sel) continue;

    var responseData = {
      participant_id: participantId,
      question_id: item.question_id,
      question_type: item.question_type,
      dimension_name: item.dimension_name,
      dimension_code: item.dimension_code,
      parent_dimension: item.parent_dimension,
      parent_dimension_code: item.parent_dimension_code,
      facet_name: item.facet_name,
      facet_code: item.facet_code,
      answered_at: new Date().toISOString()
    };

    if (item.question_type === 'text_input') {
      responseData.raw_answer_text = sel.text || '';
      responseData.raw_score = 0;
      responseData.final_score = null;
      responseData.selected_option_id = '';
      responseData.selected_option_text = '';
    } else {
      var selectedOption = item.options.find(function (o) { return o.option_id === sel.optionId; });
      responseData.selected_option_id = sel.optionId;
      responseData.selected_option_text = selectedOption ? selectedOption.option_text : '';
      responseData.raw_score = selectedOption && selectedOption.score !== undefined ? selectedOption.score : sel.rawScore;
      responseData.final_score = 0;
    }

    await saveQuestionnaireResponse(responseData);
  }
}

/* ---- 提交问卷 ---- */
async function handleSubmit() {
  var submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
  }

  try {
    await completeQuestionnaire();
  } catch (e) {
    console.error('[questionnaire] 提交问卷出错:', e);
    var err = document.getElementById('errorMessage');
    if (err) {
      err.textContent = '提交失败：' + e.message + '。请检查网络后重试。';
      err.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '重新提交问卷';
    }
    return;
  }

  // 隐藏提交区，显示完成区
  document.getElementById('submitArea').style.display = 'none';
  var completeArea = document.getElementById('completeArea');
  if (completeArea) {
    completeArea.style.display = 'block';
    completeArea.style.animation = 'cardEntrance 0.5s ease-out';
  }

  if (submitBtn) {
    submitBtn.textContent = '已提交';
  }
}

/* ---- 显示页面级错误 ---- */
function showPageError(questionId, message) {
  // 找到对应题目的错误容器
  var qBlock = document.querySelector('.question-block').closest ? null : null;
  // 在 questionArea 中查找对应的 .question-block
  var blocks = document.querySelectorAll('.question-block');
  var targetBlock = null;
  blocks.forEach(function (b) {
    var qText = b.querySelector('.question-text');
    if (qText && qText.textContent.indexOf('必答') > -1) {
      // 查找关联的正确 block
    }
  });

  // 通用的错误提示方式 — 在页面顶部显示
  var err = document.getElementById('errorMessage');
  if (err) {
    err.textContent = '⚠️ ' + message;
    err.style.display = 'block';
    err.style.animation = 'none';
    err.offsetHeight;
    err.style.animation = 'shake 0.4s ease-out';
  }

  // 高亮未答的必答题
  blocks.forEach(function (b) {
    var qTextEl = b.querySelector('.question-text');
    if (qTextEl && qTextEl.textContent.indexOf(message) > -1) {
      b.style.border = '2px solid #e74c3c';
      b.style.animation = 'shake 0.4s ease-out';
      setTimeout(function () { b.style.border = ''; }, 1500);
    }
  });
}

/* ---- shake 动画（动态注入一次） ---- */
(function injectShake() {
  if (document.getElementById('_shakeStyle')) return;
  var s = document.createElement('style');
  s.id = '_shakeStyle';
  s.textContent = '@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }';
  document.head.appendChild(s);
})();

/* ---- 页面初始化 ---- */
document.addEventListener('DOMContentLoaded', async function () {
  if (!localStorage.getItem('participant_id')) {
    await startParticipantSession();
  }
  await initQuestionnaire();
});
