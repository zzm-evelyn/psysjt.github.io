/* ============================================================
   storage.js — 数据持久化层
   优先调用后端 API，localStorage 作为缓存和离线回退
   ============================================================ */

const STORAGE_KEYS = {
  PARTICIPANT_ID: 'participant_id',
  PARTICIPANT_CODE: 'participant_code',
  EXTERNAL_ID: 'external_id',
  BACKEND_SESSION_ACTIVE: 'backend_session_active',
  START_TIME: 'start_time',
  QUESTIONNAIRE_START_TIME: 'questionnaire_start_time',
  QUESTIONNAIRE_END_TIME: 'questionnaire_end_time',
  QUESTIONNAIRE_COMPLETED: 'questionnaire_completed',
  GAME_START_TIME: 'game_start_time',
  GAME_END_TIME: 'game_end_time',
  GAME_COMPLETED: 'game_completed',
  GAME_ORDER: 'game_order',
  CURRENT_GAME_INDEX: 'current_game_index',
  COMPLETED_GAME_KEYS: 'completed_game_keys',
  GAME_REPORTS: 'game_reports',
  QUESTIONNAIRE_RESPONSES: 'questionnaire_responses',
  GAME_RESPONSES: 'game_responses',
  RESULT_SCORES: 'result_scores',
  FLOW_ENABLED: 'flow_enabled',
  FLOW_PLAN: 'flow_plan',
  CURRENT_FLOW_STEP: 'current_flow_step',
  CURRENT_FLOW_INDEX: 'current_flow_index',
  FLOW_COMPLETED_STEP_IDS: 'flow_completed_step_ids'
};

// ---- Helpers ----
function _getItem(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function _setItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function _removeItem(key) {
  localStorage.removeItem(key);
}

function _clearKeysByPrefix(prefix) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.indexOf(prefix) === 0) keys.push(key);
  }
  keys.forEach(key => _removeItem(key));
}

// ============================================================
// 参与者会话
// ============================================================

/**
 * 开始参与者会话 — 接受 customId 参数（被试自行输入的编号）
 * customId 只作为 external_id 交给后端保存，不再当作 participant_id。
 * 优先调用后端 API，回退到 localStorage
 * TODO: 后续可移除 localStorage 回退
 */
function applyParticipantSession(result, externalId) {
  _setItem(STORAGE_KEYS.PARTICIPANT_ID, result.participant_id);
  _setItem(STORAGE_KEYS.PARTICIPANT_CODE, result.participant_code || '');
  _setItem(STORAGE_KEYS.EXTERNAL_ID, result.external_id || externalId || '');
  _setItem(STORAGE_KEYS.BACKEND_SESSION_ACTIVE, true);
  _setItem(STORAGE_KEYS.START_TIME, result.start_time || new Date().toISOString());
  _setItem(STORAGE_KEYS.GAME_ORDER, normalizeGameOrder(result.game_order));
  _setItem(STORAGE_KEYS.CURRENT_GAME_INDEX, 0);
  _setItem(STORAGE_KEYS.COMPLETED_GAME_KEYS, result.completed_game_keys || []);
  _setItem(STORAGE_KEYS.GAME_REPORTS, result.game_reports || {});
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES, result.questionnaire_responses || []);
  _setItem(STORAGE_KEYS.GAME_RESPONSES, result.game_responses || []);
  _setItem(STORAGE_KEYS.FLOW_ENABLED, result.flow_enabled === true);
  _setItem(STORAGE_KEYS.CURRENT_FLOW_STEP, result.current_step || null);
  _setItem(STORAGE_KEYS.CURRENT_FLOW_INDEX, result.current_flow_index || 0);
  _setItem(STORAGE_KEYS.FLOW_COMPLETED_STEP_IDS, result.flow_completed_step_ids || []);
  _setItem(STORAGE_KEYS.FLOW_PLAN, result.flow_plan || (result.current_step ? [result.current_step] : []));
  return result.participant_id;
}

