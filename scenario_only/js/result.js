/* ============================================================
   scenario_only/result.js — 单独情景测验报告页
   ============================================================ */

const SCENARIO_ONLY_RESULT_DEFAULT_GAME_KEY = 'game_a';

function getScenarioOnlyResultGameKey() {
  const stored = localStorage.getItem('scenario_only_game_key');
  let storedKey = '';
  try {
    storedKey = stored ? JSON.parse(stored) : '';
  } catch (e) {
    storedKey = '';
  }
  return normalizeGameKey(getQueryParam('game') || storedKey || SCENARIO_ONLY_RESULT_DEFAULT_GAME_KEY);
}

async function initResult() {
  removeLegacyResultActions();

  if (!localStorage.getItem('participant_id')) {
    showWarning('未找到参与会话，请联系研究者或重新打开入口链接。');
    return;
  }

  const gameKey = getScenarioOnlyResultGameKey();
  const reports = await getGameReports();
  const report = reports[gameKey];
  if (!report) {
    showWarning('这份情景体验报告还没有生成，请先完成情景体验。');
    return;
  }

  renderScenarioReport(report, gameKey);
}

function renderScenarioReport(report, gameKey) {
  removeLegacyResultActions();

  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = (report.game_title || defaultGameTitle(gameKey)) + '报告';
    if (desc) desc.textContent = '这份报告只根据本次情景体验中的选择生成。';
  }

  renderReportSections(report);
}

function renderReportSections(report) {
  const content = document.getElementById('resultContent');
  if (!content) return;
  content.innerHTML = [
    '<div class="result-section">',
      '<h2>一级人格维度</h2>',
      '<div id="parentDimensionScores"></div>',
    '</div>',
    '<div class="result-section">',
      '<h2>子维度</h2>',
      '<div id="facetDimensionScores"></div>',
    '</div>',
    '<div class="result-section">',
      '<h2>总体得分</h2>',
      '<div id="overallScore"></div>',
    '</div>',
    '<div class="complete-area" style="display:block;">全部体验结束，感谢您的参与！</div>'
  ].join('');

  renderParentScores(report.parent_dimension_scores || []);
  renderFacetScores(report.facet_dimension_scores || []);
  renderOverallScore(report.overall_score || {});
  removeLegacyResultActions();
}

function showWarning(message) {
  removeLegacyResultActions();

  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = '体验尚未完成';
    if (desc) desc.textContent = message || '请联系研究者或重新打开入口链接。';
  }

  const content = document.getElementById('resultContent');
  if (!content) return;
  content.innerHTML = [
    '<div class="warning-message">',
      '<h2>提示</h2>',
      '<p>' + escHtml(message || '您还没有完成情景体验。') + '</p>',
    '</div>'
  ].join('');
}

function removeLegacyResultActions() {
  document.querySelectorAll('button').forEach(function (button) {
    const text = (button.textContent || '').trim();
    if (text === '返回首页' || text === '查看报告汇总' || text === '查看全部报告') {
      const wrapper = button.parentElement;
      button.remove();
      if (wrapper && wrapper !== document.body && wrapper.children.length === 0 && !wrapper.textContent.trim()) {
        wrapper.remove();
      }
    }
  });
}

function escHtml(str) {
  if (typeof str !== 'string') str = String(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderParentScores(scores) {
  const container = document.getElementById('parentDimensionScores');
  if (!container) return;
  if (!scores || scores.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">暂无一级维度得分。</p>';
    return;
  }

  let html = '<table class="dimension-table">';
  html += '<tr><th class="dim-header">维度</th><th class="dim-header">总分</th><th class="dim-header">题目数</th><th class="dim-header">平均分</th></tr>';

  scores.forEach(function (s) {
    html += '<tr class="dimension-row">';
    html += '<td class="dim-label">' + escHtml(s.parent_dimension || '-') + '</td>';
    html += '<td class="dim-data">' + (s.total_score || 0) + '</td>';
    html += '<td class="dim-data">' + (s.item_count || 0) + '</td>';
    html += '<td class="dim-data">' + (s.average_score != null ? s.average_score : 0) + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}

function renderFacetScores(scores) {
  const container = document.getElementById('facetDimensionScores');
  if (!container) return;
  if (!scores || scores.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">暂无子维度得分。</p>';
    return;
  }

  let html = '<table class="dimension-table">';
  html += '<tr><th class="dim-header">子维度</th><th class="dim-header">总分</th><th class="dim-header">题目数</th><th class="dim-header">平均分</th><th class="dim-header">说明</th></tr>';

  scores.forEach(function (s) {
    const def = dimensionDefinitions.find(function (d) { return d.dimension_code === s.dimension_code; });
    const desc = def ? def.dimension_description : '';

    html += '<tr class="dimension-row">';
    html += '<td class="dim-label">' + escHtml(s.dimension_name || '-') + '<br><span class="dim-desc">' + escHtml(desc) + '</span></td>';
    html += '<td class="dim-data">' + (s.total_score || 0) + '</td>';
    html += '<td class="dim-data">' + (s.item_count || 0) + '</td>';
    html += '<td class="dim-data">' + (s.average_score != null ? s.average_score : 0) + '</td>';
    html += '<td class="dim-data">' + ((s.item_count || 0) > 0 ? '' : '不足以计算') + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}

function renderOverallScore(score) {
  const container = document.getElementById('overallScore');
  if (!container || !score) return;

  container.innerHTML = [
    '<table class="dimension-table">',
    '<tr class="dimension-row overall-row">',
    '<td class="dim-label">总体得分</td>',
    '<td class="dim-data">总分：' + (score.total_score || 0) + '</td>',
    '<td class="dim-data">总题数：' + (score.total_item_count || 0) + '</td>',
    '<td class="dim-data">平均分：' + (score.total_average_score != null ? score.total_average_score : 0) + '</td>',
    '</tr>',
    '</table>'
  ].join('');
}

document.addEventListener('DOMContentLoaded', initResult);
