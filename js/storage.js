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
  QUESTIONNAIRE_RESPONSES: 'questionnaire_responses',
  GAME_RESPONSES: 'game_responses',
  RESULT_SCORES: 'result_scores'
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

// ============================================================
// 参与者会话
// ============================================================

/**
 * 开始参与者会话 — 接受 customId 参数（被试自行输入的编号）
 * customId 只作为 external_id 交给后端保存，不再当作 participant_id。
 * 优先调用后端 API，回退到 localStorage
 * TODO: 后续可移除 localStorage 回退
 */
async function startParticipantSession(customId, options) {
  options = options || {};
  if (options.forceNew) {
    clearParticipantData();
  }

  // 如果已有会话则复用
  const existingId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (existingId) return existingId;

  const externalId = customId && customId.trim() ? customId.trim() : '';

  // 尝试调用后端 API。成功后必须使用后端返回的 participant_id。
  try {
    const result = await apiPost('/participants/start', { external_id: externalId });
    _setItem(STORAGE_KEYS.PARTICIPANT_ID, result.participant_id);
    _setItem(STORAGE_KEYS.PARTICIPANT_CODE, result.participant_code || '');
    _setItem(STORAGE_KEYS.EXTERNAL_ID, externalId);
    _setItem(STORAGE_KEYS.BACKEND_SESSION_ACTIVE, true);
    _setItem(STORAGE_KEYS.START_TIME, result.start_time);
    console.log('[storage] 后端创建参与者成功:', result.participant_id, result.participant_code || '');
    return result.participant_id;
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
  const existingIndex = responses.findIndex(r => r.question_id === data.question_id);
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
async function completeQuestionnaire() {
  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return { status: 'no_participant' };

  if (hasBackendSession()) {
    await apiPost('/questionnaire/complete', { participant_id: participantId });
  }

  _setItem(STORAGE_KEYS.QUESTIONNAIRE_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_COMPLETED, true);
  return { status: hasBackendSession() ? 'synced' : 'local_only' };
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
  // 始终保存到 localStorage
  const responses = _getItem(STORAGE_KEYS.GAME_RESPONSES) || [];
  const existingIndex = responses.findIndex(r => r.scene_id === data.scene_id);
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.GAME_RESPONSES, responses);

  const body = {
    participant_id: data.participant_id,
    participant_code: _getItem(STORAGE_KEYS.PARTICIPANT_CODE) || '',
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
  return apiPost('/game/response', body);
}

/**
 * 标记游戏完成 — 本地计分 + 后端通知（不阻塞）
 * 返回结果包含 dimension_scores
 */
async function completeGame() {
  var participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return null;

  var scores = null;
  if (hasBackendSession()) {
    scores = await apiPost('/game/complete', { participant_id: participantId });
  } else {
    scores = calculateAllScores();
  }

  _setItem(STORAGE_KEYS.GAME_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.GAME_COMPLETED, true);
  if (scores) saveResultScores(scores);
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
    questionnaire_responses: _getItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES) || [],
    game_responses: _getItem(STORAGE_KEYS.GAME_RESPONSES) || [],
    result_scores: _getItem(STORAGE_KEYS.RESULT_SCORES)
  };
}

/**
 * 清除当前参与者数据
 */
function clearParticipantData() {
  Object.values(STORAGE_KEYS).forEach(key => _removeItem(key));
}