async function startParticipantSession(customId, options) {
  options = options || {};
  const action = options.action ? String(options.action) : '';

  // 如果已有有效的后端会话，优先继续当前会话，避免刷新/重复点击生成多个空白记录。
  const existingId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (existingId && hasBackendSession() && action !== 'restart') return existingId;

  if (options.forceNew || action === 'restart') {
    clearParticipantData();
  }

  const externalId = customId && customId.trim() ? customId.trim() : '';

  // 尝试调用后端 API。成功后必须使用后端返回的 participant_id。
  try {
    const body = { external_id: externalId };
    if (action) body.action = action;
    const result = await apiPost('/participants/start', body);
    if (result.status === 'resume_available' || result.status === 'already_completed') {
      return result;
    }
    const readyParticipantId = applyParticipantSession(result, externalId);
    console.log('[storage] 后端参与者会话就绪:', result.status || 'created', readyParticipantId, result.participant_code || '');
    return readyParticipantId;
  } catch (e) {
    console.warn('[storage] 后端不可用，使用本地模式:', e.message);
  }

  // 回退：localStorage 本地生成
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const participantId = externalId || ('P_' + timestamp + '_' + random);

  _setItem(STORAGE_KEYS.PARTICIPANT_ID, participantId);
  _setItem(STORAGE_KEYS.PARTICIPANT_CODE, '');
  _setItem(STORAGE_KEYS.EXTERNAL_ID, externalId);
  _setItem(STORAGE_KEYS.BACKEND_SESSION_ACTIVE, false);
  _setItem(STORAGE_KEYS.START_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.GAME_ORDER, Math.random() < 0.5 ? ['game_a', 'game_b'] : ['game_b', 'game_a']);
  _setItem(STORAGE_KEYS.CURRENT_GAME_INDEX, 0);
  _setItem(STORAGE_KEYS.COMPLETED_GAME_KEYS, []);
  _setItem(STORAGE_KEYS.GAME_REPORTS, {});
  _setItem(STORAGE_KEYS.FLOW_ENABLED, false);
  _setItem(STORAGE_KEYS.CURRENT_FLOW_STEP, null);
  _setItem(STORAGE_KEYS.FLOW_PLAN, []);
  return participantId;
}

function hasBackendSession() {
  return _getItem(STORAGE_KEYS.BACKEND_SESSION_ACTIVE) === true;
}

function getParticipantLabel() {
  return _getItem(STORAGE_KEYS.EXTERNAL_ID) ||
    _getItem(STORAGE_KEYS.PARTICIPANT_CODE) ||
    _getItem(STORAGE_KEYS.PARTICIPANT_ID) ||
    '';
}

function normalizeGameKey(key) {
  key = String(key || '').trim().toLowerCase();
  key = key.replace(/\s+/g, '_');
  if (!key) return 'game_a';
  if (key === 'a' || key === 'gamea') return 'game_a';
  if (key === 'game_b' || key === 'b' || key === 'gameb') return 'game_b';
  return key;
}

function defaultGameTitle(key) {
  const normalized = normalizeGameKey(key);
  if (normalized !== 'game_a' && normalized !== 'game_b') return normalized;
  return normalizeGameKey(key) === 'game_b' ? '情景游戏B' : '情景游戏A';
}

function normalizeGameOrder(order) {
  if (!Array.isArray(order) || order.length === 0) return ['game_a', 'game_b'];
  const normalized = [];
  order.forEach(function (key) {
    const k = normalizeGameKey(key);
    if (normalized.indexOf(k) === -1) normalized.push(k);
  });
  return normalized.length ? normalized : ['game_a', 'game_b'];
}

