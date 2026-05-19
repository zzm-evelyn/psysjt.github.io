/* ============================================================
   admin.js — 研究管理端逻辑
   所有数据从后端 API 获取，不使用 localStorage 作为正式数据源
   ============================================================ */

let adminCurrentTab = 'overview';
let cachedDimensions = [];
let cachedQuestionnaireItems = [];
let cachedScenes = [];

// ============================================================
// 认证
// ============================================================

async function adminLogin() {
  const password = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!password) return;

  try {
    const result = await apiPost('/admin/login', { password: password });
    localStorage.setItem('admin_token', result.admin_token);
    showAdminApp();
    adminToast('登录成功');
  } catch (e) {
    errorEl.style.display = 'block';
    console.error('[admin] 登录失败:', e.message);
  }
}

function adminLogout() {
  localStorage.removeItem('admin_token');
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('adminPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
}

function showAdminApp() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  loadOverview();
  loadDimensions();
}

// ============================================================
// Tab 切换
// ============================================================

function switchAdminTab(tab) {
  adminCurrentTab = tab;

  // Nav
  document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
  const navBtns = document.querySelectorAll('.admin-nav-btn');
  const tabMap = { overview: 0, questionnaire: 1, scenes: 2, dimensions: 3, participants: 4, export: 5 };
  const idx = tabMap[tab];
  if (navBtns[idx]) navBtns[idx].classList.add('active');

  // Sections
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (section) section.classList.add('active');

  // Load data
  switch (tab) {
    case 'overview': loadOverview(); break;
    case 'questionnaire': loadQuestionnaire(); break;
    case 'scenes': loadScenes(); break;
    case 'dimensions': loadDimensions(); break;
    case 'participants': loadParticipants(); break;
    case 'export': initExport(); break;
  }
}

// ============================================================
// Overview
// ============================================================

async function loadOverview() {
  const container = document.getElementById('overviewStats');
  try {
    const data = await apiGet('/admin/overview');
    container.innerHTML = [
      '<div class="overview-stat"><div class="num">' + data.participant_count + '</div><div class="label">被试总数</div></div>',
      '<div class="overview-stat"><div class="num">' + data.completed_count + '</div><div class="label">完成人数</div></div>',
      '<div class="overview-stat"><div class="num">' + data.questionnaire_count + '</div><div class="label">问卷题数</div></div>',
      '<div class="overview-stat"><div class="num">' + data.game_scene_count + '</div><div class="label">剧情情景数</div></div>',
      '<div class="overview-stat"><div class="num">' + data.dimension_count + '</div><div class="label">维度数</div></div>'
    ].join('');
  } catch (e) {
    container.innerHTML = '<div style="color:#e74c3c;text-align:center;">加载失败: ' + e.message + '</div>';
  }
}

// ============================================================
// Dimensions
// ============================================================

async function loadDimensions() {
  try {
    const dims = await apiGet('/admin/dimensions');
    cachedDimensions = dims;
    renderDimensionTable(dims);
    populateDimensionDropdown('qf_dim_code', dims);
    populateDimensionDropdown('sf_dim_code', dims);
  } catch (e) {
    document.getElementById('dimTableBody').innerHTML = '<tr><td colspan="6" style="color:#e74c3c;">加载失败: ' + e.message + '</td></tr>';
  }
}

function renderDimensionTable(dims) {
  const tbody = document.getElementById('dimTableBody');
  tbody.innerHTML = dims.map(d => {
    const status = d.is_active ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
    return '<tr><td>' + esc(d.dimension_name) + '</td><td style="font-family:monospace;font-size:12px;color:#888;">' + esc(d.dimension_code) + '</td><td>' + esc(d.parent_dimension) + '</td><td>' + esc(d.facet_name) + ' (' + esc(d.facet_code) + ')</td><td>' + status + '</td><td><button class="admin-btn sm" onclick="showDimForm(\'' + esc(d.dimension_code) + '\')">编辑</button> <button class="admin-btn sm danger" onclick="adminDeactivateDim(\'' + esc(d.dimension_code) + '\')">停用</button></td></tr>';
  }).join('');
}

function populateDimensionDropdown(selectId, dims) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">-- 请选择维度 --</option>' +
    dims.filter(d => d.is_active !== false).map(d =>
      '<option value="' + esc(d.dimension_code) + '">' + esc(d.dimension_name) + ' (' + esc(d.dimension_code) + ')</option>'
    ).join('');
}

