/* ============================================================
   editor.js — 本地内容编辑器（CRUD + 导入导出）
   TODO: 后续替换为正式后端管理端
   ============================================================ */

let activeTab = 'questionnaire';
let currentEditIndex = -1;
let isNewItem = false;

/* ===================== Tab-aware Field Helpers ===================== */
/* 问卷表单使用 _q 前缀，游戏表单使用 _s 前缀 */
function dimId(field) {
  const prefix = activeTab === 'questionnaire' ? 'edit_q_' : 'edit_s_';
  return prefix + field;
}
function optFormId() { return 'optionsForm_' + (activeTab === 'questionnaire' ? 'q' : 's'); }
function optEditDiv() { return 'optionEditor_' + (activeTab === 'questionnaire' ? 'q' : 's'); }
function optScoreId() { return 'opt_score_' + (activeTab === 'questionnaire' ? 'q' : 's'); }

/* ===================== 数据持久化 ===================== */
function loadDataFromStorage() {
  const qData = localStorage.getItem('editor_questionnaire_items');
  if (qData) {
    try { questionnaireItems = JSON.parse(qData); } catch (e) { /* ignore */ }
  }
  const sData = localStorage.getItem('editor_game_scenes');
  if (sData) {
    try { gameScenes = JSON.parse(sData); } catch (e) { /* ignore */ }
  }
}

function saveDataToStorage() {
  localStorage.setItem('editor_questionnaire_items', JSON.stringify(questionnaireItems));
  localStorage.setItem('editor_game_scenes', JSON.stringify(gameScenes));
}

/* ===================== 初始化 ===================== */
function initEditor() {
  loadDataFromStorage();
  renderList();
  renderDimensionDropdown();
  switchTab('questionnaire');
}

/* ===================== Tab 切换 ===================== */
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.editor-tab').forEach(el => el.classList.remove('active'));
  document.querySelector('.editor-tab[data-tab="' + tab + '"]').classList.add('active');
  currentEditIndex = -1;
  isNewItem = false;
  renderList();
  clearForm();
}

/* ===================== 列表渲染 ===================== */
function renderList() {
  const panel = document.getElementById('listPanel');
  if (!panel) return;
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const idKey = activeTab === 'questionnaire' ? 'question_id' : 'scene_id';
  const titleKey = activeTab === 'questionnaire' ? 'question_text' : 'scene_title';

  let html = '<div class="list-header">';
  html += '<span class="list-count">共 ' + items.length + ' 项</span>';
  html += '<button class="btn btn-primary btn-sm" onclick="addNew()">+ 新增</button>';
  html += '</div>';
  html += '<div class="list-items">';

  items.forEach((item, i) => {
    const active = i === currentEditIndex ? 'list-item-active' : '';
    const id = item[idKey];
    const label = item[titleKey];
    const shortLabel = label.length > 30 ? label.substring(0, 30) + '…' : label;
    html += '<div class="list-item ' + active + '">';
    html += '<div class="list-item-content" onclick="selectItem(' + i + ')">';
    html += '<div class="list-item-id">' + id + '</div>';
    html += '<div class="list-item-label">' + shortLabel + '</div>';
    html += '</div>';
    html += '<button class="btn-icon list-item-copy" onclick="copyItem(' + i + ')" title="复制">⧉</button>';
    html += '</div>';
  });

  if (items.length === 0) {
    html += '<div class="list-empty">暂无数据，点击"+ 新增"创建</div>';
  }

  html += '</div>';
  panel.innerHTML = html;
}

/* ===================== 选择项目 ===================== */
function selectItem(index) {
  currentEditIndex = index;
  isNewItem = false;
  renderList();
  populateForm(index);
}