async function ensureGameOrder() {
  let order = normalizeGameOrder(_getItem(STORAGE_KEYS.GAME_ORDER));
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);

  if (hasBackendSession() && participantId) {
    try {
      const result = await apiGet('/game/order/' + encodeURIComponent(participantId));
      order = normalizeGameOrder(result.game_order);
      _setItem(STORAGE_KEYS.GAME_ORDER, order);
      _setItem(STORAGE_KEYS.COMPLETED_GAME_KEYS, result.completed_game_keys || []);
    } catch (e) {
      console.warn('[storage] 获取游戏顺序失败，使用本地缓存:', e.message);
    }
  }
  return order;
}

function getCurrentGameIndex() {
  const idx = parseInt(_getItem(STORAGE_KEYS.CURRENT_GAME_INDEX), 10);
  return isNaN(idx) ? 0 : idx;
}

function setCurrentGameIndex(index) {
  _setItem(STORAGE_KEYS.CURRENT_GAME_INDEX, Math.max(0, parseInt(index, 10) || 0));
}

function getCompletedGameKeys() {
  const keys = _getItem(STORAGE_KEYS.COMPLETED_GAME_KEYS) || [];
  return keys.map(normalizeGameKey);
}

function markGameKeyCompleted(gameKey) {
  const key = normalizeGameKey(gameKey);
  const completed = getCompletedGameKeys();
  if (completed.indexOf(key) === -1) completed.push(key);
  _setItem(STORAGE_KEYS.COMPLETED_GAME_KEYS, completed);
  return completed;
}

function saveGameReport(gameKey, report) {
  const key = normalizeGameKey(gameKey);
  const reports = _getItem(STORAGE_KEYS.GAME_REPORTS) || {};
  reports[key] = report;
  _setItem(STORAGE_KEYS.GAME_REPORTS, reports);
  return reports;
}

async function getGameReports() {
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  let reports = _getItem(STORAGE_KEYS.GAME_REPORTS) || {};
  if (hasBackendSession() && participantId) {
    try {
      const result = await apiGet('/results/' + encodeURIComponent(participantId) + '/games');
      _setItem(STORAGE_KEYS.GAME_ORDER, normalizeGameOrder(result.game_order));
      _setItem(STORAGE_KEYS.COMPLETED_GAME_KEYS, result.completed_game_keys || []);
      reports = result.game_reports || {};
      _setItem(STORAGE_KEYS.GAME_REPORTS, reports);
    } catch (e) {
      console.warn('[storage] 后端获取游戏报告失败，使用本地缓存:', e.message);
    }
  }
  return reports;
}

// ============================================================
// Flow
// ============================================================

async function getCurrentFlow() {
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId || !hasBackendSession()) {
    return { flow_enabled: false, current_step: null, flow_plan: [] };
  }

  try {
    const result = await apiGet('/flow/current/' + encodeURIComponent(participantId));
    _setItem(STORAGE_KEYS.FLOW_ENABLED, result.flow_enabled === true);
    _setItem(STORAGE_KEYS.CURRENT_FLOW_STEP, result.current_step || null);
    _setItem(STORAGE_KEYS.CURRENT_FLOW_INDEX, result.current_flow_index || 0);
    _setItem(STORAGE_KEYS.FLOW_PLAN, result.flow_plan || []);
    _setItem(STORAGE_KEYS.FLOW_COMPLETED_STEP_IDS, result.flow_completed_step_ids || []);
    if (result.flow_enabled && Array.isArray(result.flow_plan)) {
      const gameOrder = result.flow_plan
        .filter(function (step) { return step && step.type === 'game' && step.game_key; })
        .map(function (step) { return normalizeGameKey(step.game_key); });
      if (gameOrder.length) _setItem(STORAGE_KEYS.GAME_ORDER, normalizeGameOrder(gameOrder));
    }
    return result;
  } catch (e) {
    console.warn('[storage] 鑾峰彇瀹為獙娴佺▼澶辫触锛屼娇鐢ㄦ棫娴佺▼:', e.message);
    return { flow_enabled: false, current_step: null, flow_plan: [] };
  }
}

