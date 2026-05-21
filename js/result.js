/* ============================================================
   result.js — 情景游戏独立报告页
   ============================================================ */

async function initResult() {
  const participantId = localStorage.getItem('participant_id');
  if (!participantId) {
    showWarning('未找到参与会话，请返回首页重新开始。');
    return;
  }

  const reports = await getGameReports();
  const gameKey = getQueryParam('game');

  if (gameKey) {
    const key = normalizeGameKey(gameKey);
    const report = reports[key];
    if (!report) {
      showWarning('这份情景游戏报告还没有生成，请先完成对应的情景游戏。');
      return;
    }
    await renderSingleGameReport(report, key);
    return;
  }

  await renderAllGameReports(reports);
}

async function renderSingleGameReport(report, gameKey) {
  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = (report.game_title || defaultGameTitle(gameKey)) + '报告';
    if (desc) desc.textContent = '这份报告只根据本情景游戏中的选择生成，不包含问卷数据或另一个情景游戏的数据。';
  }

  renderReportSections(report);
  await renderReportActions(gameKey);
}

async function renderAllGameReports(reports) {
  const keys = Object.keys(reports || {});
  if (keys.length === 0) {
    showWarning('暂时没有已生成的情景游戏报告。');
    return;
  }

  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = '情景游戏报告汇总';
    if (desc) desc.textContent = '以下报告均只来自情景游戏作答，不包含问卷数据。';
  }

  const content = document.getElementById('resultContent');
  if (!content) return;
  content.innerHTML = '';
  keys.forEach(function (key) {
    const report = reports[key];
    const section = document.createElement('div');
    section.className = 'result-section';
    const overall = report.overall_score || {};
    section.innerHTML = [
      '<h2>' + escHtml(report.game_title || defaultGameTitle(key)) + '</h2>',
      '<table class="dimension-table">',
      '<tr class="dimension-row overall-row">',
      '<td class="dim-label">总体得分</td>',
      '<td class="dim-data">总分：' + (overall.total_score || 0) + '</td>',
      '<td class="dim-data">题数：' + (overall.total_item_count || 0) + '</td>',
      '<td class="dim-data">平均分：' + (overall.total_average_score != null ? overall.total_average_score : 0) + '</td>',
      '</tr>',
      '</table>'
    ].join('');
    content.appendChild(section);
  });

  renderFinalAction();
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
    '<div id="gameReportActions" style="text-align:center;margin-top:12px;"></div>'
  ].join('');

  renderParentScores(report.parent_dimension_scores || []);
  renderFacetScores(report.facet_dimension_scores || []);
  renderOverallScore(report.overall_score || {});
}

async function renderReportActions(currentGameKey) {
  const actions = document.getElementById('gameReportActions');
  if (!actions) return;

  const order = normalizeGameOrder(await ensureGameOrder());
  const completed = getCompletedGameKeys();
  const nextIndex = order.findIndex(function (key) {
    return completed.indexOf(normalizeGameKey(key)) === -1;
  });

  if (nextIndex !== -1) {
    actions.innerHTML = '<button class="btn btn-success btn-lg" onclick="goToNextGame(' + nextIndex + ')">进行下一步</button>';
    return;
  }

  actions.innerHTML = '<div class="complete-area" style="display:block;">全部测验已经完成</div>';
}

function renderFinalAction() {
  const content = document.getElementById('resultContent');
  if (!content) return;
  const actions = document.createElement('div');
  actions.style.textAlign = 'center';
  actions.style.marginTop = '12px';
  actions.innerHTML = '<div class="complete-area" style="display:block;">全部测验已经完成</div>';
  content.appendChild(actions);
}

function goToNextGame(index) {
  setCurrentGameIndex(index);
  navigateTo('game.html');
}

function showWarning(message) {
  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = '体验尚未完成';
    if (desc) desc.textContent = message || '请返回首页重新开始完整的体验流程。';
  }

  const content = document.getElementById('resultContent');
  if (!content) return;
  content.innerHTML = '';
  const warningDiv = document.createElement('div');
  warningDiv.className = 'warning-message';
  warningDiv.innerHTML = [
    '<h2>提示</h2>',
    '<p>' + escHtml(message || '您还没有完成剧情体验的全部流程。') + '</p>',
    '<button class="btn btn-primary" onclick="navigateTo(\'index.html\')">返回首页</button>'
  ].join('');
  content.appendChild(warningDiv);
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

document.addEventListener('DOMContentLoaded', async function () {
  if (!localStorage.getItem('participant_id')) {
    await startParticipantSession();
  }
  initResult();
});