/* ===================== 复制项目 ===================== */
function copyItem(index) {
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const source = items[index];
  if (!source) return;

  const copy = JSON.parse(JSON.stringify(source));

  if (activeTab === 'questionnaire') {
    const maxNum = items.reduce(function (max, q) {
      const n = parseInt(q.question_id.replace('q_', ''));
      return n > max ? n : max;
    }, 0);
    copy.question_id = 'q_' + String(maxNum + 1).padStart(3, '0');
    // 复制选项的 option_id 也更新
    if (copy.options) {
      copy.options.forEach(function (opt, i) {
        const letter = String.fromCharCode(97 + i);
        opt.option_id = copy.question_id + '_' + letter;
      });
    }
  } else {
    const maxNum = items.reduce(function (max, g) {
      const n = parseInt(g.scene_id.replace('scene_', ''));
      return n > max ? n : max;
    }, 0);
    copy.scene_id = 'scene_' + String(maxNum + 1).padStart(3, '0');
    copy.scene_order = items.length + 1;
  }

  // 插入到原项后面
  items.splice(index + 1, 0, copy);
  currentEditIndex = index + 1;
  isNewItem = false;
  saveDataToStorage();
  renderList();
  populateForm(currentEditIndex);
  showToast('已复制');
}

/* ===================== 新增 ===================== */
function addNew() {
  currentEditIndex = -1;
  isNewItem = true;
  renderList();
  clearForm();

  if (activeTab === 'questionnaire') {
    const maxNum = questionnaireItems.reduce((max, q) => {
      const n = parseInt(q.question_id.replace('q_', ''));
      return n > max ? n : max;
    }, 0);
    document.getElementById('edit_question_id').value = 'q_' + String(maxNum + 1).padStart(3, '0');
    document.getElementById('edit_page').value = 1;
  } else {
    const maxNum = gameScenes.reduce((max, g) => {
      const n = parseInt(g.scene_id.replace('scene_', ''));
      return n > max ? n : max;
    }, 0);
    document.getElementById('edit_scene_id').value = 'scene_' + String(maxNum + 1).padStart(3, '0');
    document.getElementById('edit_scene_order').value = gameScenes.length + 1;
  }

  showForm();
}

/* ===================== 填充表单 ===================== */
function populateForm(index) {
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const item = items[index];
  if (!item) return;

  if (activeTab === 'questionnaire') {
    document.getElementById('edit_question_id').value = item.question_id || '';
    document.getElementById('edit_question_text').value = item.question_text || '';
    document.getElementById('edit_question_type').value = item.question_type || 'likert';
    document.getElementById('edit_required').checked = item.required || false;
    document.getElementById('edit_reverse_q').checked = item.reverse_scored || false;
    document.getElementById('edit_scale_min').value = item.scale_min || 1;
    document.getElementById('edit_scale_max').value = item.scale_max || 5;
    document.getElementById('edit_page').value = item.page || 1;
    setDimensionFields(item);
    // text_input 类型隐藏选项区域
    var qType = item.question_type || 'likert';
    toggleOptionsVisibility(qType);
    renderOptionsForm(item.options || []);
  } else {
    document.getElementById('edit_scene_id').value = item.scene_id || '';
    document.getElementById('edit_scene_title').value = item.scene_title || '';
    document.getElementById('edit_scene_order').value = item.scene_order || 1;
    document.getElementById('edit_scene_text').value = item.scene_text || '';
    document.getElementById('edit_scene_question_text').value = item.question_text || '';
    document.getElementById('edit_reverse_s').checked = item.reverse_scored || false;
    document.getElementById('edit_bg_url').value = item.background_image_url || '';
    setDimensionFields(item);
    renderOptionsForm(item.options || []);
  }

  showForm();
}

/* ===================== 设置维度字段 ===================== */
function setDimensionFields(item) {
  const select = document.getElementById(dimId('dimension'));
  if (select) {
    const matched = dimensionDefinitions.find(d => d.dimension_code === item.dimension_code);
    select.value = matched ? matched.dimension_code : '__custom__';
  }
  document.getElementById(dimId('dimension_name')).value = item.dimension_name || '';
  document.getElementById(dimId('dimension_code')).value = item.dimension_code || '';
  document.getElementById(dimId('parent_dimension')).value = item.parent_dimension || '';
  document.getElementById(dimId('parent_code')).value = item.parent_dimension_code || '';
  document.getElementById(dimId('facet_name')).value = item.facet_name || '';
  document.getElementById(dimId('facet_code')).value = item.facet_code || '';
}