async function completeFlowStep(stepId) {
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId || !hasBackendSession() || !stepId) {
    return { flow_enabled: false, next_step: null };
  }
  const result = await apiPost('/flow/complete-step', {
    participant_id: participantId,
    step_id: stepId
  });
  _setItem(STORAGE_KEYS.CURRENT_FLOW_STEP, result.next_step || null);
  return result;
}

function flowStepUrl(step) {
  if (!step || !step.type) return 'result.html?complete=1';
  const params = new URLSearchParams();
  if (step.step_id) params.set('step_id', step.step_id);
  if (step.block_id) params.set('block_id', step.block_id);
  if (step.game_key) params.set('game', normalizeGameKey(step.game_key));

  if (step.type === 'questionnaire') return 'questionnaire.html?' + params.toString();
  if (step.type === 'game') return 'game.html?' + params.toString();
  if (step.type === 'report') return 'result.html?' + params.toString();
  if (step.type === 'complete') return 'result.html?complete=1' + (step.step_id ? '&step_id=' + encodeURIComponent(step.step_id) : '');
  return 'result.html?complete=1';
}

function navigateToFlowStep(step) {
  navigateTo(flowStepUrl(step));
}

async function navigateToCurrentFlowOrFallback(fallbackUrl) {
  const flow = await getCurrentFlow();
  if (flow.flow_enabled && flow.current_step) {
    navigateToFlowStep(flow.current_step);
    return true;
  }
  navigateTo(fallbackUrl || 'questionnaire.html');
  return false;
}

// ============================================================
// 问卷
// ============================================================

/**
 * 保存单条问卷作答 — 先存 localStorage，再尝试提交到后端
 * 支持 text_input 类型（raw_answer_text）和 likert 类型（selected_option_id）
 * TODO: 后续可移除 localStorage
 */
async function saveQuestionnaireResponse(data) {
  data.participant_code = data.participant_code || _getItem(STORAGE_KEYS.PARTICIPANT_CODE) || '';
  data.external_id = data.external_id || _getItem(STORAGE_KEYS.EXTERNAL_ID) || '';
  // 始终保存到 localStorage（离线可用）
  const responses = _getItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES) || [];
  const contextKey = function (item) {
    return [
      item.question_id || '',
      item.step_id || '',
      item.block_id || '',
      normalizeGameKey(item.game_key || '')
    ].join('::');
  };
  const existingIndex = responses.findIndex(r => contextKey(r) === contextKey(data));
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES, responses);

  // 尝试提交到后端。正式在线会话中必须等后端确认，避免后台看不到。
  const body = {
    participant_id: data.participant_id,
    participant_code: _getItem(STORAGE_KEYS.PARTICIPANT_CODE) || '',
    question_id: data.question_id,
    step_id: data.step_id || '',
    block_id: data.block_id || '',
    game_key: data.game_key ? normalizeGameKey(data.game_key) : '',
    game_title: data.game_title || '',
    question_type: data.question_type || '',
    response_time_seconds: data.response_time_seconds || 0,
    raw_score: data.raw_score || 0,
    final_score: data.final_score,
    dimension_name: data.dimension_name || '',
    dimension_code: data.dimension_code || '',
    parent_dimension: data.parent_dimension || '',
    parent_dimension_code: data.parent_dimension_code || '',
    facet_name: data.facet_name || '',
    facet_code: data.facet_code || '',
    answered_at: data.answered_at || ''
  };
  if (data.question_type === 'text_input') {
    body.raw_answer_text = data.raw_answer_text || '';
  } else {
    body.selected_option_id = data.selected_option_id || '';
    body.selected_option_text = data.selected_option_text || '';
  }
  if (!hasBackendSession()) return { status: 'local_only' };
  return apiPost('/questionnaire/response', body);
}

/**
 * 标记问卷完成
 */
