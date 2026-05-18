/* ============================================================
   debug.js — 本地调试工具
   仅用于开发阶段检查 localStorage 数据，不做正式管理端。
   TODO: 正式后端管理端需要实现所有被试数据查看、Excel 导出、权限保护
   ============================================================ */

/* ===================== 页面初始化 ===================== */
function initDebug() {
  renderParticipantInfo();
  renderQuestionnaireResponses();
  renderGameResponses();
  renderResultScores();
  renderRawData();
}

/* ===================== 展开/折叠 ===================== */
function toggleSection(headerEl) {
  const body = headerEl.nextElementSibling;
  if (!body) return;
  body.classList.toggle('hidden');
  const icon = headerEl.querySelector('.toggle-icon');
  if (icon) icon.classList.toggle('collapsed');
}

/* ===================== Toast ===================== */
function showToast(msg) {
  var toast = document.getElementById('debugToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2000);
}

/* ===================== 参与者信息 ===================== */
function renderParticipantInfo() {
  var container = document.getElementById('participantInfo');
  if (!container) return;

  var pid = JSON.parse(localStorage.getItem('participant_id'));
  var fields = [
    { key: 'participant_id', label: 'participant_id' },
    { key: 'start_time', label: 'start_time' },
    { key: 'questionnaire_start_time', label: 'questionnaire_start_time' },
    { key: 'questionnaire_end_time', label: 'questionnaire_end_time' },
    { key: 'questionnaire_completed', label: 'questionnaire_completed' },
    { key: 'game_start_time', label: 'game_start_time' },
    { key: 'game_end_time', label: 'game_end_time' },
    { key: 'game_completed', label: 'game_completed' }
  ];

  var html = '<div class="debug-kv">';
  fields.forEach(function (f) {
    var val = JSON.parse(localStorage.getItem(f.key));
    var display = val === null || val === undefined
      ? '<span class="value null">null</span>'
      : val === ''
        ? '<span class="value empty">(empty)</span>'
        : '<span class="value">' + escapeHtml(JSON.stringify(val)) + '</span>';
    html += '<span class="key">' + f.label + '</span>' + display;
  });
  html += '</div>';

  container.innerHTML = html;
}

/* ===================== 问卷作答 ===================== */
function renderQuestionnaireResponses() {
  var container = document.getElementById('questionnaireResponses');
  if (!container) return;

  var responses = JSON.parse(localStorage.getItem('questionnaire_responses')) || [];

  if (responses.length === 0) {
    container.innerHTML = '<div class="debug-empty">暂无数据</div>';
    return;
  }

  var html = '<table class="debug-table"><thead><tr>';
  html += '<th>题目</th><th>选项</th><th>原始分</th><th>维度</th><th>作答时间</th>';
  html += '</tr></thead><tbody>';

  responses.forEach(function (r) {
    html += '<tr>';
    html += '<td class="dim-label">' + escapeHtml(r.question_id || '') + '</td>';
    html += '<td>' + escapeHtml(r.selected_option_text || '') + '</td>';
    html += '<td>' + (r.raw_score !== undefined ? r.raw_score : '-') + '</td>';
    html += '<td>' + escapeHtml(r.dimension_name || '-') + '</td>';
    html += '<td style="font-size:11px;color:#888;">' + formatTime(r.answered_at) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ===================== 剧情作答 ===================== */
function renderGameResponses() {
  var container = document.getElementById('gameResponses');
  if (!container) return;

  var responses = JSON.parse(localStorage.getItem('game_responses')) || [];

  if (responses.length === 0) {
    container.innerHTML = '<div class="debug-empty">暂无数据</div>';
    return;
  }

  var html = '<table class="debug-table"><thead><tr>';
  html += '<th>场景</th><th>选项</th><th>原始分</th><th>维度</th><th>作答时间</th>';
  html += '</tr></thead><tbody>';

  responses.forEach(function (r) {
    html += '<tr>';
    html += '<td class="dim-label">' + escapeHtml(r.scene_id || '') + '</td>';
    html += '<td>' + escapeHtml(r.selected_option_text || '') + '</td>';
    html += '<td>' + (r.raw_score !== undefined ? r.raw_score : '-') + '</td>';
    html += '<td>' + escapeHtml(r.dimension_name || '-') + '</td>';
    html += '<td style="font-size:11px;color:#888;">' + formatTime(r.answered_at) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ===================== 结果得分（三层） ===================== */
function renderResultScores() {
  var container = document.getElementById('resultScores');
  if (!container) return;

  var scores = JSON.parse(localStorage.getItem('result_scores'));
  if (!scores) {
    container.innerHTML = '<div class="debug-empty">暂无数据（尚未完成全部流程）</div>';
    return;
  }

  var html = '';

  // ——— 1. 一级维度 ———
  html += '<div style="margin-bottom:16px;">';
  html += '<div style="font-size:12px;color:#999;margin-bottom:8px;">第一部分 · 一级人格维度</div>';
  html += '<table class="debug-table"><thead><tr>';
  html += '<th>维度</th><th>总分</th><th>题目数</th><th>平均分</th>';
  html += '</tr></thead><tbody>';

  (scores.parent_dimension_scores || []).forEach(function (d) {
    html += '<tr>';
    html += '<td class="dim-label">' + escapeHtml(d.parent_dimension || '-') + '</td>';
    html += '<td>' + (d.total_score || 0) + '</td>';
    html += '<td>' + (d.item_count || 0) + '</td>';
    html += '<td>' + (d.average_score != null ? d.average_score.toFixed(2) : '-') + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // ——— 2. 子维度 ———
  html += '<div style="margin-bottom:16px;">';
  html += '<div style="font-size:12px;color:#999;margin-bottom:8px;">第二部分 · 子维度</div>';
  html += '<table class="debug-table"><thead><tr>';
  html += '<th>子维度</th><th>总分</th><th>题目数</th><th>平均分</th>';
  html += '</tr></thead><tbody>';

  (scores.facet_dimension_scores || []).forEach(function (d) {
    html += '<tr>';
    html += '<td class="dim-label">' + escapeHtml(d.dimension_name || '-') + '</td>';
    html += '<td>' + (d.total_score || 0) + '</td>';
    html += '<td>' + (d.item_count || 0) + '</td>';
    html += '<td>' + (d.average_score != null ? d.average_score.toFixed(2) : '-') + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // ——— 3. 总体 ———
  html += '<div>';
  html += '<div style="font-size:12px;color:#999;margin-bottom:8px;">第三部分 · 总体得分</div>';
  html += '<table class="debug-table"><thead><tr>';
  html += '<th>指标</th><th>值</th>';
  html += '</tr></thead><tbody>';

  var o = scores.overall_score || {};
  html += '<tr class="overall-row"><td>总分</td><td>' + (o.total_score || 0) + '</td></tr>';
  html += '<tr class="overall-row"><td>总题数</td><td>' + (o.total_item_count || 0) + '</td></tr>';
  html += '<tr class="overall-row"><td>平均分</td><td>' + (o.total_average_score != null ? o.total_average_score.toFixed(2) : '-') + '</td></tr>';

  html += '</tbody></table></div>';

  container.innerHTML = html;
}

/* ===================== 原始 localStorage ===================== */
function renderRawData() {
  var container = document.getElementById('rawData');
  if (!container) return;

  var keys = [
    'participant_id', 'start_time',
    'questionnaire_start_time', 'questionnaire_end_time', 'questionnaire_completed',
    'game_start_time', 'game_end_time', 'game_completed',
    'questionnaire_responses', 'game_responses',
    'result_scores'
  ];

  var data = {};
  keys.forEach(function (k) {
    var val = localStorage.getItem(k);
    if (val !== null) {
      try { data[k] = JSON.parse(val); } catch (e) { data[k] = val; }
    }
  });

  container.innerHTML = '<div class="debug-raw">' + escapeHtml(JSON.stringify(data, null, 2)) + '</div>';
}

/* ===================== 导出 JSON ===================== */
function exportJSON() {
  var keys = [
    'participant_id', 'start_time',
    'questionnaire_start_time', 'questionnaire_end_time', 'questionnaire_completed',
    'game_start_time', 'game_end_time', 'game_completed',
    'questionnaire_responses', 'game_responses',
    'result_scores'
  ];

  var data = { exported_at: new Date().toISOString() };
  keys.forEach(function (k) {
    var val = localStorage.getItem(k);
    if (val !== null) {
      try { data[k] = JSON.parse(val); } catch (e) { data[k] = val; }
    }
  });

  downloadJSON(data, 'localStorage_全量数据_' + new Date().toISOString().slice(0, 10) + '.json');
  showToast('已导出 JSON');
}

/* ===================== 导出 CSV ===================== */
function exportCSV() {
  var qResponses = JSON.parse(localStorage.getItem('questionnaire_responses')) || [];
  var gResponses = JSON.parse(localStorage.getItem('game_responses')) || [];

  var rows = [];

  // 问卷表头
  rows.push('=== 问卷作答 (questionnaire_responses) ===');
  rows.push('question_id,selected_option_id,selected_option_text,raw_score,dimension_name,dimension_code,parent_dimension,parent_dimension_code,facet_name,facet_code,answered_at');
  qResponses.forEach(function (r) {
    rows.push([
      csvEscape(r.question_id),
      csvEscape(r.selected_option_id),
      csvEscape(r.selected_option_text),
      r.raw_score,
      csvEscape(r.dimension_name),
      csvEscape(r.dimension_code),
      csvEscape(r.parent_dimension),
      csvEscape(r.parent_dimension_code),
      csvEscape(r.facet_name),
      csvEscape(r.facet_code),
      csvEscape(r.answered_at)
    ].join(','));
  });

  // 剧情表头
  rows.push('');
  rows.push('=== 剧情作答 (game_responses) ===');
  rows.push('scene_id,selected_option_label,selected_option_text,raw_score,dimension_name,dimension_code,parent_dimension,parent_dimension_code,facet_name,facet_code,answered_at');
  gResponses.forEach(function (r) {
    rows.push([
      csvEscape(r.scene_id),
      csvEscape(r.selected_option_label),
      csvEscape(r.selected_option_text),
      r.raw_score,
      csvEscape(r.dimension_name),
      csvEscape(r.dimension_code),
      csvEscape(r.parent_dimension),
      csvEscape(r.parent_dimension_code),
      csvEscape(r.facet_name),
      csvEscape(r.facet_code),
      csvEscape(r.answered_at)
    ].join(','));
  });

  var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '作答数据_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 CSV');
}

/* ===================== 清空数据 ===================== */
function clearAll() {
  if (!confirm('确定清空当前浏览器中所有 localStorage 测试数据？\n此操作不可撤销。')) return;
  if (!confirm('再次确认：清空后将丢失所有作答记录和得分结果。')) return;

  var keys = [
    'participant_id', 'start_time',
    'questionnaire_start_time', 'questionnaire_end_time', 'questionnaire_completed',
    'game_start_time', 'game_end_time', 'game_completed',
    'questionnaire_responses', 'game_responses',
    'result_scores'
  ];

  keys.forEach(function (k) { localStorage.removeItem(k); });
  showToast('已清空所有本地数据');
  initDebug();
}

/* ===================== 工具函数 ===================== */
function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  var s = String(val);
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatTime(iso) {
  if (!iso) return '-';
  try {
    var d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return iso;
  }
}

function downloadJSON(data, filename) {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ===================== 初始化 ===================== */
document.addEventListener('DOMContentLoaded', function () {
  initDebug();
});