/* ===================== 渲染维度下拉 ===================== */
function renderDimensionDropdown() {
  ['edit_q_dimension', 'edit_s_dimension'].forEach(function (selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    let html = '<option value="">— 选择维度 —</option>';
    dimensionDefinitions.forEach(function (d) {
      html += '<option value="' + d.dimension_code + '">' + d.dimension_name + ' (' + d.dimension_code + ')</option>';
    });
    html += '<option value="__custom__">—— 自定义维度 ——</option>';
    select.innerHTML = html;

    const prefix = selectId === 'edit_q_dimension' ? 'edit_q_' : 'edit_s_';

    select.addEventListener('change', function () {
      if (this.value && this.value !== '__custom__') {
        const def = dimensionDefinitions.find(function (d) { return d.dimension_code === this.value; }.bind(this));
        if (def) {
          document.getElementById(prefix + 'dimension_name').value = def.dimension_name;
          document.getElementById(prefix + 'dimension_code').value = def.dimension_code;
          document.getElementById(prefix + 'parent_dimension').value = def.parent_dimension;
          document.getElementById(prefix + 'parent_code').value = def.parent_dimension_code;
          document.getElementById(prefix + 'facet_name').value = def.facet_name;
          document.getElementById(prefix + 'facet_code').value = def.facet_code;
        }
      }
    });
  });
}

/* ===================== 题型切换处理 ===================== */
function toggleOptionsVisibility(questionType) {
  var optionsSection = document.getElementById('optionsForm_q');
  var scaleSection = document.getElementById('scaleSection_q');
  if (!optionsSection) return;
  if (questionType === 'text_input') {
    optionsSection.style.display = 'none';
    if (scaleSection) scaleSection.style.display = 'none';
  } else {
    optionsSection.style.display = 'block';
    if (scaleSection) scaleSection.style.display = 'block';
  }
}

// 监听题型变更
document.addEventListener('DOMContentLoaded', function () {
  var qTypeSelect = document.getElementById('edit_question_type');
  if (qTypeSelect) {
    qTypeSelect.addEventListener('change', function () {
      toggleOptionsVisibility(this.value);
    });
  }
});

/* ===================== 选项子表单 ===================== */
let optionEditIndex = -1;