async function completeQuestionnaire(context) {
  context = context || {};
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return { status: 'no_participant' };

  let result = { status: 'local_only' };
  if (hasBackendSession()) {
    result = await apiPost('/questionnaire/complete', {
      participant_id: participantId,
      step_id: context.step_id || '',
      block_id: context.block_id || '',
      game_key: context.game_key ? normalizeGameKey(context.game_key) : '',
      game_title: context.game_title || ''
    });
    if (result && result.next_step) {
      _setItem(STORAGE_KEYS.CURRENT_FLOW_STEP, result.next_step);
    }
  }

  _setItem(STORAGE_KEYS.QUESTIONNAIRE_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_COMPLETED, true);
  return result || { status: hasBackendSession() ? 'synced' : 'local_only' };
}

// ============================================================
// 游戏
// ============================================================

/**
 * 保存单条剧情作答 — 先存 localStorage，再尝试提交到后端
 */
async function saveGameResponse(data) {
  data.participant_code = data.participant_code || _getItem(STORAGE_KEYS.PARTICIPANT_CODE) || '';
  data.external_id = data.external_id || _getItem(STORAGE_KEYS.EXTERNAL_ID) || '';
  data.game_key = normalizeGameKey(data.game_key);
  data.game_title = data.game_title || defaultGameTitle(data.game_key);
  // 始终保存到 localStorage
  const responses = _getItem(STORAGE_KEYS.GAME_RESPONSES) || [];
  const existingIndex = responses.findIndex(r => r.scene_id === data.scene_id && normalizeGameKey(r.game_key) === data.game_key);
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.GAME_RESPONSES, responses);

  const body = {
    participant_id: data.participant_id,
    participant_code: _getItem(STORAGE_KEYS.PARTICIPANT_CODE) || '',
    game_key: data.game_key,
    game_title: data.game_title,
    scene_id: data.scene_id,
    selected_option_label: data.selected_option_label,
    selected_option_text: data.selected_option_text || '',
    raw_score: data.raw_score || 0,
    final_score: data.final_score,
    response_time_seconds: data.response_time_seconds || 0,
    dimension_name: data.dimension_name || '',
    dimension_code: data.dimension_code || '',
    parent_dimension: data.parent_dimension || '',
    parent_dimension_code: data.parent_dimension_code || '',
    facet_name: data.facet_name || '',
    facet_code: data.facet_code || '',
    answered_at: data.answered_at || ''
  };
  if (!hasBackendSession()) return { status: 'local_only' };
  const result = await apiPost('/game/response', body);
  if (result && result.record) {
    const latest = _getItem(STORAGE_KEYS.GAME_RESPONSES) || [];
    const key = normalizeGameKey(result.record.game_key);
    const idx = latest.findIndex(r => r.scene_id === result.record.scene_id && normalizeGameKey(r.game_key) === key);
    if (idx !== -1) {
      latest[idx] = result.record;
    } else {
      latest.push(result.record);
    }
    _setItem(STORAGE_KEYS.GAME_RESPONSES, latest);
  }
  return result;
}

/**
 * 标记游戏完成 — 本地计分 + 后端通知（不阻塞）
 * 返回结果包含 dimension_scores
 */
async function completeGame(gameKey, gameTitle, context) {
  context = context || {};
  var participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return null;

  gameKey = normalizeGameKey(gameKey);
  gameTitle = gameTitle || defaultGameTitle(gameKey);

  var scores = null;
  if (hasBackendSession()) {
    scores = await apiPost('/game/complete', {
      participant_id: participantId,
      game_key: gameKey,
      game_title: gameTitle,
      step_id: context.step_id || ''
    });
    if (scores && scores.next_step) {
      _setItem(STORAGE_KEYS.CURRENT_FLOW_STEP, scores.next_step);
    }
  } else {
    scores = calculateGameScores(gameKey, gameTitle);
  }

  _setItem(STORAGE_KEYS.GAME_END_TIME, new Date().toISOString());
  if (scores && scores.dimension_scores) {
    saveResultScores(scores.dimension_scores);
  }
  const completed = markGameKeyCompleted(gameKey);
  const order = normalizeGameOrder(_getItem(STORAGE_KEYS.GAME_ORDER));
  _setItem(STORAGE_KEYS.GAME_COMPLETED, order.every(function (key) { return completed.indexOf(key) !== -1; }));
  return scores;
}