function adminFillDimensionFields(prefix, dimCode) {
  const dim = cachedDimensions.find(d => d.dimension_code === dimCode);
  if (!dim) {
    document.getElementById(prefix + 'dim_name').value = '';
    document.getElementById(prefix + 'dim_code_display').value = '';
    document.getElementById(prefix + 'parent_name').value = '';
    document.getElementById(prefix + 'parent_code').value = '';
    document.getElementById(prefix + 'facet_name').value = '';
    document.getElementById(prefix + 'facet_code').value = '';
    return;
  }
  document.getElementById(prefix + 'dim_name').value = dim.dimension_name || '';
  document.getElementById(prefix + 'dim_code_display').value = dim.dimension_code || '';
  document.getElementById(prefix + 'parent_name').value = dim.parent_dimension || '';
  document.getElementById(prefix + 'parent_code').value = dim.parent_dimension_code || '';
  document.getElementById(prefix + 'facet_name').value = dim.facet_name || '';
  document.getElementById(prefix + 'facet_code').value = dim.facet_code || '';
}

// ——— Dim Form ———

let editingDimCode = null;

function showDimForm(dimCode) {
  const form = document.getElementById('dimForm');
  form.style.display = 'block';
  editingDimCode = dimCode;

  document.getElementById('dimFormTitle').textContent = dimCode ? '编辑维度' : '新增维度';

  if (dimCode) {
    const dim = cachedDimensions.find(d => d.dimension_code === dimCode);
    if (dim) {
      document.getElementById('df_code').value = dim.dimension_code || '';
      document.getElementById('df_code').readOnly = true;
      document.getElementById('df_name').value = dim.dimension_name || '';
      document.getElementById('df_parent_name').value = dim.parent_dimension || '';
      document.getElementById('df_parent_code').value = dim.parent_dimension_code || '';
      document.getElementById('df_facet_name').value = dim.facet_name || '';
      document.getElementById('df_facet_code').value = dim.facet_code || '';
      document.getElementById('df_desc').value = dim.dimension_description || '';
      document.getElementById('df_active').checked = dim.is_active !== false;
    }
  } else {
    document.getElementById('df_code').readOnly = false;
    document.getElementById('df_code').value = '';
    document.getElementById('df_name').value = '';
    document.getElementById('df_parent_name').value = '';
    document.getElementById('df_parent_code').value = '';
    document.getElementById('df_facet_name').value = '';
    document.getElementById('df_facet_code').value = '';
    document.getElementById('df_desc').value = '';
    document.getElementById('df_active').checked = true;
  }
}

function cancelDimForm() {
  document.getElementById('dimForm').style.display = 'none';
}

async function adminSaveDimension() {
  const code = document.getElementById('df_code').value.trim();
  if (!code) { adminToast('dimension_code 不能为空'); return; }

  const data = {
    dimension_code: code,
    dimension_name: document.getElementById('df_name').value.trim(),
    parent_dimension: document.getElementById('df_parent_name').value.trim(),
    parent_dimension_code: document.getElementById('df_parent_code').value.trim(),
    facet_name: document.getElementById('df_facet_name').value.trim(),
    facet_code: document.getElementById('df_facet_code').value.trim(),
    dimension_description: document.getElementById('df_desc').value.trim(),
    is_active: document.getElementById('df_active').checked
  };

  try {
    if (editingDimCode) {
      await apiPut('/admin/dimensions/' + encodeURIComponent(editingDimCode), data);
      adminToast('维度已更新');
    } else {
      await apiPost('/admin/dimensions', data);
      adminToast('维度已创建');
    }
    cancelDimForm();
    loadDimensions();
  } catch (e) {
    adminToast('保存失败: ' + e.message);
  }
}

async function adminDeactivateDim(code) {
  if (!confirm('确定停用维度 "' + code + '"？')) return;
  try {
    await apiDelete('/admin/dimensions/' + encodeURIComponent(code));
    adminToast('维度已停用');
    loadDimensions();
  } catch (e) {
    adminToast('操作失败: ' + e.message);
  }
}

// ============================================================
// Questionnaire
// ============================================================

