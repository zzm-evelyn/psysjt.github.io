/* ============================================================
   result.js — 情景游戏独立报告页
   ============================================================ */

let currentReportFlowStep = null;

async function initResult() {
  removeLegacyResultActions();

  const participantId = localStorage.getItem('participant_id');
  if (!participantId) {
    showWarning('未找到参与会话，请联系研究者或重新打开入口链接。');
    return;
  }

  if (getQueryParam('complete') === '1') {
    await renderFlowComplete();
    return;
  }

  const reports = await getGameReports();
  const gameKey = getQueryParam('game');
  const stepId = getQueryParam('step_id') || '';
  if (stepId) {
    const flow = await getCurrentFlow();
    if (flow.flow_enabled && flow.current_step && flow.current_step.step_id === stepId) {
      currentReportFlowStep = flow.current_step;
    } else {
      currentReportFlowStep = {
        step_id: stepId,
        type: 'report',
        game_key: gameKey ? normalizeGameKey(gameKey) : ''
      };
    }
  }

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
  removeLegacyResultActions();

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

async function renderFlowComplete() {
  removeLegacyResultActions();
  const stepId = getQueryParam('step_id') || '';
  if (stepId) {
    try {
      await completeFlowStep(stepId);
    } catch (e) {
      console.warn('[result] 瀹屾垚娴佺▼姝ラ澶辫触:', e.message);
    }
  }
  await renderAllGameReports({});
}

async function renderAllGameReports(reports) {
  removeLegacyResultActions();

  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = '全部体验结束';
    if (desc) desc.textContent = '全部体验结束，感谢您的参与！';
  }

  const content = document.getElementById('resultContent');
  if (!content) return;
  content.innerHTML = '<div class="complete-area" style="display:block;">全部体验结束，感谢您的参与！</div>';
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

  if (currentReportFlowStep && currentReportFlowStep.step_id) {
    actions.innerHTML = '<button class="btn btn-success btn-lg" onclick="finishFlowReportStep()">进行下一步</button>';
    removeLegacyResultActions();
    return;
  }

  const order = normalizeGameOrder(await ensureGameOrder());
  const completed = getCompletedGameKeys();
  const nextIndex = order.findIndex(function (key) {
    return completed.indexOf(normalizeGameKey(key)) === -1;
  });

  if (nextIndex !== -1) {
    actions.innerHTML = '<button class="btn btn-success btn-lg" onclick="goToNextGame(' + nextIndex + ')">进行下一步</button>';
    removeLegacyResultActions();
    return;
  }

  actions.innerHTML = '<div class="complete-area" style="display:block;">全部体验结束，感谢您的参与！</div>';
  removeLegacyResultActions();
}

function renderFinalAction() {
  const content = document.getElementById('resultContent');
  if (!content) return;
  const actions = document.createElement('div');
  actions.style.textAlign = 'center';
  actions.style.marginTop = '12px';
  actions.innerHTML = '<div class="complete-area" style="display:block;">全部体验结束，感谢您的参与！</div>';
  content.appendChild(actions);
  removeLegacyResultActions();
}

function goToNextGame(index) {
  setCurrentGameIndex(index);
  navigateTo('game.html');
}

async function finishFlowReportStep() {
  if (!currentReportFlowStep || !currentReportFlowStep.step_id) {
    navigateTo('result.html?complete=1');
    return;
  }
  try {
    const result = await completeFlowStep(currentReportFlowStep.step_id);
    if (result && result.next_step) {
      navigateToFlowStep(result.next_step);
      return;
    }
    navigateTo('result.html?complete=1');
  } catch (e) {
    showWarning('流程推进失败：' + e.message);
  }
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
  content.innerHTML = '';
  const warningDiv = document.createElement('div');
  warningDiv.className = 'warning-message';
  warningDiv.innerHTML = [
    '<h2>提示</h2>',
    '<p>' + escHtml(message || '您还没有完成剧情体验的全部流程。') + '</p>'
  ].join('');
  content.appendChild(warningDiv);
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

document.addEventListener('DOMContentLoaded', async function () {
  if (!localStorage.getItem('participant_id')) {
    await startParticipantSession();
  }
  initResult();
});