function renderOptionsForm(options) {
  const suf = activeTab === 'questionnaire' ? 'q' : 's';
  const container = document.getElementById(optFormId());
  if (!container) return;

  const isQ = activeTab === 'questionnaire';
  let html = '<div class="options-header">';
  html += '<span class="options-title">选项列表</span>';
  html += '<button class="btn btn-sm btn-secondary" onclick="addOption()">+ 添加选项</button>';
  html += '</div>';

  if (options.length === 0) {
    html += '<div class="list-empty">暂无选项</div>';
  } else {
    html += '<div class="options-list">';
    options.forEach(function (opt, i) {
      html += '<div class="option-item' + (i === optionEditIndex ? ' option-editing' : '') + '">';
      if (isQ) {
        html += '<span class="option-preview">[' + opt.option_id + '] ' + opt.option_text + ' (score: ' + opt.score + ')</span>';
      } else {
        html += '<span class="option-preview">[' + opt.option_label + '] ' + opt.option_text + ' (score: ' + opt.score + ')</span>';
      }
      html += '<div class="option-actions">';
      html += '<button class="btn-icon" onclick="editOption(' + i + ')" title="编辑">✎</button>';
      html += '<button class="btn-icon btn-icon-danger" onclick="removeOption(' + i + ')" title="删除">✕</button>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  html += '<div class="option-editor" id="optionEditor_' + suf + '" style="display:none;">';
  html += '<div class="option-editor-title">编辑选项</div>';
  if (isQ) {
    html += '<label>option_id: <input id="opt_q_id" class="input-sm"></label>';
    html += '<label>option_text: <input id="opt_q_text" class="input-sm"></label>';
  } else {
    html += '<label>option_label: <input id="opt_s_label" class="input-sm"></label>';
    html += '<label>option_text: <input id="opt_s_text" class="input-sm"></label>';
  }
  html += '<label>score: <input id="' + optScoreId() + '" type="number" class="input-sm"></label>';
  html += '<div class="option-editor-btns">';
  html += '<button class="btn btn-sm btn-secondary" onclick="cancelOptionEdit()">取消</button>';
  html += '<button class="btn btn-sm btn-primary" onclick="confirmOption()">确认</button>';
  html += '</div></div>';

  container.innerHTML = html;
}

function addOption() {
  optionEditIndex = -1;
  const suf = activeTab === 'questionnaire' ? 'q' : 's';
  const editor = document.getElementById('optionEditor_' + suf);
  if (editor) editor.style.display = 'block';

  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const currentItem = isNewItem ? null : (items[currentEditIndex] || null);
  const opts = currentItem ? currentItem.options : [];

  if (activeTab === 'questionnaire') {
    const nextLetter = String.fromCharCode(97 + opts.length);
    const qId = document.getElementById('edit_question_id').value || 'q_xxx';
    document.getElementById('opt_q_id').value = qId + '_' + nextLetter;
    document.getElementById('opt_q_text').value = '';
  } else {
    const nextLabel = String.fromCharCode(65 + opts.length);
    document.getElementById('opt_s_label').value = nextLabel;
    document.getElementById('opt_s_text').value = '';
  }
  document.getElementById(optScoreId()).value = opts.length + 1;
}

function editOption(index) {
  optionEditIndex = index;
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const currentItem = isNewItem ? null : (items[currentEditIndex] || null);
  if (!currentItem) return;
  const opt = currentItem.options[index];
  if (!opt) return;

  const suf = activeTab === 'questionnaire' ? 'q' : 's';
  const editor = document.getElementById('optionEditor_' + suf);
  if (editor) editor.style.display = 'block';

  if (activeTab === 'questionnaire') {
    document.getElementById('opt_q_id').value = opt.option_id || '';
    document.getElementById('opt_q_text').value = opt.option_text || '';
  } else {
    document.getElementById('opt_s_label').value = opt.option_label || '';
    document.getElementById('opt_s_text').value = opt.option_text || '';
  }
  document.getElementById(optScoreId()).value = opt.score || 0;
}

function cancelOptionEdit() {
  optionEditIndex = -1;
  ['optionEditor_q', 'optionEditor_s'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function confirmOption() {
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const currentItem = isNewItem ? null : (items[currentEditIndex] || null);
  if (!currentItem) return;

  const newOpt = {};
  if (activeTab === 'questionnaire') {
    newOpt.option_id = document.getElementById('opt_q_id').value;
    newOpt.option_text = document.getElementById('opt_q_text').value;
  } else {
    newOpt.option_label = document.getElementById('opt_s_label').value;
    newOpt.option_text = document.getElementById('opt_s_text').value;
  }
  newOpt.score = parseInt(document.getElementById(optScoreId()).value) || 0;

  if (optionEditIndex >= 0) {
    currentItem.options[optionEditIndex] = newOpt;
  } else {
    currentItem.options.push(newOpt);
  }

  optionEditIndex = -1;
  renderOptionsForm(currentItem.options);
  saveDataToStorage();
}

function removeOption(index) {
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  const currentItem = isNewItem ? null : (items[currentEditIndex] || null);
  if (!currentItem) return;
  if (!confirm('确定删除该选项？')) return;
  currentItem.options.splice(index, 1);
  renderOptionsForm(currentItem.options);
  saveDataToStorage();
}

/* ===================== 保存 ===================== */
function saveItem() {
  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;

  let data;
  if (activeTab === 'questionnaire') {
    data = {
      question_id: document.getElementById('edit_question_id').value,
      question_text: document.getElementById('edit_question_text').value,
      question_type: document.getElementById('edit_question_type').value,
      required: document.getElementById('edit_required').checked,
      reverse_scored: document.getElementById('edit_reverse_q').checked,
      scale_min: parseInt(document.getElementById('edit_scale_min').value) || 1,
      scale_max: parseInt(document.getElementById('edit_scale_max').value) || 5,
      page: parseInt(document.getElementById('edit_page').value) || 1,
      dimension_name: document.getElementById(dimId('dimension_name')).value,
      dimension_code: document.getElementById(dimId('dimension_code')).value,
      parent_dimension: document.getElementById(dimId('parent_dimension')).value,
      parent_dimension_code: document.getElementById(dimId('parent_code')).value,
      facet_name: document.getElementById(dimId('facet_name')).value,
      facet_code: document.getElementById(dimId('facet_code')).value,
      options: []
    };
  } else {
    data = {
      scene_id: document.getElementById('edit_scene_id').value,
      scene_title: document.getElementById('edit_scene_title').value,
      scene_order: parseInt(document.getElementById('edit_scene_order').value) || 1,
      scene_text: document.getElementById('edit_scene_text').value,
      question_text: document.getElementById('edit_scene_question_text').value,
      reverse_scored: document.getElementById('edit_reverse_s').checked,
      background_image_url: document.getElementById('edit_bg_url').value,
      dimension_name: document.getElementById(dimId('dimension_name')).value,
      dimension_code: document.getElementById(dimId('dimension_code')).value,
      parent_dimension: document.getElementById(dimId('parent_dimension')).value,
      parent_dimension_code: document.getElementById(dimId('parent_code')).value,
      facet_name: document.getElementById(dimId('facet_name')).value,
      facet_code: document.getElementById(dimId('facet_code')).value,
      options: []
    };
  }

  // 验证必填
  if (!data.question_id && !data.scene_id) {
    alert('请填写 ID');
    return;
  }
  if (activeTab === 'questionnaire' && !data.question_text) {
    alert('请填写题目文本');
    return;
  }

  // 复制选项
  const currentItem = isNewItem ? null : (items[currentEditIndex] || null);
  if (currentItem && currentItem.options) {
    data.options = JSON.parse(JSON.stringify(currentItem.options));
  }

  if (isNewItem) {
    items.push(data);
  } else if (currentEditIndex >= 0) {
    items[currentEditIndex] = data;
  }

  currentEditIndex = items.indexOf(data);
  isNewItem = false;
  saveDataToStorage();
  renderList();
  populateForm(currentEditIndex);
  showToast('已保存');
}

/* ===================== 删除 ===================== */
function deleteItem() {
  if (currentEditIndex < 0) return;
  if (!confirm('确定删除此项？此操作不可撤销。')) return;

  const items = activeTab === 'questionnaire' ? questionnaireItems : gameScenes;
  items.splice(currentEditIndex, 1);
  currentEditIndex = -1;
  isNewItem = false;
  saveDataToStorage();
  renderList();
  clearForm();
  showToast('已删除');
}

/* ===================== 表单显示 ===================== */
function showForm() {
  document.getElementById('questionnaireForm').style.display = activeTab === 'questionnaire' ? 'block' : 'none';
  document.getElementById('gameForm').style.display = activeTab === 'game' ? 'block' : 'none';
  const show = currentEditIndex >= 0 ? 'inline-block' : 'none';
  document.getElementById('deleteBtn_q').style.display = show;
  document.getElementById('deleteBtn_s').style.display = show;
}

function clearForm() {
  document.getElementById('questionnaireForm').style.display = 'none';
  document.getElementById('gameForm').style.display = 'none';
  document.getElementById('deleteBtn_q').style.display = 'none';
  document.getElementById('deleteBtn_s').style.display = 'none';
  ['optionEditor_q', 'optionEditor_s'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/* ===================== 导出 JSON ===================== */
function exportJSON() {
  const data = {
    exported_at: new Date().toISOString(),
    questionnaire_items: questionnaireItems,
    game_scenes: gameScenes,
    dimension_definitions: dimensionDefinitions
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '问卷剧情数据_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 JSON');
}

/* ===================== 导入 JSON ===================== */
function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.questionnaire_items && Array.isArray(data.questionnaire_items)) {
          questionnaireItems.length = 0;
          data.questionnaire_items.forEach(function (item) { questionnaireItems.push(item); });
        }
        if (data.game_scenes && Array.isArray(data.game_scenes)) {
          gameScenes.length = 0;
          data.game_scenes.forEach(function (scene) { gameScenes.push(scene); });
        }
        saveDataToStorage();
        renderList();
        clearForm();
        showToast('已导入 ' + file.name);
      } catch (err) {
        alert('导入失败：JSON 格式不正确\n' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ===================== 重置 ===================== */
function resetData() {
  if (!confirm('确定恢复默认数据？所有编辑内容将丢失。')) return;
  localStorage.removeItem('editor_questionnaire_items');
  localStorage.removeItem('editor_game_scenes');
  location.reload();
}

/* ===================== Toast 提示 ===================== */
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'editor-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () {
    toast.classList.remove('show');
  }, 2000);
}

/* ===================== 页面初始化 ===================== */
document.addEventListener('DOMContentLoaded', function () {
  initEditor();
});