async function loadQuestionnaire() {
  const tbody = document.getElementById('questionnaireTableBody');
  try {
    const items = await apiGet('/admin/questionnaire');
    cachedQuestionnaireItems = normalizeQuestionnairePages(items);
    tbody.innerHTML = cachedQuestionnaireItems.map(item => {
      const status = item.is_active !== false ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
      return '<tr><td>' + esc(item.page || 1) + '</td><td>' + esc(item.display_order || '-') + '</td><td>' + esc(item.question_id) + '</td><td>' + esc(trunc(item.question_text, 40)) + '</td><td>' + esc(item.dimension_name || '-') + '</td><td>' + esc(item.question_type) + '</td><td>' + (item.required ? '✅' : '') + '</td><td>' + (item.reverse_scored ? '✅' : '') + '</td><td>' + status + '</td><td><button class="admin-btn sm" onclick="showQuestionForm(\'' + esc(item.question_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminCopyQuestion(\'' + esc(item.question_id) + '\')">复制</button> <button class="admin-btn sm" onclick="adminInsertPageBreakAfter(\'' + esc(item.question_id) + '\')">此题后分页</button> <button class="admin-btn sm danger" onclick="adminDeactivateQuestion(\'' + esc(item.question_id) + '\')">停用</button></td></tr>';
    }).join('');
    if (items.length === 0) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;">暂无数据</td></tr>';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="10" style="color:#e74c3c;">加载失败: ' + e.message + '</td></tr>';
  }
}

function normalizeQuestionnairePages(items) {
  return (items || []).map((item, idx) => {
    const copy = Object.assign({}, item);
    const order = parseInt(copy.display_order, 10) || idx + 1;
    copy.display_order = order;
    copy.page = parseInt(copy.page, 10) || Math.max(1, Math.ceil(order / 5));
    return copy;
  }).sort((a, b) => {
    if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
    return (a.display_order || 0) - (b.display_order || 0);
  });
}

function nextQuestionId(items) {
  let maxNum = 0;
  (items || []).forEach(item => {
    const m = String(item.question_id || '').match(/^q_(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return 'q_' + String(maxNum + 1).padStart(3, '0');
}

function cloneQuestionOptions(questionId, options) {
  return (options || []).map((opt, idx) => {
    const letter = String.fromCharCode(97 + idx);
    return {
      option_id: questionId + '_' + letter,
      option_text: opt.option_text || '',
      score: opt.score !== undefined ? opt.score : idx + 1
    };
  });
}

// ——— Question Form ———

let editingQuestionId = null;

function showQuestionForm(questionId) {
  const form = document.getElementById('questionForm');
  form.style.display = 'block';
  editingQuestionId = questionId;

  document.getElementById('questionFormTitle').textContent = questionId ? '编辑题目' : '新增题目';

  // Reset
  document.getElementById('qf_options').innerHTML = '';
  document.getElementById('qf_id').value = '';
  document.getElementById('qf_text').value = '';
  document.getElementById('qf_type').value = 'likert';
  document.getElementById('qf_required').checked = true;
  document.getElementById('qf_reverse').checked = false;
  document.getElementById('qf_active').checked = true;
  document.getElementById('qf_scale_min').value = '1';
  document.getElementById('qf_scale_max').value = '5';
  document.getElementById('qf_order').value = '1';
  document.getElementById('qf_page').value = '1';
  document.getElementById('qf_note').value = '';

  if (questionId) {
    loadQuestionnaireItem(questionId);
  }
}

async function loadQuestionnaireItem(questionId) {
  try {
    const items = await apiGet('/admin/questionnaire');
    const item = items.find(i => i.question_id === questionId);
    if (!item) return;

    document.getElementById('qf_id').value = item.question_id || '';
    document.getElementById('qf_text').value = item.question_text || '';
    document.getElementById('qf_type').value = item.question_type || 'likert';
    document.getElementById('qf_required').checked = item.required !== false;
    document.getElementById('qf_reverse').checked = item.reverse_scored === true;
    document.getElementById('qf_active').checked = item.is_active !== false;
    document.getElementById('qf_scale_min').value = item.scale_min || 1;
    document.getElementById('qf_scale_max').value = item.scale_max || 5;
    document.getElementById('qf_order').value = item.display_order || 1;
    document.getElementById('qf_page').value = item.page || Math.max(1, Math.ceil((item.display_order || 1) / 5));
    document.getElementById('qf_note').value = item.researcher_note || '';

    // Dimension
    if (item.dimension_code) {
      document.getElementById('qf_dim_code').value = item.dimension_code;
      adminFillDimensionFields('qf_', item.dimension_code);
    }

    // Options
    const optContainer = document.getElementById('qf_options');
    optContainer.innerHTML = '';
    (item.options || []).forEach(opt => {
      addOptionRow('qf_', opt.option_id || '', opt.option_text || '', opt.score !== undefined ? opt.score : '');
    });
  } catch (e) {
    adminToast('加载题目失败: ' + e.message);
  }
}

function cancelQuestionForm() {
  document.getElementById('questionForm').style.display = 'none';
}

async function adminSaveQuestion() {
  const id = document.getElementById('qf_id').value.trim();
  if (!id) { adminToast('question_id 不能为空'); return; }

  const options = collectOptions('qf_');

  const data = {
    question_id: id,
    question_text: document.getElementById('qf_text').value.trim(),
    question_type: document.getElementById('qf_type').value,
    required: document.getElementById('qf_required').checked,
    reverse_scored: document.getElementById('qf_reverse').checked,
    is_active: document.getElementById('qf_active').checked,
    scale_min: parseInt(document.getElementById('qf_scale_min').value) || 1,
    scale_max: parseInt(document.getElementById('qf_scale_max').value) || 5,
    display_order: parseInt(document.getElementById('qf_order').value) || 1,
    page: parseInt(document.getElementById('qf_page').value) || 1,
    dimension_code: document.getElementById('qf_dim_code').value,
    dimension_name: document.getElementById('qf_dim_name').value,
    parent_dimension: document.getElementById('qf_parent_name').value,
    parent_dimension_code: document.getElementById('qf_parent_code').value,
    facet_name: document.getElementById('qf_facet_name').value,
    facet_code: document.getElementById('qf_facet_code').value,
    researcher_note: document.getElementById('qf_note').value.trim(),
    options: options
  };

  try {
    if (editingQuestionId) {
      await apiPut('/admin/questionnaire/' + encodeURIComponent(editingQuestionId), data);
      adminToast('题目已更新');
    } else {
      await apiPost('/admin/questionnaire', data);
      adminToast('题目已创建');
    }
    cancelQuestionForm();
    loadQuestionnaire();
  } catch (e) {
    adminToast('保存失败: ' + e.message);
  }
}

async function adminDeactivateQuestion(id) {
  if (!confirm('确定停用题目 "' + id + '"？')) return;
  try {
    await apiDelete('/admin/questionnaire/' + encodeURIComponent(id));
    adminToast('题目已停用');
    loadQuestionnaire();
  } catch (e) {
    adminToast('操作失败: ' + e.message);
  }
}

async function adminCopyQuestion(id) {
  try {
    const items = cachedQuestionnaireItems.length ? cachedQuestionnaireItems : normalizeQuestionnairePages(await apiGet('/admin/questionnaire'));
    const source = items.find(item => item.question_id === id);
    if (!source) { adminToast('未找到要复制的题目'); return; }

    const newId = nextQuestionId(items);
    const maxOrder = items.reduce((max, item) => Math.max(max, parseInt(item.display_order, 10) || 0), 0);
    const copy = JSON.parse(JSON.stringify(source));
    copy.question_id = newId;
    copy.question_text = (copy.question_text || '') + '（副本）';
    copy.display_order = maxOrder + 1;
    copy.page = source.page || Math.max(1, Math.ceil((source.display_order || 1) / 5));
    copy.is_active = true;
    copy.options = cloneQuestionOptions(newId, source.options || []);

    await apiPost('/admin/questionnaire', copy);
    adminToast('已复制为 ' + newId);
    loadQuestionnaire();
  } catch (e) {
    adminToast('复制失败: ' + e.message);
  }
}

async function adminInsertPageBreakAfter(id) {
  try {
    const items = normalizeQuestionnairePages(await apiGet('/admin/questionnaire'));
    const targetIndex = items.findIndex(item => item.question_id === id);
    if (targetIndex === -1) { adminToast('未找到题目'); return; }

    const target = items[targetIndex];
    const targetPage = target.page || 1;
    const hasSamePageAfter = items.some((item, idx) => idx > targetIndex && (item.page || 1) === targetPage);
    if (!hasSamePageAfter) {
      adminToast('这道题已经是本页最后一题，无需新增分页');
      return;
    }

    const updates = [];
    items.forEach((item, idx) => {
      const page = item.page || 1;
      if (page > targetPage || (page === targetPage && idx > targetIndex)) {
        const updated = Object.assign({}, item, { page: page + 1 });
        updates.push(updated);
      }
    });

    for (const item of updates) {
      await apiPut('/admin/questionnaire/' + encodeURIComponent(item.question_id), item);
    }
    adminToast('已在 ' + id + ' 后分页');
    loadQuestionnaire();
  } catch (e) {
    adminToast('分页失败: ' + e.message);
  }
}

// ============================================================
// Scenes
// ============================================================

async function loadScenes() {
  const tbody = document.getElementById('sceneTableBody');
  try {
    const scenes = await apiGet('/admin/game-scenes');
    cachedScenes = (scenes || []).slice().sort((a, b) => {
      return (a.display_order || a.scene_order || 0) - (b.display_order || b.scene_order || 0);
    });
    tbody.innerHTML = cachedScenes.map(s => {
      const status = s.is_active !== false ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
      return '<tr><td>' + esc(s.scene_id) + '</td><td>' + esc(s.scene_title || '-') + '</td><td>' + (s.scene_order || '-') + '</td><td>' + esc(s.dimension_name || '-') + '</td><td>' + (s.reverse_scored ? '✅' : '') + '</td><td>' + (s.options ? s.options.length : 0) + '</td><td>' + status + '</td><td><button class="admin-btn sm" onclick="showSceneForm(\'' + esc(s.scene_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminCopyScene(\'' + esc(s.scene_id) + '\')">复制</button> <button class="admin-btn sm danger" onclick="adminDeactivateScene(\'' + esc(s.scene_id) + '\')">停用</button></td></tr>';
    }).join('');
    if (scenes.length === 0) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">暂无数据</td></tr>';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#e74c3c;">加载失败: ' + e.message + '</td></tr>';
  }
}

function nextSceneId(scenes) {
  let maxNum = 0;
  (scenes || []).forEach(scene => {
    const m = String(scene.scene_id || '').match(/^scene_(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return 'scene_' + String(maxNum + 1).padStart(3, '0');
}

// ——— Scene Form ———

let editingSceneId = null;

function showSceneForm(sceneId) {
  const form = document.getElementById('sceneForm');
  form.style.display = 'block';
  editingSceneId = sceneId;

  document.getElementById('sceneFormTitle').textContent = sceneId ? '编辑情景' : '新增情景';

  // Reset
  document.getElementById('sf_options').innerHTML = '';
  document.getElementById('sf_id').value = '';
  document.getElementById('sf_title').value = '';
  document.getElementById('sf_order').value = '1';
  document.getElementById('sf_text').value = '';
  document.getElementById('sf_question_text').value = '';
  document.getElementById('sf_reverse').checked = false;
  document.getElementById('sf_active').checked = true;
  document.getElementById('sf_bg').value = '';
  document.getElementById('sf_display_order').value = '1';
  document.getElementById('sf_note').value = '';
  document.getElementById('sf_dim_code').value = '';

  if (sceneId) {
    loadSceneItem(sceneId);
  }
}

async function loadSceneItem(sceneId) {
  try {
    const scenes = await apiGet('/admin/game-scenes');
    const scene = scenes.find(s => s.scene_id === sceneId);
    if (!scene) return;

    document.getElementById('sf_id').value = scene.scene_id || '';
    document.getElementById('sf_title').value = scene.scene_title || '';
    document.getElementById('sf_order').value = scene.scene_order || 1;
    document.getElementById('sf_text').value = scene.scene_text || '';
    document.getElementById('sf_question_text').value = scene.question_text || '';
    document.getElementById('sf_reverse').checked = scene.reverse_scored === true;
    document.getElementById('sf_active').checked = scene.is_active !== false;
    document.getElementById('sf_bg').value = scene.background_image_url || '';
    document.getElementById('sf_display_order').value = scene.display_order || 1;
    document.getElementById('sf_note').value = scene.researcher_note || '';

    if (scene.dimension_code) {
      document.getElementById('sf_dim_code').value = scene.dimension_code;
      adminFillDimensionFields('sf_', scene.dimension_code);
    }

    const optContainer = document.getElementById('sf_options');
    optContainer.innerHTML = '';
    (scene.options || []).forEach(opt => {
      addOptionRow('sf_', opt.option_label || '', opt.option_text || '', opt.score !== undefined ? opt.score : '');
    });
  } catch (e) {
    adminToast('加载情景失败: ' + e.message);
  }
}

function cancelSceneForm() {
  document.getElementById('sceneForm').style.display = 'none';
}

async function adminSaveScene() {
  const id = document.getElementById('sf_id').value.trim();
  if (!id) { adminToast('scene_id 不能为空'); return; }

  const options = collectOptions('sf_');

  const data = {
    scene_id: id,
    scene_title: document.getElementById('sf_title').value.trim(),
    scene_order: parseInt(document.getElementById('sf_order').value) || 1,
    scene_text: document.getElementById('sf_text').value.trim(),
    question_text: document.getElementById('sf_question_text').value.trim(),
    reverse_scored: document.getElementById('sf_reverse').checked,
    is_active: document.getElementById('sf_active').checked,
    background_image_url: document.getElementById('sf_bg').value.trim(),
    display_order: parseInt(document.getElementById('sf_display_order').value) || 1,
    dimension_code: document.getElementById('sf_dim_code').value,
    dimension_name: document.getElementById('sf_dim_name').value,
    parent_dimension: document.getElementById('sf_parent_name').value,
    parent_dimension_code: document.getElementById('sf_parent_code').value,
    facet_name: document.getElementById('sf_facet_name').value,
    facet_code: document.getElementById('sf_facet_code').value,
    researcher_note: document.getElementById('sf_note').value.trim(),
    options: options
  };

  try {
    if (editingSceneId) {
      await apiPut('/admin/game-scenes/' + encodeURIComponent(editingSceneId), data);
      adminToast('情景已更新');
    } else {
      await apiPost('/admin/game-scenes', data);
      adminToast('情景已创建');
    }
    cancelSceneForm();
    loadScenes();
  } catch (e) {
    adminToast('保存失败: ' + e.message);
  }
}

async function adminDeactivateScene(id) {
  if (!confirm('确定停用情景 "' + id + '"？')) return;
  try {
    await apiDelete('/admin/game-scenes/' + encodeURIComponent(id));
    adminToast('情景已停用');
    loadScenes();
  } catch (e) {
    adminToast('操作失败: ' + e.message);
  }
}

async function adminCopyScene(id) {
  try {
    const scenes = cachedScenes.length ? cachedScenes : await apiGet('/admin/game-scenes');
    const source = scenes.find(scene => scene.scene_id === id);
    if (!source) { adminToast('未找到要复制的情景'); return; }

    const newId = nextSceneId(scenes);
    const maxOrder = scenes.reduce((max, scene) => Math.max(max, parseInt(scene.display_order || scene.scene_order, 10) || 0), 0);
    const copy = JSON.parse(JSON.stringify(source));
    copy.scene_id = newId;
    copy.scene_title = (copy.scene_title || '') + '（副本）';
    copy.scene_order = maxOrder + 1;
    copy.display_order = maxOrder + 1;
    copy.is_active = true;

    await apiPost('/admin/game-scenes', copy);
    adminToast('已复制为 ' + newId);
    loadScenes();
  } catch (e) {
    adminToast('复制失败: ' + e.message);
  }
}

// ============================================================
// Options Sub-form Helpers
// ============================================================

function adminAddOption(prefix) {
  addOptionRow(prefix, '', '', '');
}

function addOptionRow(prefix, optId, optText, score) {
  const container = document.getElementById(prefix + 'options');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'option-item';

  const isScene = prefix === 'sf_';

  div.innerHTML = [
    '<div class="opt-fields">',
      '<input class="opt-id" placeholder="' + (isScene ? '标签(A/B/C/D)' : '选项ID') + '" value="' + esc(optId) + '" style="width:' + (isScene ? '60' : '120') + 'px;">',
      '<input class="opt-text" placeholder="选项文本" value="' + esc(optText) + '" style="flex:1;min-width:120px;">',
      '<input class="opt-score" placeholder="分数" value="' + esc(score) + '" type="number" style="width:60px;">',
    '</div>',
    '<button class="admin-btn sm danger" onclick="this.parentElement.remove()">✕</button>'
  ].join('');

  container.appendChild(div);
}

function collectOptions(prefix) {
  const container = document.getElementById(prefix + 'options');
  if (!container) return [];
  const options = [];
  container.querySelectorAll('.option-item').forEach(item => {
    const idEl = item.querySelector('.opt-id');
    const textEl = item.querySelector('.opt-text');
    const scoreEl = item.querySelector('.opt-score');
    if (!idEl || !textEl) return;
    const optId = idEl.value.trim();
    const optText = textEl.value.trim();
    const score = parseFloat(scoreEl.value);
    if (optId && optText && !isNaN(score)) {
      if (prefix === 'sf_') {
        options.push({ option_label: optId, option_text: optText, score: score });
      } else {
        options.push({ option_id: optId, option_text: optText, score: score });
      }
    }
  });
  return options;
}

// ============================================================
// Participants
// ============================================================

async function loadParticipants() {
  const tbody = document.getElementById('participantTableBody');
  const filter = document.getElementById('participantFilter').value;

  try {
    let url = '/admin/participants';
    if (filter) url += '?completion_status=' + encodeURIComponent(filter);
    const list = await apiGet(url);
    tbody.innerHTML = list.map(p => {
      const statusMap = {
        'in_progress': '进行中',
        'questionnaire_completed': '问卷完成',
        'game_completed': '游戏完成',
        'completed': '全部完成',
        'abandoned': '已放弃'
      };
      const statusText = statusMap[p.completion_status] || p.completion_status;
      const badgeClass = p.completion_status === 'completed' ? 'completed' :
        p.completion_status === 'abandoned' ? 'abandoned' : 'in_progress';
      var qCount = p.questionnaire_response_count != null ? p.questionnaire_response_count : '-';
      var gCount = p.game_response_count != null ? p.game_response_count : '-';
      return '<tr>' +
        '<td class="clickable" onclick="showParticipantDetail(\'' + esc(p.participant_id) + '\')">' + esc(p.participant_code || '-') + '</td>' +
        '<td>' + esc(p.external_id || '-') + '</td>' +
        '<td style="font-family:monospace;font-size:11px;color:#888;" title="' + esc(p.participant_id || '') + '">' + esc(trunc(p.participant_id || '', 18)) + '</td>' +
        '<td style="font-size:12px;color:#888;">' + formatDateTime(p.start_time) + '</td>' +
        '<td><span class="status-badge ' + badgeClass + '">' + statusText + '</span></td>' +
        '<td>问卷 ' + qCount + ' / 剧情 ' + gCount + '</td>' +
        '<td>' + (p.total_duration_seconds || 0) + '</td>' +
        '<td><button class="admin-btn sm" onclick="showParticipantDetail(\'' + esc(p.participant_id) + '\')">查看</button></td>' +
        '</tr>';
    }).join('');
    if (list.length === 0) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">暂无数据</td></tr>';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#e74c3c;">加载失败: ' + e.message + '</td></tr>';
  }
}

async function showParticipantDetail(participantId) {
  const modal = document.getElementById('detailModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = '加载中...';
  body.innerHTML = '<div class="admin-loading">加载中...</div>';
  modal.classList.add('show');

  try {
    const data = await apiGet('/admin/participants/' + encodeURIComponent(participantId));
    const session = data.session || {};

    title.textContent = '被试详情: ' + (session.participant_code || participantId);

    let html = '';

    // Session
    html += '<div class="detail-section"><h3>📋 会话信息</h3><div class="detail-kv">';
    const sessionFields = [
      ['participant_id', session.participant_id],
      ['participant_code', session.participant_code],
      ['external_id', session.external_id],
      ['completion_status', session.completion_status],
      ['start_time', session.start_time],
      ['questionnaire_start_time', session.questionnaire_start_time],
      ['questionnaire_end_time', session.questionnaire_end_time],
      ['game_start_time', session.game_start_time],
      ['game_end_time', session.game_end_time],
      ['total_duration_seconds', session.total_duration_seconds],
      ['ip_address', session.ip_address],
      ['user_agent', session.user_agent]
    ];
    sessionFields.forEach(f => {
      html += '<span class="key">' + f[0] + '</span><span class="value">' + esc(String(f[1] || '')) + '</span>';
    });
    html += '</div></div>';

    if (data.legacy_external_id_data_used) {
      html += '<div class="detail-section"><div class="admin-loading" style="color:#b36b00;">检测到这名被试有历史错位数据，已兼容读取 external_id 路径下的作答。</div></div>';
    }

    // Questionnaire responses
    if (data.questionnaire_responses && data.questionnaire_responses.length > 0) {
      html += '<div class="detail-section"><h3>📝 问卷作答 (' + data.questionnaire_responses.length + ' 条)</h3>';
      html += '<table class="admin-table"><thead><tr><th>题号</th><th>题目</th><th>回答</th><th>选项ID</th><th>原始分</th><th>最终分</th><th>维度</th><th>时间</th></tr></thead><tbody>';
      data.questionnaire_responses.forEach(r => {
        var answerText = '';
        if (r.question_type === 'text_input') {
          answerText = '📝 ' + esc(r.raw_answer_text || '（空）');
        } else {
          answerText = esc(r.selected_option_text || '');
        }
        html += '<tr><td>' + esc(r.question_id) + '</td><td style="max-width:220px;word-break:break-all;">' + esc(r.question_text || '') + '</td><td style="max-width:200px;word-break:break-all;">' + answerText + '</td><td>' + esc(r.selected_option_id || '-') + '</td><td>' + (r.raw_score || 0) + '</td><td>' + (r.final_score != null ? r.final_score : '-') + '</td><td>' + esc(r.dimension_name || '-') + '</td><td style="font-size:11px;color:#888;">' + formatDateTime(r.answered_at) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="detail-section"><h3>📝 问卷作答</h3><div class="admin-loading">暂无问卷作答记录</div></div>';
    }

    // Game responses
    if (data.game_responses && data.game_responses.length > 0) {
      html += '<div class="detail-section"><h3>🎬 剧情作答 (' + data.game_responses.length + ' 条)</h3>';
      html += '<table class="admin-table"><thead><tr><th>场景</th><th>题目</th><th>选项</th><th>选项文本</th><th>原始分</th><th>最终分</th><th>维度</th><th>时间</th></tr></thead><tbody>';
      data.game_responses.forEach(r => {
        html += '<tr><td>' + esc(r.scene_id) + '</td><td style="max-width:220px;word-break:break-all;">' + esc(r.question_text || '') + '</td><td>' + esc(r.selected_option_label || '') + '</td><td style="max-width:220px;word-break:break-all;">' + esc(r.selected_option_text || '') + '</td><td>' + (r.raw_score || 0) + '</td><td>' + (r.final_score || 0) + '</td><td>' + esc(r.dimension_name || '-') + '</td><td style="font-size:11px;color:#888;">' + formatDateTime(r.answered_at) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="detail-section"><h3>🎬 剧情作答</h3><div class="admin-loading">暂无剧情作答记录</div></div>';
    }

    // Dimension scores
    if (data.dimension_scores) {
      const ds = data.dimension_scores;

      // Parent dimension scores
      if (ds.parent_dimension_scores && ds.parent_dimension_scores.length > 0) {
        html += '<div class="detail-section"><h3>📊 一级大维度得分</h3>';
        html += '<table class="admin-table"><thead><tr><th>维度</th><th>总分</th><th>题数</th><th>平均分</th><th>子维度</th></tr></thead><tbody>';
        ds.parent_dimension_scores.forEach(s => {
          html += '<tr><td><strong>' + esc(s.parent_dimension) + '</strong></td><td>' + (s.total_score || 0) + '</td><td>' + (s.item_count || 0) + '</td><td>' + (s.average_score != null ? s.average_score.toFixed(2) : '-') + '</td><td>' + esc((s.included_facets || []).join(', ')) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }

      // Facet dimension scores
      if (ds.facet_dimension_scores && ds.facet_dimension_scores.length > 0) {
        html += '<div class="detail-section"><h3>📊 子维度得分</h3>';
        html += '<table class="admin-table"><thead><tr><th>子维度</th><th>总分</th><th>题数</th><th>平均分</th></tr></thead><tbody>';
        ds.facet_dimension_scores.forEach(s => {
          html += '<tr><td>' + esc(s.dimension_name) + '</td><td>' + (s.total_score || 0) + '</td><td>' + (s.item_count || 0) + '</td><td>' + (s.average_score != null ? s.average_score.toFixed(2) : '-') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }

      // Overall
      if (ds.overall_score) {
        html += '<div class="detail-section"><h3>📊 总体得分</h3>';
        html += '<table class="admin-table"><thead><tr><th>指标</th><th>值</th></tr></thead><tbody>';
        html += '<tr><td>总分</td><td>' + (ds.overall_score.total_score || 0) + '</td></tr>';
        html += '<tr><td>总题数</td><td>' + (ds.overall_score.total_item_count || 0) + '</td></tr>';
        html += '<tr><td>平均分</td><td>' + (ds.overall_score.total_average_score != null ? ds.overall_score.total_average_score.toFixed(2) : '-') + '</td></tr>';
        html += '</tbody></table></div>';
      }
    }

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div style="color:#e74c3c;">加载失败: ' + e.message + '</div>';
  }
}

function closeModal() {
  document.getElementById('detailModal').classList.remove('show');
}

// ============================================================
// Export
// ============================================================

function initExport() {
  const container = document.getElementById('exportButtons');
  const exports = [
    { label: '被试总表', csv: '/admin/export/participants.csv', xlsx: '/admin/export/participants.xlsx' },
    { label: '问卷明细', csv: '/admin/export/questionnaire-responses.csv', xlsx: '/admin/export/questionnaire-responses.xlsx' },
    { label: '剧情明细', csv: '/admin/export/game-responses.csv', xlsx: '/admin/export/game-responses.xlsx' },
    { label: '一级维度得分', csv: '/admin/export/parent-dimension-scores.csv', xlsx: '/admin/export/parent-dimension-scores.xlsx' },
    { label: '子维度得分', csv: '/admin/export/facet-dimension-scores.csv', xlsx: '/admin/export/facet-dimension-scores.xlsx' }
  ];

  container.innerHTML = exports.map(ex => {
    const btnId = 'export_' + ex.label;
    return '<div><div style="font-size:13px;font-weight:500;margin-bottom:4px;">' + esc(ex.label) + '</div><div style="display:flex;gap:4px;">' +
      '<button class="export-btn" onclick="downloadAdminFile(\'' + ex.csv + '\', \'' + ex.label + '.csv\')"><span class="ext">CSV</span> 下载</button>' +
      '<button class="export-btn" onclick="downloadAdminFile(\'' + ex.xlsx + '\', \'' + ex.label + '.xlsx\')"><span class="ext">XLSX</span> 下载</button>' +
      '</div></div>';
  }).join('');
}

async function downloadAdminFile(path, filename) {
  try {
    adminToast('正在下载 ' + filename + '...');
    await downloadFile(path, filename);
    adminToast('下载完成: ' + filename);
  } catch (e) {
    adminToast('下载失败: ' + e.message);
  }
}

// ============================================================
// Toast
// ============================================================

function adminToast(msg) {
  const toast = document.getElementById('adminToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2500);
}

// ============================================================
// Utility
// ============================================================

function esc(str) {
  if (typeof str !== 'string') str = String(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function trunc(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('zh-CN', { hour12: false }); }
  catch (e) { return iso; }
}

// ============================================================
// 页面初始化
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('admin_token');
  if (token) {
    showAdminApp();
  }
});
