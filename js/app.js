/* ============================================================
   app.js — 全局工具函数与入口
   ============================================================ */

/**
 * 获取 URL 查询参数
 * @param {string} name - 参数名
 * @returns {string|null}
 */
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * 跳转到指定页面
 * @param {string} url - 页面路径
 */
function navigateTo(url) {
  window.location.href = url;
}

/**
 * 标记问卷开始时间（由 questionnaire.html 调用）
 */
function markQuestionnaireStart() {
  const existing = localStorage.getItem('questionnaire_start_time');
  if (!existing) {
    localStorage.setItem('questionnaire_start_time', JSON.stringify(new Date().toISOString()));
  }
}

/**
 * 标记游戏开始时间（由 game.html 调用）
 */
function markGameStart() {
  const existing = localStorage.getItem('game_start_time');
  if (!existing) {
    localStorage.setItem('game_start_time', JSON.stringify(new Date().toISOString()));
  }
}
