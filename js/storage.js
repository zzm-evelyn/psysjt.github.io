/* ============================================================
   storage.js — 数据持久化层（localStorage）
   TODO: 后续改为调用后端 API
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
 * 开始参与者会话 — 生成 participant_id，记录 start_time
 * TODO: 后续改为调用后端 API 创建参与者
 */
function startParticipantSession() {
  // 如果已有会话则复用
  const existingId = _getItem(STORAGE_KEYS.PARTICIPANT_ID);
  if (existingId) return existingId;

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
 * 保存单条问卷作答
 * TODO: 后续改为 POST 到后端 API
 */
function saveQuestionnaireResponse(data) {
  const responses = _getItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES) || [];
  // 如果该题已作答则覆盖
  const existingIndex = responses.findIndex(r => r.question_id === data.question_id);
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_RESPONSES, responses);
}

/**
 * 标记问卷完成
 * TODO: 后续改为调用后端 API
 */
function completeQuestionnaire() {
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.QUESTIONNAIRE_COMPLETED, true);
}

// ============================================================
// 游戏
// ============================================================

/**
 * 保存单条剧情作答
 * TODO: 后续改为 POST 到后端 API
 */
function saveGameResponse(data) {
  const responses = _getItem(STORAGE_KEYS.GAME_RESPONSES) || [];
  const existingIndex = responses.findIndex(r => r.scene_id === data.scene_id);
  if (existingIndex !== -1) {
    responses[existingIndex] = data;
  } else {
    responses.push(data);
  }
  _setItem(STORAGE_KEYS.GAME_RESPONSES, responses);
}

/**
 * 标记游戏完成
 * TODO: 后续改为调用后端 API
 */
function completeGame() {
  _setItem(STORAGE_KEYS.GAME_END_TIME, new Date().toISOString());
  _setItem(STORAGE_KEYS.GAME_COMPLETED, true);
}

// ============================================================
// 结果
// ============================================================

/**
 * 获取结果得分
 * TODO: 后续改为从后端 API 获取
 */
function getResultScores() {
  return _getItem(STORAGE_KEYS.RESULT_SCORES);
}

/**
 * 保存结果得分
 * TODO: 后续改为提交到后端 API
 */
function saveResultScores(scores) {
  _setItem(STORAGE_KEYS.RESULT_SCORES, scores);
}

// ============================================================
// 参与者数据
// ============================================================

/**
 * 获取当前参与者的全部数据
 * TODO: 后续改为从后端 API 获取
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
 * 清除当前参与者数据（重新开始用）
 * TODO: 后续改为调用后端 API 删除
 */
function clearParticipantData() {
  Object.values(STORAGE_KEYS).forEach(key => _removeItem(key));
}
