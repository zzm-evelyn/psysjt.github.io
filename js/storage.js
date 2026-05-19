/* ============================================================
   storage.js — 数据持久化层
   优先调用后端 API，localStorage 作为缓存和离线回退
   ============================================================ */

const STORAGE_KEYS = {
  PARTICIPANT_ID: 'participant_id',
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
 * 优先调用后端 API，回退到 localStorage
 * TODO: 后续可移除 localStorage 回退
 */
async function startParticipantSession(customId) {
  // 如果已有会话则复用
  const existingId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (existingId) return existingId;

  // 如果传入了 customId 且不为空，直接使用
  if (customId && customId.trim()) {
    const trimmedId = customId.trim();
    _setItem(STORAGE_KEYS.PARTICIPANT_ID, trimmedId);
    _setItem(STORAGE_KEYS.START_TIME, new Date().toISOString());
    // 也尝试通知后端（传入 external_id）
    try {
      await apiPost('/participants/start', { external_id: trimmedId });
    } catch (e) {
      console.warn('[storage] 后端通知失败（已使用自定义ID）:', e.message);
    }
    console.log('[storage] 使用自定义编号:', trimmedId);
    return trimmedId;
  }

  // 尝试调用后端 API
  try {
    const result = await apiPost('/participants/start', {});
    _setItem(STORAGE_KEYS.PARTICIPANT_ID, result.participant_id);
    _setItem(STORAGE_KEYS.START_TIME, result.start_time);
    console.log('[storage] 后端创建参与者成功:', result.participant_id);
    return result.participant_id;
  } catch (e) {
    console.warn('[storage] 后端不可用，使用本地模式:', e.message);
  }

  // 回退：localStorage 本地生成
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const participantId = 'P_' + timestamp + '_' + random;

  _setItem(STORAGE_KEYS.PARTICIPANT_ID, participantId);
  _setItem(STORAGE_KEYS.START_TIME, new Date().toISOString());
  return participantId;
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
  // 始终保存到 localStorage（离线可用）
  const responses = _getItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES) || [];
  const existingIndex = responses.findIndex(r => r.question_id === data.question_id);
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES, responses);

  // 尝试提交到后端
  try {
    const body = {
      participant_id: data.participant_id,
      question_id: data.question_id,
      response_time_seconds: data.response_time_seconds || 0
    };
    // text_input 类型传 raw_answer_text，likert 类型传 selected_option_id
    if (data.question_type === 'text_input') {
      body.raw_answer_text = data.raw_answer_text || '';
    } else {
      body.selected_option_id = data.selected_option_id;
    }
    await apiPost('/questionnaire/response', body);
  } catch (e) {
    console.warn('[storage] 问卷作答提交到后端失败（已缓存本地）:', e.message);
  }
}

/**
 * 标记问卷完成
 */
async function completeQuestionnaire() {
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_COMPLETED, true);

  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return;

  try {
    await apiPost('/questionnaire/complete', {
      participant_id: participantId
    });
  } catch (e) {
    console.warn('[storage] 问卷完成提交到后端失败（已缓存本地）:', e.message);
  }
}

// ============================================================
// 游戏
// ============================================================

/**
 * 保存单条剧情作答 — 先存 localStorage，再尝试提交到后端
 */
async function saveGameResponse(data) {
  // 始终保存到 localStorage
  const responses = _getItem(STORAGE_KEYS.GAME_RESPONSES) || [];
  const existingIndex = responses.findIndex(r => r.scene_id === data.scene_id);
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.GAME_RESPONSES, responses);

  // 尝试提交到后端
  try {
    await apiPost('/game/response', {
      participant_id: data.participant_id,
      scene_id: data.scene_id,
      selected_option_label: data.selected_option_label,
      response_time_seconds: data.response_time_seconds || 0
    });
  } catch (e) {
    console.warn('[storage] 剧情作答提交到后端失败（已缓存本地）:', e.message);
  }
}

/**
 * 标记游戏完成 — 后端统一计分并返回结果
 * 返回结果包含 dimension_scores，成功时更新 localStorage
 */
async function completeGame() {
  _setItem(STORAGE_KEYS.GAME_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.GAME_COMPLETED, true);

  const participantId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (!participantId) return;

  // 尝试后端完成并获取得分
  try {
    const scores = await apiPost('/game/complete', {
      participant_id: participantId
    });
    // 后端计算成功，保存到 localStorage 作为缓存
    _setItem(STORAGE_KEYS.RESULT_SCORES, scores);
    console.log('[storage] 后端计分完成');
    return scores;
  } catch (e) {
    console.warn('[storage] 后端计分失败，使用本地计分:', e.message);
  }

  // 回退：本地计分
  return calculateAllScores();
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