// ============================================================
// 结果
// ============================================================

/**
 * 获取结果得分 — 优先从后端获取，回退到 localStorage
 */
async function getResultScores() {
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return null;

  // 优先从后端获取
  try {
    const scores = await apiGet('/results/' + encodeURIComponent(participantId));
    // 缓存到 localStorage
    _setItem(STORAGE_KEYS.RESULT_SCORES, scores);
    return scores;
  } catch (e) {
    console.warn('[storage] 后端获取结果失败，使用本地数据:', e.message);
  }

  // 回退到 localStorage
  return _getItem(STORAGE_KEYS.RESULT_SCORES);
}

/**
 * 保存结果得分（仅本地，供计回退用）
 */
function saveResultScores(scores) {
  _setItem(STORAGE_KEYS.RESULT_SCORES, scores);
}

// ============================================================
// 参与者数据（仅 localStorage）
// ============================================================

/**
 * 获取当前参与者的全部数据
 */
function getParticipantData() {
  return {
    participant_id: _getItem(STORAGE_KEYS.PARTICIPANT_ID),
    participant_code: _getItem(STORAGE_KEYS.PARTICIPANT_CODE),
    external_id: _getItem(STORAGE_KEYS.EXTERNAL_ID),
    backend_session_active: _getItem(STORAGE_KEYS.BACKEND_SESSION_ACTIVE),
    start_time: _getItem(STORAGE_KEYS.START_TIME),
    questionnaire_start_time: _getItem(STORAGE_KEYS.QUESTIONNAIRE_START_TIME),
    questionnaire_end_time: _getItem(STORAGE_KEYS.QUESTIONNAIRE_END_TIME),
    questionnaire_completed: _getItem(STORAGE_KEYS.QUESTIONNAIRE_COMPLETED),
    game_start_time: _getItem(STORAGE_KEYS.GAME_START_TIME),
    game_end_time: _getItem(STORAGE_KEYS.GAME_END_TIME),
    game_completed: _getItem(STORAGE_KEYS.GAME_COMPLETED),
    game_order: _getItem(STORAGE_KEYS.GAME_ORDER) || [],
    current_game_index: _getItem(STORAGE_KEYS.CURRENT_GAME_INDEX),
    completed_game_keys: _getItem(STORAGE_KEYS.COMPLETED_GAME_KEYS) || [],
    game_reports: _getItem(STORAGE_KEYS.GAME_REPORTS) || {},
    questionnaire_responses: _getItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES) || [],
    game_responses: _getItem(STORAGE_KEYS.GAME_RESPONSES) || [],
    result_scores: _getItem(STORAGE_KEYS.RESULT_SCORES),
    flow_enabled: _getItem(STORAGE_KEYS.FLOW_ENABLED),
    flow_plan: _getItem(STORAGE_KEYS.FLOW_PLAN) || [],
    current_flow_step: _getItem(STORAGE_KEYS.CURRENT_FLOW_STEP),
    current_flow_index: _getItem(STORAGE_KEYS.CURRENT_FLOW_INDEX),
    flow_completed_step_ids: _getItem(STORAGE_KEYS.FLOW_COMPLETED_STEP_IDS) || []
  };
}

/**
 * 清除当前参与者数据
 */
function clearParticipantData() {
  Object.values(STORAGE_KEYS).forEach(key => _removeItem(key));
  _clearKeysByPrefix('questionnaire_completed::');
}
