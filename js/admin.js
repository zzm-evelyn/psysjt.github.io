/* ============================================================
   admin.js — 研究管理端逻辑
   所有数据从后端 API 获取，不使用 localStorage 作为正式数据源
   ============================================================ */

let adminCurrentTab = 'overview';
let cachedDimensions = [];
let cachedQuestionnaireItems = [];
let cachedScenes = [];
let cachedQuestionnaireBlocks = [];
let cachedExperimentFlow = null;
let editingQuestionnaireBlockId = null;
let cachedQuestionnaireSettings = {
  title: '',
  intro_text: '',
  start_button_text: '',
  completion_text: '',
  instruction_blocks: []
};
let editingInstructionBlockId = null;

// ============================================================
// 认证
// ============================================================

function ensureFlowAdminTab() {
  const nav = document.getElementById('adminNav');
  if (nav && !document.querySelector(".admin-nav-btn[data-tab='flow']")) {
    const btn = document.createElement('button');
    btn.className = 'admin-nav-btn';
    btn.dataset.tab = 'flow';
    btn.textContent = '实验流程';
    btn.onclick = function () { switchAdminTab('flow'); };
    const buttons = nav.querySelectorAll('.admin-nav-btn');
    const afterScenes = buttons[2];
    if (afterScenes && afterScenes.nextSibling) {
      nav.insertBefore(btn, afterScenes.nextSibling);
    } else {
      nav.appendChild(btn);
    }
  }

  const main = document.getElementById('mainApp');
  if (!main || document.getElementById('tabFlow')) return;
  const section = document.createElement('div');
  section.id = 'tabFlow';
  section.className = 'admin-section';
  section.innerHTML = [
    '<div class="admin-card">',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;flex-wrap:wrap;">',
        '<h2>实验流程</h2>',
        '<button class="admin-btn primary sm" onclick="adminSaveExperimentFlow()">保存流程</button>',
      '</div>',
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">',
        '<label class="admin-checkbox-label"><input id="flow_enabled" type="checkbox"> 启用自定义实验流程</label>',
      '</div>',
      '<div class="admin-form-row"><label>最终结束语</label><input id="flow_complete_text" class="admin-input" placeholder="全部体验结束，感谢您的参与！"></div>',
      '<div class="admin-actions">',
        '<button class="admin-btn sm" onclick="adminAddFlowQuestionnaireStep()">+ 问卷步骤</button>',
        '<button class="admin-btn sm" onclick="adminAddFlowGameGroupStep()">+ 故事组步骤</button>',
        '<button class="admin-btn sm" onclick="adminAddFlowCompleteStep()">+ 结束步骤</button>',
      '</div>',
      '<div class="admin-table-wrap"><table class="admin-table">',
        '<thead><tr><th>顺序</th><th>类型</th><th>名称</th><th>配置</th><th>启用</th><th>操作</th></tr></thead>',
        '<tbody id="flowStepTableBody"><tr><td colspan="6" class="admin-loading">加载中...</td></tr></tbody>',
      '</table></div>',
    '</div>',
    '<div class="admin-card">',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;flex-wrap:wrap;">',
        '<h2>问卷块</h2>',
        '<button class="admin-btn primary sm" onclick="showQuestionnaireBlockForm(null)">+ 新增问卷块</button>',
      '</div>',
      '<div class="admin-table-wrap"><table class="admin-table">',
        '<thead><tr><th>ID</th><th>名称</th><th>题目数</th><th>状态</th><th>操作</th></tr></thead>',
        '<tbody id="questionnaireBlockTableBody"><tr><td colspan="5" class="admin-loading">加载中...</td></tr></tbody>',
      '</table></div>',
    '</div>',
    '<div id="questionnaireBlockForm" class="admin-card" style="display:none;">',
      '<h2 id="questionnaireBlockFormTitle">新增问卷块</h2>',
      '<div class="admin-form-row"><label class="required">block_id</label><input id="qbf_id" class="admin-input admin-input-sm" placeholder="post_game_questionnaire"></div>',
      '<div class="admin-form-row"><label>显示标题</label><input id="qbf_title" class="admin-input" placeholder="故事后问卷"></div>',
      '<div class="admin-form-row"><label>指导语</label><textarea id="qbf_intro_text" class="admin-textarea" rows="4" placeholder="被试进入该问卷块前看到的文字"></textarea></div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">',
        '<div><label>开始按钮文字</label><input id="qbf_start_button_text" class="admin-input" placeholder="开始作答"></div>',
        '<div><label>完成提示</label><input id="qbf_completion_text" class="admin-input" placeholder="问卷已提交，非常感谢！"></div>',
      '</div>',
      '<div class="admin-form-row"><label>包含题号</label><textarea id="qbf_question_ids" class="admin-textarea" rows="5" placeholder="每行一个题号；main_questionnaire 留空时默认使用 q_001 到 q_163"></textarea></div>',
      '<label class="admin-checkbox-label"><input id="qbf_active" type="checkbox" checked> 启用</label>',
      '<div class="admin-actions"><button class="admin-btn primary" onclick="adminSaveQuestionnaireBlock()">保存问卷块</button><button class="admin-btn" onclick="cancelQuestionnaireBlockForm()">取消</button></div>',
    '</div>'
  ].join('');

  const participants = document.getElementById('tabParticipants');
  if (participants && participants.parentNode) {
    participants.parentNode.insertBefore(section, participants);
  } else {
    main.appendChild(section);
  }
}

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
  ensureFlowAdminTab();
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
  ensureFlowAdminTab();
  const navBtns = document.querySelectorAll('.admin-nav-btn');
  const tabMap = { overview: 0, questionnaire: 1, scenes: 2, flow: 3, dimensions: 4, participants: 5, export: 6 };
  const idx = tabMap[tab];
  if (navBtns[idx]) navBtns[idx].classList.add('active');

  // Sections
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (section) section.classList.add('active');

  // Load data
  switch (tab) {
    case 'overview': loadOverview(); break;
    case 'questionnaire':
      loadQuestionnaireSettings();
      loadQuestionnaire();
      break;
    case 'scenes': loadScenes(); break;
    case 'flow': loadExperimentFlowAdmin(); break;
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
    await loadQuestionnaireBlocksForQuestionTab();
    const items = await apiGet('/admin/questionnaire');
    cachedQuestionnaireItems = normalizeQuestionnairePages(items);
    const showDeletedEl = document.getElementById('showDeletedQuestions');
    const showDeleted = showDeletedEl ? showDeletedEl.checked : false;
    const visibleItems = questionItemsForCurrentBlock(cachedQuestionnaireItems)
      .filter(item => showDeleted || item.is_active !== false);
    tbody.innerHTML = visibleItems.map(item => {
      const status = item.is_active !== false ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
      const actions = item.is_active !== false
        ? '<button class="admin-btn sm" onclick="showQuestionForm(\'' + esc(item.question_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminCopyQuestion(\'' + esc(item.question_id) + '\')">复制</button> <button class="admin-btn sm" onclick="adminInsertPageBreakAfter(\'' + esc(item.question_id) + '\')">此题后分页</button> <button class="admin-btn sm danger" onclick="adminDeleteQuestion(\'' + esc(item.question_id) + '\')">删除</button>'
        : '<button class="admin-btn sm" onclick="showQuestionForm(\'' + esc(item.question_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminRestoreQuestion(\'' + esc(item.question_id) + '\')">恢复</button>';
      return '<tr><td>' + esc(item.page || 1) + '</td><td>' + esc(item.display_order || '-') + '</td><td>' + esc(item.question_id) + '</td><td>' + esc(trunc(item.question_text, 40)) + '</td><td>' + esc(item.dimension_name || '-') + '</td><td>' + esc(item.question_type) + '</td><td>' + (item.required ? '✅' : '') + '</td><td>' + (item.reverse_scored ? '✅' : '') + '</td><td>' + status + '</td><td>' + actions + '</td></tr>';
    }).join('');
    if (visibleItems.length === 0) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;">暂无数据</td></tr>';
    refreshQuestionInsertOptions();
    refreshExistingQuestionInsertOptions();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="10" style="color:#e74c3c;">加载失败: ' + e.message + '</td></tr>';
  }
}

async function loadQuestionnaireBlocksForQuestionTab() {
  const blocks = await apiGet('/admin/questionnaire-blocks');
  cachedQuestionnaireBlocks = normalizeQuestionnaireBlocks(blocks);
  renderQuestionBlockFilterOptions();
  renderQuestionFormBlockOptions();
}

function questionBlockLabel(block) {
  return (block.title || block.block_id) + '（' + block.block_id + '）';
}

function renderQuestionBlockFilterOptions() {
  const select = document.getElementById('questionBlockFilter');
  if (!select) return;
  const current = select.value || '__all__';
  select.innerHTML = '<option value="__all__">全部题库</option>' +
    (cachedQuestionnaireBlocks || []).filter(function (block) {
      return block.is_active !== false;
    }).map(function (block) {
      return '<option value="' + esc(block.block_id) + '">' + esc(questionBlockLabel(block)) + '</option>';
    }).join('');
  select.value = Array.from(select.options).some(function (option) { return option.value === current; }) ? current : '__all__';
}

function renderQuestionFormBlockOptions() {
  const select = document.getElementById('qf_block_id');
  if (!select) return;
  const current = select.value || '';
  select.innerHTML = '<option value="">不加入特定问卷组</option>' +
    (cachedQuestionnaireBlocks || []).filter(function (block) {
      return block.is_active !== false;
    }).map(function (block) {
      return '<option value="' + esc(block.block_id) + '">' + esc(questionBlockLabel(block)) + '</option>';
    }).join('');
  if (Array.from(select.options).some(function (option) { return option.value === current; })) {
    select.value = current;
  }
}

function currentQuestionBlockId() {
  const select = document.getElementById('questionBlockFilter');
  const value = select ? select.value : '__all__';
  return value && value !== '__all__' ? value : '';
}

function questionItemsForBlock(items, blockId) {
  if (!blockId) return (items || []).slice();
  const block = (cachedQuestionnaireBlocks || []).find(function (item) { return item.block_id === blockId; });
  if (!block) return [];
  const ids = block.question_ids || [];
  if (!ids.length) return (items || []).slice();
  const orderMap = {};
  ids.forEach(function (id, idx) { orderMap[canonicalAdminQuestionId(id)] = idx; });
  return (items || [])
    .filter(function (item) { return orderMap[canonicalAdminQuestionId(item.question_id)] !== undefined; })
    .sort(function (a, b) {
      return orderMap[canonicalAdminQuestionId(a.question_id)] - orderMap[canonicalAdminQuestionId(b.question_id)];
    });
}

function questionItemsForCurrentBlock(items) {
  return questionItemsForBlock(items, currentQuestionBlockId());
}

function canonicalAdminQuestionId(id) {
  const m = String(id || '').trim().toLowerCase().match(/(\d+)$/);
  if (m) return 'q_' + String(parseInt(m[1], 10)).padStart(3, '0');
  return String(id || '').trim().toLowerCase();
}

function questionOptionLabel(item) {
  return (item.display_order || '-') + '. ' + (item.question_id || '-') + ' ' + trunc(item.question_text || '', 30);
}

function refreshQuestionInsertOptions() {
  const blockEl = document.getElementById('qf_block_id');
  const modeEl = document.getElementById('qf_insert_mode');
  const refEl = document.getElementById('qf_insert_question_id');
  if (!blockEl || !modeEl || !refEl) return;

  const blockId = blockEl.value || '';
  const mode = modeEl.value || '';
  const needsReference = mode === 'before' || mode === 'after';
  const currentId = document.getElementById('qf_id') ? document.getElementById('qf_id').value.trim() : '';
  const options = questionItemsForBlock(cachedQuestionnaireItems || [], blockId)
    .filter(function (item) {
      return item.question_id !== currentId && item.is_active !== false;
    });

  refEl.disabled = !needsReference || !blockId;
  refEl.innerHTML = needsReference && blockId
    ? options.map(function (item) {
        return '<option value="' + esc(item.question_id || '') + '">' + esc(questionOptionLabel(item)) + '</option>';
      }).join('')
    : '<option value="">无需选择参考题目</option>';
  if (needsReference && blockId && !options.length) {
    refEl.innerHTML = '<option value="">当前组暂无可参考题目</option>';
  }
}

function refreshExistingQuestionInsertOptions() {
  const modeEl = document.getElementById('existingQuestionInsertMode');
  const refEl = document.getElementById('existingQuestionReferenceId');
  if (!modeEl || !refEl) return;
  const blockId = currentQuestionBlockId();
  const mode = modeEl.value || 'append';
  const needsReference = mode === 'before' || mode === 'after';
  const options = questionItemsForBlock(cachedQuestionnaireItems || [], blockId)
    .filter(function (item) { return item.is_active !== false; });
  refEl.disabled = !needsReference || !blockId;
  refEl.innerHTML = needsReference && blockId
    ? options.map(function (item) {
        return '<option value="' + esc(item.question_id || '') + '">' + esc(questionOptionLabel(item)) + '</option>';
      }).join('')
    : '<option value="">无需参考题目</option>';
  if (needsReference && blockId && !options.length) {
    refEl.innerHTML = '<option value="">当前组暂无可参考题目</option>';
  }
}

function collectQuestionInsertConfig() {
  const blockEl = document.getElementById('qf_block_id');
  const modeEl = document.getElementById('qf_insert_mode');
  const refEl = document.getElementById('qf_insert_question_id');
  if (!blockEl || !modeEl) return {};
  const blockId = blockEl.value || '';
  if (!blockId) return {};

  let mode = modeEl.value || '';
  if (!editingQuestionId && !mode) mode = 'append';
  if (!mode) return { block_id: blockId };

  const config = { block_id: blockId, insert_mode: mode };
  if (mode === 'before' || mode === 'after') {
    const referenceId = refEl ? refEl.value : '';
    if (!referenceId) return { error: '请选择要插入到哪道题目前后' };
    config.reference_question_id = referenceId;
  }
  return config;
}

async function loadQuestionnaireSettings() {
  try {
    const settings = await apiGet('/admin/questionnaire-settings');
    cachedQuestionnaireSettings = normalizeQuestionnaireSettings(settings);
    const titleEl = document.getElementById('qs_title');
    const introEl = document.getElementById('qs_intro_text');
    const startEl = document.getElementById('qs_start_button_text');
    const completionEl = document.getElementById('qs_completion_text');
    if (titleEl) titleEl.value = cachedQuestionnaireSettings.title || '';
    if (introEl) introEl.value = cachedQuestionnaireSettings.intro_text || '';
    if (startEl) startEl.value = cachedQuestionnaireSettings.start_button_text || '';
    if (completionEl) completionEl.value = cachedQuestionnaireSettings.completion_text || '';
    renderInstructionBlocks();
  } catch (e) {
    adminToast('指导语加载失败: ' + e.message);
  }
}

function normalizeQuestionnaireSettings(settings) {
  settings = settings || {};
  return {
    title: settings.title || '',
    intro_text: settings.intro_text || '',
    start_button_text: settings.start_button_text || '',
    completion_text: settings.completion_text || '',
    instruction_blocks: Array.isArray(settings.instruction_blocks) ? settings.instruction_blocks.map(function (block, idx) {
      return {
        block_id: block.block_id || ('instruction_' + String(idx + 1).padStart(3, '0')),
        title: block.title || '',
        text: block.text || '',
        question_ids: Array.isArray(block.question_ids) ? block.question_ids : [],
        is_active: block.is_active !== false
      };
    }) : []
  };
}

function collectQuestionnaireSettingsFromForm() {
  cachedQuestionnaireSettings.title = document.getElementById('qs_title').value.trim();
  cachedQuestionnaireSettings.intro_text = document.getElementById('qs_intro_text').value.trim();
  cachedQuestionnaireSettings.start_button_text = document.getElementById('qs_start_button_text').value.trim();
  cachedQuestionnaireSettings.completion_text = document.getElementById('qs_completion_text').value.trim();
  cachedQuestionnaireSettings.instruction_blocks = cachedQuestionnaireSettings.instruction_blocks || [];
  return cachedQuestionnaireSettings;
}

async function adminSaveQuestionnaireSettings() {
  const data = collectQuestionnaireSettingsFromForm();

  try {
    await apiPut('/admin/questionnaire-settings', data);
    adminToast('指导语已保存');
  } catch (e) {
    adminToast('指导语保存失败: ' + e.message);
  }
}

function renderInstructionBlocks() {
  const tbody = document.getElementById('instructionTableBody');
  if (!tbody) return;
  const blocks = cachedQuestionnaireSettings.instruction_blocks || [];
  if (blocks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">暂无指导语组</td></tr>';
    return;
  }
  tbody.innerHTML = blocks.map(function (block) {
    const status = block.is_active !== false ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
    const questionIds = (block.question_ids || []).join(', ');
    const actions = block.is_active !== false
      ? '<button class="admin-btn sm" onclick="showInstructionForm(\'' + esc(block.block_id) + '\')">编辑</button> <button class="admin-btn sm danger" onclick="adminDeactivateInstructionBlock(\'' + esc(block.block_id) + '\')">停用</button>'
      : '<button class="admin-btn sm" onclick="showInstructionForm(\'' + esc(block.block_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminRestoreInstructionBlock(\'' + esc(block.block_id) + '\')">恢复</button>';
    return '<tr><td>' + esc(block.block_id) + '</td><td>' + esc(block.title || '-') + '</td><td style="max-width:320px;word-break:break-all;">' + esc(questionIds || '-') + '</td><td>' + status + '</td><td>' + actions + '</td></tr>';
  }).join('');
}

function nextInstructionBlockId() {
  let maxNum = 0;
  (cachedQuestionnaireSettings.instruction_blocks || []).forEach(function (block) {
    const m = String(block.block_id || '').match(/^instruction_(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return 'instruction_' + String(maxNum + 1).padStart(3, '0');
}

function parseInstructionQuestionIds(text) {
  return String(text || '')
    .split(/[\s,，;；]+/)
    .map(function (id) { return id.trim(); })
    .filter(Boolean)
    .filter(function (id, idx, arr) { return arr.indexOf(id) === idx; });
}

function showInstructionForm(blockId) {
  const form = document.getElementById('instructionForm');
  if (!form) return;
  form.style.display = 'block';
  editingInstructionBlockId = blockId;

  document.getElementById('instructionFormTitle').textContent = blockId ? '编辑指导语组' : '新增指导语组';
  document.getElementById('qif_id').value = blockId || nextInstructionBlockId();
  document.getElementById('qif_id').readOnly = !!blockId;
  document.getElementById('qif_title').value = '';
  document.getElementById('qif_text').value = '';
  document.getElementById('qif_question_ids').value = '';
  document.getElementById('qif_active').checked = true;

  if (blockId) {
    const block = (cachedQuestionnaireSettings.instruction_blocks || []).find(function (item) {
      return item.block_id === blockId;
    });
    if (block) {
      document.getElementById('qif_title').value = block.title || '';
      document.getElementById('qif_text').value = block.text || '';
      document.getElementById('qif_question_ids').value = (block.question_ids || []).join('\n');
      document.getElementById('qif_active').checked = block.is_active !== false;
    }
  }
}

function cancelInstructionForm() {
  const form = document.getElementById('instructionForm');
  if (form) form.style.display = 'none';
}

async function adminSaveInstructionBlock() {
  const blockId = document.getElementById('qif_id').value.trim();
  const text = document.getElementById('qif_text').value.trim();
  const questionIds = parseInstructionQuestionIds(document.getElementById('qif_question_ids').value);
  if (!blockId) { adminToast('指导语组 ID 不能为空'); return; }
  if (!text) { adminToast('指导语文本不能为空'); return; }
  if (questionIds.length === 0) { adminToast('请至少填写一个适用题号'); return; }

  const block = {
    block_id: blockId,
    title: document.getElementById('qif_title').value.trim(),
    text: text,
    question_ids: questionIds,
    is_active: document.getElementById('qif_active').checked
  };

  const blocks = cachedQuestionnaireSettings.instruction_blocks || [];
  const existingIndex = blocks.findIndex(function (item) { return item.block_id === blockId; });
  if (existingIndex !== -1 && !editingInstructionBlockId) {
    adminToast('指导语组 ID 已存在');
    return;
  }
  if (existingIndex !== -1) {
    blocks[existingIndex] = block;
  } else {
    blocks.push(block);
  }
  cachedQuestionnaireSettings.instruction_blocks = blocks;

  try {
    await adminSaveQuestionnaireSettings();
    cancelInstructionForm();
    renderInstructionBlocks();
  } catch (e) {
    adminToast('指导语组保存失败: ' + e.message);
  }
}

async function adminDeactivateInstructionBlock(blockId) {
  if (!confirm('确定停用指导语组 "' + blockId + '"？')) return;
  const block = (cachedQuestionnaireSettings.instruction_blocks || []).find(function (item) { return item.block_id === blockId; });
  if (!block) return;
  block.is_active = false;
  await adminSaveQuestionnaireSettings();
  renderInstructionBlocks();
}

async function adminRestoreInstructionBlock(blockId) {
  const block = (cachedQuestionnaireSettings.instruction_blocks || []).find(function (item) { return item.block_id === blockId; });
  if (!block) return;
  block.is_active = true;
  await adminSaveQuestionnaireSettings();
  renderInstructionBlocks();
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

function ensureQuestionFormEnhancements() {
  const textEl = document.getElementById('qf_text');
  if (textEl && !document.getElementById('qf_image_url')) {
    const row = document.createElement('div');
    row.className = 'admin-form-row';
    row.innerHTML = '<label>题目图片 URL/路径</label><input id="qf_image_url" class="admin-input" placeholder="https://... 或 assets/images/xxx.jpg">';
    const parentRow = textEl.closest('.admin-form-row');
    if (parentRow && parentRow.parentNode) {
      parentRow.parentNode.insertBefore(row, parentRow.nextSibling);
    }
  }

  const typeEl = document.getElementById('qf_type');
  if (typeEl && !typeEl.dataset.singleChoiceReady) {
    const current = typeEl.value || 'likert';
    typeEl.innerHTML = [
      '<option value="likert">likert</option>',
      '<option value="single_choice">single_choice（单选，一行一个选项）</option>',
      '<option value="multiple_choice">multiple_choice（兼容旧数据，按单选显示）</option>',
      '<option value="text_input">text_input（填空题）</option>'
    ].join('');
    typeEl.value = current;
    typeEl.dataset.singleChoiceReady = '1';
  }
}

function showQuestionForm(questionId) {
  const form = document.getElementById('questionForm');
  form.style.display = 'block';
  ensureQuestionFormEnhancements();
  editingQuestionId = questionId;

  document.getElementById('questionFormTitle').textContent = questionId ? '编辑题目' : '新增题目';

  // Reset
  document.getElementById('qf_options').innerHTML = '';
  document.getElementById('qf_id').value = '';
  document.getElementById('qf_text').value = '';
  if (document.getElementById('qf_image_url')) document.getElementById('qf_image_url').value = '';
  document.getElementById('qf_type').value = 'likert';
  document.getElementById('qf_required').checked = true;
  document.getElementById('qf_reverse').checked = false;
  document.getElementById('qf_active').checked = true;
  document.getElementById('qf_scale_min').value = '1';
  document.getElementById('qf_scale_max').value = '5';
  document.getElementById('qf_order').value = '1';
  document.getElementById('qf_page').value = '1';
  document.getElementById('qf_note').value = '';
  const blockSelect = document.getElementById('qf_block_id');
  if (blockSelect) {
    const currentBlockId = currentQuestionBlockId();
    blockSelect.value = currentBlockId || '';
  }
  const insertModeEl = document.getElementById('qf_insert_mode');
  if (insertModeEl) insertModeEl.value = questionId ? '' : (currentQuestionBlockId() ? 'append' : '');
  const insertQuestionEl = document.getElementById('qf_insert_question_id');
  if (insertQuestionEl) insertQuestionEl.innerHTML = '<option value="">无需选择参考题目</option>';
  refreshQuestionInsertOptions();

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
    if (document.getElementById('qf_image_url')) {
      document.getElementById('qf_image_url').value = item.question_image_url || '';
    }
    document.getElementById('qf_type').value = item.question_type || 'likert';
    document.getElementById('qf_required').checked = item.required !== false;
    document.getElementById('qf_reverse').checked = item.reverse_scored === true;
    document.getElementById('qf_active').checked = item.is_active !== false;
    document.getElementById('qf_scale_min').value = item.scale_min || 1;
    document.getElementById('qf_scale_max').value = item.scale_max || 5;
    document.getElementById('qf_order').value = item.display_order || 1;
    document.getElementById('qf_page').value = item.page || Math.max(1, Math.ceil((item.display_order || 1) / 5));
    document.getElementById('qf_note').value = item.researcher_note || '';
    const blockSelect = document.getElementById('qf_block_id');
    if (blockSelect) blockSelect.value = currentQuestionBlockId() || '';
    const insertModeEl = document.getElementById('qf_insert_mode');
    if (insertModeEl) insertModeEl.value = '';
    refreshQuestionInsertOptions();

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
  const insertConfig = collectQuestionInsertConfig();
  if (insertConfig.error) { adminToast(insertConfig.error); return; }

  const data = {
    question_id: id,
    question_text: document.getElementById('qf_text').value.trim(),
    question_image_url: document.getElementById('qf_image_url') ? document.getElementById('qf_image_url').value.trim() : '',
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
  Object.assign(data, insertConfig);

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

async function adminDeleteQuestion(id) {
  if (!confirm('确定删除题目 "' + id + '"？删除后被试端不会再显示，可在“显示已删除”中恢复。')) return;
  try {
    await apiDelete('/admin/questionnaire/' + encodeURIComponent(id));
    adminToast('题目已删除');
    loadQuestionnaire();
  } catch (e) {
    adminToast('操作失败: ' + e.message);
  }
}

async function adminRestoreQuestion(id) {
  if (!confirm('确定恢复题目 "' + id + '"？恢复后被试端会重新显示。')) return;
  try {
    await apiPost('/admin/questionnaire/' + encodeURIComponent(id) + '/restore', {});
    adminToast('题目已恢复');
    loadQuestionnaire();
  } catch (e) {
    adminToast('恢复失败: ' + e.message);
  }
}

async function adminDeactivateQuestion(id) {
  return adminDeleteQuestion(id);
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

async function adminAddExistingQuestionToCurrentBlock() {
  const blockId = currentQuestionBlockId();
  if (!blockId) { adminToast('请先在“当前问卷组”里选择前测/后测等具体问卷组'); return; }
  const input = document.getElementById('existingQuestionIdInput');
  const questionId = input ? input.value.trim() : '';
  if (!questionId) { adminToast('请输入要加入的已有题号'); return; }
  const modeEl = document.getElementById('existingQuestionInsertMode');
  const refEl = document.getElementById('existingQuestionReferenceId');
  const mode = modeEl ? (modeEl.value || 'append') : 'append';
  const payload = {
    block_id: blockId,
    question_id: questionId,
    insert_mode: mode,
    page_size: 5
  };
  if (mode === 'before' || mode === 'after') {
    const referenceId = refEl ? refEl.value : '';
    if (!referenceId) { adminToast('请选择要插入到哪道题目前后'); return; }
    payload.reference_question_id = referenceId;
  }

  try {
    await apiPost('/admin/questionnaire-blocks/insert-question', payload);
    if (input) input.value = '';
    adminToast('题目已加入当前问卷组');
    loadQuestionnaire();
  } catch (e) {
    adminToast('加入失败: ' + e.message);
  }
}

async function adminRenumberCurrentQuestionBlock() {
  const blockId = currentQuestionBlockId();
  if (!blockId) { adminToast('请先选择具体问卷组，再执行当前组重排分页'); return; }
  if (!confirm('确定要按当前问卷组顺序重新编号并分页吗？')) return;

  try {
    await apiPost('/admin/questionnaire-blocks/reorder', {
      block_id: blockId,
      page_size: 5
    });
    adminToast('当前问卷组已重新编号并分页');
    loadQuestionnaire();
  } catch (e) {
    adminToast('重排失败: ' + e.message);
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
      const gameA = normalizeAdminGameKey(a.game_key);
      const gameB = normalizeAdminGameKey(b.game_key);
      if (gameA !== gameB) return gameA.localeCompare(gameB);
      return (a.display_order || a.scene_order || 0) - (b.display_order || b.scene_order || 0);
    });
    tbody.innerHTML = cachedScenes.map(s => {
      const status = s.is_active !== false ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
      const gameLabel = s.game_title || defaultAdminGameTitle(s.game_key);
      return '<tr><td>' + esc(s.scene_id) + '</td><td>' + esc(gameLabel || '-') + '</td><td>' + esc(s.scene_title || '-') + '</td><td>' + (s.scene_order || '-') + '</td><td>' + esc(s.dimension_name || '-') + '</td><td>' + (s.reverse_scored ? '✅' : '') + '</td><td>' + (s.options ? s.options.length : 0) + '</td><td>' + status + '</td><td><button class="admin-btn sm" onclick="showSceneForm(\'' + esc(s.scene_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminCopyScene(\'' + esc(s.scene_id) + '\')">复制</button> <button class="admin-btn sm danger" onclick="adminDeactivateScene(\'' + esc(s.scene_id) + '\')">停用</button></td></tr>';
    }).join('');
    if (scenes.length === 0) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#999;">暂无数据</td></tr>';
    refreshSceneInsertOptions();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="9" style="color:#e74c3c;">加载失败: ' + e.message + '</td></tr>';
  }
}

function normalizeAdminGameKey(key) {
  key = String(key || '').trim().toLowerCase();
  key = key.replace(/\s+/g, '_');
  if (!key) return 'game_a';
  if (key === 'a' || key === 'gamea') return 'game_a';
  if (key === 'game_b' || key === 'b' || key === 'gameb') return 'game_b';
  return key;
}

function defaultAdminGameTitle(key) {
  const normalized = normalizeAdminGameKey(key);
  if (normalized !== 'game_a' && normalized !== 'game_b') return normalized;
  return normalizeAdminGameKey(key) === 'game_b' ? '情景游戏B' : '情景游戏A';
}

function syncSceneGameTitle() {
  const keyEl = document.getElementById('sf_game_key');
  const titleEl = document.getElementById('sf_game_title');
  if (!keyEl || !titleEl) return;
  const current = titleEl.value.trim();
  if (!current || current === '情景游戏A' || current === '情景游戏B') {
    titleEl.value = defaultAdminGameTitle(keyEl.value);
  }
}

function ensureSceneGameKeyInput() {
  const keyEl = document.getElementById('sf_game_key');
  if (!keyEl || keyEl.tagName === 'INPUT') return;
  const input = document.createElement('input');
  input.id = 'sf_game_key';
  input.className = 'admin-input';
  input.placeholder = 'game_a / game_b / game_c';
  input.value = keyEl.value || 'game_a';
  input.onchange = function () {
    syncSceneGameTitle();
    refreshSceneInsertOptions();
  };
  keyEl.parentNode.replaceChild(input, keyEl);
}

function nextSceneId(scenes) {
  let maxNum = 0;
  (scenes || []).forEach(scene => {
    const m = String(scene.scene_id || '').match(/^scene_(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return 'scene_' + String(maxNum + 1).padStart(3, '0');
}

function sceneOrderValue(scene) {
  return parseInt(scene.scene_order || scene.display_order, 10) || 999999;
}

function sceneInsertOptionLabel(scene) {
  return (scene.scene_order || scene.display_order || '-') + '. ' +
    (scene.scene_title || scene.scene_id || '-') +
    '（' + (scene.scene_id || '-') + '）';
}

function refreshSceneInsertOptions() {
  const modeEl = document.getElementById('sf_insert_mode');
  const refEl = document.getElementById('sf_insert_scene_id');
  const keyEl = document.getElementById('sf_game_key');
  if (!modeEl || !refEl || !keyEl) return;

  const mode = modeEl.value || '';
  const needsReference = mode === 'before' || mode === 'after';
  const gameKey = normalizeAdminGameKey(keyEl.value || 'game_a');
  const currentId = document.getElementById('sf_id') ? document.getElementById('sf_id').value.trim() : '';
  const options = (cachedScenes || [])
    .filter(function (scene) {
      return normalizeAdminGameKey(scene.game_key || 'game_a') === gameKey &&
        scene.scene_id !== currentId &&
        scene.is_active !== false;
    })
    .sort(function (a, b) {
      return sceneOrderValue(a) - sceneOrderValue(b);
    });

  refEl.disabled = !needsReference;
  refEl.innerHTML = needsReference
    ? options.map(function (scene) {
        return '<option value="' + esc(scene.scene_id || '') + '">' + esc(sceneInsertOptionLabel(scene)) + '</option>';
      }).join('')
    : '<option value="">无需选择参考情景</option>';

  if (needsReference && !options.length) {
    refEl.innerHTML = '<option value="">当前游戏暂无可参考情景</option>';
  }
}

function collectSceneInsertConfig() {
  const modeEl = document.getElementById('sf_insert_mode');
  const refEl = document.getElementById('sf_insert_scene_id');
  if (!modeEl) return {};

  let mode = modeEl.value || '';
  if (!editingSceneId && !mode) mode = 'append';
  if (!mode) return {};

  const config = { insert_mode: mode };
  if (mode === 'before' || mode === 'after') {
    const referenceId = refEl ? refEl.value : '';
    if (!referenceId) {
      return { error: '请选择要插入到哪个情景前后' };
    }
    config.insert_scene_id = referenceId;
  }
  return config;
}

// ——— Scene Form ———

let editingSceneId = null;

function showSceneForm(sceneId) {
  const form = document.getElementById('sceneForm');
  form.style.display = 'block';
  ensureSceneGameKeyInput();
  editingSceneId = sceneId;

  document.getElementById('sceneFormTitle').textContent = sceneId ? '编辑情景' : '新增情景';

  // Reset
  document.getElementById('sf_options').innerHTML = '';
  document.getElementById('sf_id').value = '';
  document.getElementById('sf_title').value = '';
  document.getElementById('sf_game_key').value = 'game_a';
  document.getElementById('sf_game_title').value = '情景游戏A';
  document.getElementById('sf_order').value = '1';
  document.getElementById('sf_text').value = '';
  document.getElementById('sf_question_text').value = '';
  document.getElementById('sf_reverse').checked = false;
  document.getElementById('sf_active').checked = true;
  document.getElementById('sf_bg').value = '';
  document.getElementById('sf_display_order').value = '1';
  document.getElementById('sf_note').value = '';
  document.getElementById('sf_dim_code').value = '';
  const insertModeEl = document.getElementById('sf_insert_mode');
  if (insertModeEl) insertModeEl.value = sceneId ? '' : 'append';
  const insertSceneEl = document.getElementById('sf_insert_scene_id');
  if (insertSceneEl) insertSceneEl.innerHTML = '<option value="">无需选择参考情景</option>';
  refreshSceneInsertOptions();

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
    document.getElementById('sf_game_key').value = normalizeAdminGameKey(scene.game_key);
    document.getElementById('sf_game_title').value = scene.game_title || defaultAdminGameTitle(scene.game_key);
    document.getElementById('sf_order').value = scene.scene_order || 1;
    document.getElementById('sf_text').value = scene.scene_text || '';
    document.getElementById('sf_question_text').value = scene.question_text || '';
    document.getElementById('sf_reverse').checked = scene.reverse_scored === true;
    document.getElementById('sf_active').checked = scene.is_active !== false;
    document.getElementById('sf_bg').value = scene.background_image_url || '';
    document.getElementById('sf_display_order').value = scene.display_order || 1;
    document.getElementById('sf_note').value = scene.researcher_note || '';
    const insertModeEl = document.getElementById('sf_insert_mode');
    if (insertModeEl) insertModeEl.value = '';
    refreshSceneInsertOptions();

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
  const insertConfig = collectSceneInsertConfig();
  if (insertConfig.error) { adminToast(insertConfig.error); return; }

  const data = {
    scene_id: id,
    game_key: document.getElementById('sf_game_key').value,
    game_title: document.getElementById('sf_game_title').value.trim() || defaultAdminGameTitle(document.getElementById('sf_game_key').value),
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
  Object.assign(data, insertConfig);

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

async function adminRenumberScenes() {
  if (!confirm('确定要按当前所属游戏内的顺序一键重新编号吗？')) return;
  try {
    await apiPost('/admin/game-scenes/reorder', {});
    adminToast('情景顺序已重新编号');
    loadScenes();
  } catch (e) {
    adminToast('重新编号失败: ' + e.message);
  }
}

async function adminCopyScene(id) {
  try {
    const scenes = cachedScenes.length ? cachedScenes : await apiGet('/admin/game-scenes');
    const source = scenes.find(scene => scene.scene_id === id);
    if (!source) { adminToast('未找到要复制的情景'); return; }

    const newId = nextSceneId(scenes);
    const copy = JSON.parse(JSON.stringify(source));
    copy.scene_id = newId;
    copy.scene_title = (copy.scene_title || '') + '（副本）';
    copy.scene_order = (parseInt(source.scene_order || source.display_order, 10) || 0) + 1;
    copy.display_order = copy.scene_order;
    copy.insert_mode = 'after';
    copy.insert_scene_id = id;
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
// Experiment Flow
// ============================================================

async function loadExperimentFlowAdmin() {
  ensureFlowAdminTab();
  try {
    const results = await Promise.all([
      apiGet('/admin/questionnaire-blocks'),
      apiGet('/admin/experiment-flow'),
      apiGet('/admin/questionnaire'),
      apiGet('/admin/game-scenes')
    ]);
    cachedQuestionnaireBlocks = normalizeQuestionnaireBlocks(results[0]);
    cachedExperimentFlow = normalizeExperimentFlow(results[1]);
    cachedQuestionnaireItems = normalizeQuestionnairePages(results[2] || []);
    cachedScenes = results[3] || [];

    const enabledEl = document.getElementById('flow_enabled');
    const completeEl = document.getElementById('flow_complete_text');
    if (enabledEl) enabledEl.checked = cachedExperimentFlow.enabled === true;
    if (completeEl) completeEl.value = cachedExperimentFlow.complete_text || '全部体验结束，感谢您的参与！';
    renderQuestionnaireBlockTable();
    renderFlowStepTable();
  } catch (e) {
    adminToast('实验流程加载失败: ' + e.message);
  }
}

function normalizeQuestionnaireBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(function (block, idx) {
    return {
      block_id: block.block_id || ('questionnaire_block_' + String(idx + 1).padStart(3, '0')),
      title: block.title || '',
      intro_text: block.intro_text || '',
      start_button_text: block.start_button_text || '',
      completion_text: block.completion_text || '',
      question_ids: Array.isArray(block.question_ids) ? block.question_ids : [],
      is_active: block.is_active !== false
    };
  });
}

function normalizeExperimentFlow(flow) {
  flow = flow || {};
  return {
    enabled: flow.enabled === true,
    complete_text: flow.complete_text || '全部体验结束，感谢您的参与！',
    steps: Array.isArray(flow.steps) ? flow.steps.map(function (step, idx) {
      return {
        step_id: step.step_id || ('step_' + String(idx + 1).padStart(3, '0')),
        type: step.type || 'questionnaire',
        label: step.label || '',
        block_id: step.block_id || 'main_questionnaire',
        game_keys: Array.isArray(step.game_keys) ? step.game_keys : [],
        order_mode: step.order_mode || 'fixed',
        post_questionnaire_block_id: step.post_questionnaire_block_id || '',
        report_after_each: false,
        is_active: step.is_active !== false
      };
    }) : []
  };
}

function parseAdminIdList(text) {
  return String(text || '')
    .split(/[\s,，;；]+/)
    .map(function (id) { return id.trim(); })
    .filter(Boolean)
    .filter(function (id, idx, arr) { return arr.indexOf(id) === idx; });
}

function getAvailableAdminGameKeys() {
  const keys = [];
  (cachedScenes || []).forEach(function (scene) {
    const key = normalizeAdminGameKey(scene.game_key || 'game_a');
    if (keys.indexOf(key) === -1) keys.push(key);
  });
  return keys.length ? keys : ['game_a', 'game_b'];
}

function questionnaireBlockCountText(block) {
  if (block && block.question_ids && block.question_ids.length) {
    return String(block.question_ids.length);
  }
  if (block && block.block_id === 'main_questionnaire') {
    return 'q_001-q_163';
  }
  return '全部启用题目';
}

function blockOptionsHtml(selected, includeEmpty) {
  let html = includeEmpty ? '<option value="">不添加故事后问卷</option>' : '';
  html += (cachedQuestionnaireBlocks || []).filter(function (block) {
    return block.is_active !== false;
  }).map(function (block) {
    const value = esc(block.block_id);
    const label = esc((block.title || block.block_id) + ' (' + block.block_id + ', ' + questionnaireBlockCountText(block) + ')');
    return '<option value="' + value + '"' + (block.block_id === selected ? ' selected' : '') + '>' + label + '</option>';
  }).join('');
  return html;
}

function renderQuestionnaireBlockTable() {
  const tbody = document.getElementById('questionnaireBlockTableBody');
  if (!tbody) return;
  if (!cachedQuestionnaireBlocks.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">暂无问卷块</td></tr>';
    return;
  }
  tbody.innerHTML = cachedQuestionnaireBlocks.map(function (block) {
    const countText = questionnaireBlockCountText(block);
    const status = block.is_active !== false ? '<span class="status-badge completed">启用</span>' : '<span class="status-badge abandoned">停用</span>';
    return '<tr><td>' + esc(block.block_id) + '</td><td>' + esc(block.title || '-') + '</td><td>' + esc(String(countText)) + '</td><td>' + status + '</td><td><button class="admin-btn sm" onclick="showQuestionnaireBlockForm(\'' + esc(block.block_id) + '\')">编辑</button> <button class="admin-btn sm" onclick="adminCopyQuestionnaireBlock(\'' + esc(block.block_id) + '\')">复制</button> <button class="admin-btn sm danger" onclick="adminDeactivateQuestionnaireBlock(\'' + esc(block.block_id) + '\')">停用</button></td></tr>';
  }).join('');
}

function nextQuestionnaireBlockId() {
  let maxNum = 0;
  cachedQuestionnaireBlocks.forEach(function (block) {
    const m = String(block.block_id || '').match(/^questionnaire_block_(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return 'questionnaire_block_' + String(maxNum + 1).padStart(3, '0');
}

function showQuestionnaireBlockForm(blockId) {
  const form = document.getElementById('questionnaireBlockForm');
  if (!form) return;
  form.style.display = 'block';
  editingQuestionnaireBlockId = blockId;
  document.getElementById('questionnaireBlockFormTitle').textContent = blockId ? '编辑问卷块' : '新增问卷块';
  document.getElementById('qbf_id').value = blockId || nextQuestionnaireBlockId();
  document.getElementById('qbf_id').readOnly = !!blockId;
  document.getElementById('qbf_title').value = '';
  document.getElementById('qbf_intro_text').value = '';
  document.getElementById('qbf_start_button_text').value = '';
  document.getElementById('qbf_completion_text').value = '';
  document.getElementById('qbf_question_ids').value = '';
  document.getElementById('qbf_active').checked = true;

  const block = cachedQuestionnaireBlocks.find(function (item) { return item.block_id === blockId; });
  if (block) {
    document.getElementById('qbf_title').value = block.title || '';
    document.getElementById('qbf_intro_text').value = block.intro_text || '';
    document.getElementById('qbf_start_button_text').value = block.start_button_text || '';
    document.getElementById('qbf_completion_text').value = block.completion_text || '';
    document.getElementById('qbf_question_ids').value = (block.question_ids || []).join('\n');
    document.getElementById('qbf_active').checked = block.is_active !== false;
  }
}

function cancelQuestionnaireBlockForm() {
  const form = document.getElementById('questionnaireBlockForm');
  if (form) form.style.display = 'none';
}

async function adminSaveQuestionnaireBlock() {
  const blockId = document.getElementById('qbf_id').value.trim();
  if (!blockId) { adminToast('block_id 不能为空'); return; }
  const block = {
    block_id: blockId,
    title: document.getElementById('qbf_title').value.trim(),
    intro_text: document.getElementById('qbf_intro_text').value.trim(),
    start_button_text: document.getElementById('qbf_start_button_text').value.trim(),
    completion_text: document.getElementById('qbf_completion_text').value.trim(),
    question_ids: parseAdminIdList(document.getElementById('qbf_question_ids').value),
    is_active: document.getElementById('qbf_active').checked
  };
  const idx = cachedQuestionnaireBlocks.findIndex(function (item) { return item.block_id === blockId; });
  if (idx !== -1 && !editingQuestionnaireBlockId) {
    adminToast('block_id 已存在');
    return;
  }
  // 先调用 API，成功后再更新本地缓存
  const tempBlocks = idx !== -1
    ? cachedQuestionnaireBlocks.map(function (item, i) { return i === idx ? block : item; })
    : cachedQuestionnaireBlocks.concat([block]);
  try {
    await apiPut('/admin/questionnaire-blocks', { blocks: tempBlocks });
    cachedQuestionnaireBlocks = tempBlocks;
    adminToast('问卷块已保存');
    renderQuestionnaireBlockTable();
    renderFlowStepTable();
    cancelQuestionnaireBlockForm();
  } catch (e) {
    adminToast('保存失败: ' + e.message);
  }
}

async function adminCopyQuestionnaireBlock(blockId) {
  const source = cachedQuestionnaireBlocks.find(function (item) { return item.block_id === blockId; });
  if (!source) return;
  const copy = JSON.parse(JSON.stringify(source));
  copy.block_id = nextQuestionnaireBlockId();
  copy.title = (copy.title || copy.block_id) + '（副本）';
  copy.is_active = true;
  const tempBlocks = cachedQuestionnaireBlocks.concat([copy]);
  try {
    await apiPut('/admin/questionnaire-blocks', { blocks: tempBlocks });
    cachedQuestionnaireBlocks = tempBlocks;
    adminToast('问卷块已复制');
    renderQuestionnaireBlockTable();
    renderFlowStepTable();
  } catch (e) {
    adminToast('复制失败: ' + e.message);
  }
}

async function adminDeactivateQuestionnaireBlock(blockId) {
  const source = cachedQuestionnaireBlocks.find(function (item) { return item.block_id === blockId; });
  if (!source) return;
  const tempBlocks = cachedQuestionnaireBlocks.map(function (item) {
    return item.block_id === blockId ? Object.assign({}, item, { is_active: false }) : item;
  });
  try {
    await apiPut('/admin/questionnaire-blocks', { blocks: tempBlocks });
    source.is_active = false;
    adminToast('问卷块已停用');
    renderQuestionnaireBlockTable();
    renderFlowStepTable();
  } catch (e) {
    adminToast('停用失败: ' + e.message);
  }
}

function renderFlowStepTable() {
  const tbody = document.getElementById('flowStepTableBody');
  if (!tbody || !cachedExperimentFlow) return;
  const steps = cachedExperimentFlow.steps || [];
  if (!steps.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">暂无流程步骤</td></tr>';
    return;
  }
  tbody.innerHTML = steps.map(function (step, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + flowTypeSelectHtml(idx, step.type) + '</td>' +
      '<td><input class="admin-input admin-input-sm" value="' + esc(step.label || '') + '" onchange="adminUpdateFlowStep(' + idx + ', \'label\', this.value)"></td>' +
      '<td>' + flowConfigHtml(idx, step) + '</td>' +
      '<td><input type="checkbox" ' + (step.is_active !== false ? 'checked' : '') + ' onchange="adminUpdateFlowStep(' + idx + ', \'is_active\', this.checked)"></td>' +
      '<td><button class="admin-btn sm" onclick="adminMoveFlowStep(' + idx + ', -1)">上移</button> <button class="admin-btn sm" onclick="adminMoveFlowStep(' + idx + ', 1)">下移</button> <button class="admin-btn sm danger" onclick="adminDeleteFlowStep(' + idx + ')">删除</button></td>' +
    '</tr>';
  }).join('');
}

function flowTypeSelectHtml(idx, type) {
  const options = [
    ['questionnaire', '问卷'],
    ['game_group', '故事组'],
    ['game', '单个故事'],
    ['complete', '结束']
  ];
  return '<select class="admin-select" onchange="adminUpdateFlowStep(' + idx + ', \'type\', this.value)">' +
    options.map(function (opt) {
      return '<option value="' + opt[0] + '"' + (opt[0] === type ? ' selected' : '') + '>' + opt[1] + '</option>';
    }).join('') + '</select>';
}

function flowConfigHtml(idx, step) {
  if (step.type === 'questionnaire') {
    return '<label>问卷块</label><select class="admin-select" onchange="adminUpdateFlowStep(' + idx + ', \'block_id\', this.value)">' + blockOptionsHtml(step.block_id, false) + '</select>';
  }
  if (step.type === 'game' || step.type === 'game_group') {
    const keys = (step.game_keys && step.game_keys.length ? step.game_keys : getAvailableAdminGameKeys()).join('\n');
    return [
      '<label>故事 key（每行一个）</label>',
      '<textarea class="admin-textarea" rows="3" onchange="adminUpdateFlowStep(' + idx + ', \'game_keys\', this.value)">' + esc(keys) + '</textarea>',
      '<label>随机规则</label>',
      '<select class="admin-select" onchange="adminUpdateFlowStep(' + idx + ', \'order_mode\', this.value)">',
        '<option value="fixed"' + (step.order_mode === 'fixed' ? ' selected' : '') + '>固定顺序</option>',
        '<option value="random"' + (step.order_mode === 'random' ? ' selected' : '') + '>完全随机</option>',
        '<option value="counterbalanced"' + (step.order_mode === 'counterbalanced' ? ' selected' : '') + '>对半/均衡</option>',
      '</select>',
      '<label>每个故事后问卷</label>',
      '<select class="admin-select" onchange="adminUpdateFlowStep(' + idx + ', \'post_questionnaire_block_id\', this.value)">' + blockOptionsHtml(step.post_questionnaire_block_id, true) + '</select>'
    ].join('');
  }
  return '<span style="color:#999;">完成后显示最终结束语</span>';
}

function adminUpdateFlowStep(idx, field, value) {
  const step = cachedExperimentFlow.steps[idx];
  if (!step) return;
  if (field === 'type') {
    step.type = value;
    if (value === 'questionnaire' && !step.block_id) step.block_id = 'main_questionnaire';
    if ((value === 'game' || value === 'game_group') && (!step.game_keys || !step.game_keys.length)) step.game_keys = getAvailableAdminGameKeys();
  } else if (field === 'game_keys') {
    step.game_keys = parseAdminIdList(value).map(normalizeAdminGameKey);
  } else {
    step[field] = value;
  }
  renderFlowStepTable();
}

function nextFlowStepId(type) {
  const prefix = type || 'step';
  let maxNum = 0;
  (cachedExperimentFlow.steps || []).forEach(function (step) {
    const m = String(step.step_id || '').match(new RegExp('^' + prefix + '_(\\d+)$'));
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return prefix + '_' + String(maxNum + 1).padStart(3, '0');
}

function adminAddFlowQuestionnaireStep() {
  cachedExperimentFlow.steps.push({
    step_id: nextFlowStepId('questionnaire'),
    type: 'questionnaire',
    label: '问卷',
    block_id: 'main_questionnaire',
    is_active: true
  });
  renderFlowStepTable();
}

function adminAddFlowGameGroupStep() {
  cachedExperimentFlow.steps.push({
    step_id: nextFlowStepId('game_group'),
    type: 'game_group',
    label: '故事组',
    game_keys: getAvailableAdminGameKeys(),
    order_mode: 'counterbalanced',
    post_questionnaire_block_id: '',
    report_after_each: false,
    is_active: true
  });
  renderFlowStepTable();
}

function adminAddFlowCompleteStep() {
  cachedExperimentFlow.steps.push({
    step_id: nextFlowStepId('complete'),
    type: 'complete',
    label: '结束',
    is_active: true
  });
  renderFlowStepTable();
}

function adminMoveFlowStep(idx, direction) {
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= cachedExperimentFlow.steps.length) return;
  const steps = cachedExperimentFlow.steps;
  const temp = steps[idx];
  steps[idx] = steps[nextIdx];
  steps[nextIdx] = temp;
  renderFlowStepTable();
}

function adminDeleteFlowStep(idx) {
  cachedExperimentFlow.steps.splice(idx, 1);
  renderFlowStepTable();
}

async function adminSaveExperimentFlow() {
  if (!cachedExperimentFlow) cachedExperimentFlow = normalizeExperimentFlow({});
  cachedExperimentFlow.enabled = document.getElementById('flow_enabled').checked;
  cachedExperimentFlow.complete_text = document.getElementById('flow_complete_text').value.trim() || '全部体验结束，感谢您的参与！';
  try {
    await apiPut('/admin/experiment-flow', cachedExperimentFlow);
    adminToast('实验流程已保存');
    loadExperimentFlowAdmin();
  } catch (e) {
    adminToast('实验流程保存失败: ' + e.message);
  }
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
        'game_in_progress': '游戏进行中',
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
      ['game_order', (session.game_order || []).join(' → ')],
      ['completed_game_keys', (session.completed_game_keys || []).join(', ')],
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
      html += '<table class="admin-table"><thead><tr><th>步骤</th><th>问卷块</th><th>关联故事</th><th>题号</th><th>题目</th><th>回答</th><th>选项ID</th><th>原始分</th><th>最终分</th><th>维度</th><th>时间</th></tr></thead><tbody>';
      data.questionnaire_responses.forEach(r => {
        var answerText = '';
        if (r.question_type === 'text_input') {
          answerText = '📝 ' + esc(r.raw_answer_text || '（空）');
        } else {
          answerText = esc(r.selected_option_text || '');
        }
        html += '<tr><td>' + esc(r.step_id || '-') + '</td><td>' + esc(r.block_id || '-') + '</td><td>' + esc(r.game_title || r.game_key || '-') + '</td><td>' + esc(r.question_id) + '</td><td style="max-width:220px;word-break:break-all;">' + esc(r.question_text || '') + '</td><td style="max-width:200px;word-break:break-all;">' + answerText + '</td><td>' + esc(r.selected_option_id || '-') + '</td><td>' + (r.raw_score || 0) + '</td><td>' + (r.final_score != null ? r.final_score : '-') + '</td><td>' + esc(r.dimension_name || '-') + '</td><td style="font-size:11px;color:#888;">' + formatDateTime(r.answered_at) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="detail-section"><h3>📝 问卷作答</h3><div class="admin-loading">暂无问卷作答记录</div></div>';
    }

    // Game responses
    if (data.game_responses && data.game_responses.length > 0) {
      html += '<div class="detail-section"><h3>🎬 剧情作答 (' + data.game_responses.length + ' 条)</h3>';
      html += '<table class="admin-table"><thead><tr><th>所属游戏</th><th>场景</th><th>题目</th><th>选项</th><th>选项文本</th><th>原始分</th><th>最终分</th><th>维度</th><th>时间</th></tr></thead><tbody>';
      data.game_responses.forEach(r => {
        html += '<tr><td>' + esc(r.game_title || defaultAdminGameTitle(r.game_key)) + '</td><td>' + esc(r.scene_id) + '</td><td style="max-width:220px;word-break:break-all;">' + esc(r.question_text || '') + '</td><td>' + esc(r.selected_option_label || '') + '</td><td style="max-width:220px;word-break:break-all;">' + esc(r.selected_option_text || '') + '</td><td>' + (r.raw_score || 0) + '</td><td>' + (r.final_score || 0) + '</td><td>' + esc(r.dimension_name || '-') + '</td><td style="font-size:11px;color:#888;">' + formatDateTime(r.answered_at) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="detail-section"><h3>🎬 剧情作答</h3><div class="admin-loading">暂无剧情作答记录</div></div>';
    }

    if (data.game_reports && Object.keys(data.game_reports).length > 0) {
      html += '<div class="detail-section"><h3>📊 情景游戏独立报告</h3>';
      Object.keys(data.game_reports).forEach(key => {
        const report = data.game_reports[key] || {};
        const overall = report.overall_score || {};
        html += '<div style="margin:10px 0 14px;"><strong>' + esc(report.game_title || defaultAdminGameTitle(key)) + '</strong>';
        html += '<div class="detail-kv" style="margin-top:6px;">';
        html += '<span class="key">response_count</span><span class="value">' + (report.response_count || 0) + '</span>';
        html += '<span class="key">completed_at</span><span class="value">' + esc(formatDateTime(report.completed_at)) + '</span>';
        html += '<span class="key">overall_average</span><span class="value">' + (overall.total_average_score != null ? overall.total_average_score : '-') + '</span>';
        html += '</div></div>';
      });
      html += '</div>';
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
