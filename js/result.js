/* ============================================================
   result.js — 最终人格报告页
   ============================================================ */

let currentReportFlowStep = null;

async function initResult() {
  removeLegacyResultActions();

  const participantId = localStorage.getItem('participant_id');
  if (!participantId) {
    showWarning('未找到参与会话，请联系研究者或重新打开入口链接。');
    return;
  }

  const stepId = getQueryParam('step_id') || '';
  if (getQueryParam('complete') === '1' && stepId) {
    try {
      await completeFlowStep(stepId);
    } catch (e) {
      console.warn('[result] 完成流程步骤失败:', e.message);
    }
  }

  try {
    const report = await getResultScores();
    if (!report) {
      showWarning('人格报告尚未生成，请先完成全部流程。');
      return;
    }
    renderPersonalityReport(report);
  } catch (e) {
    showWarning('人格报告加载失败：' + e.message);
  }
}

function formatMean(value) {
  const number = Number(value);
  if (!isFinite(number)) return '-';
  return number.toFixed(2);
}

function formatSigned(value) {
  const number = Number(value);
  if (!isFinite(number)) return '-';
  return (number > 0 ? '+' : '') + number.toFixed(2);
}

function clampPercent(value, scaleMin, scaleMax) {
  const number = Number(value);
  if (!isFinite(number)) return 0;
  const min = Number(scaleMin || 1);
  const max = Number(scaleMax || 5);
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((number - min) / (max - min)) * 100));
}

const PERSONALITY_DIMENSION_ORDER = ['外向性', '宜人性', '尽责性', '情绪稳定性', '开放性'];

const PERSONALITY_DIMENSION_DEFINITIONS = [
  {
    dimension: '外向性',
    definition: '外向性描述人际关系的舒适度，这是主要从外部获得满足的状态。它体现在人际交流的乐趣程度、数量、密度等方面，以及获得乐趣的能力。性格外向的人更乐于助人、自信、善于交谈和乐于交际。'
  },
  {
    dimension: '宜人性',
    definition: '宜人性体现了合作与社会和谐之间的个体差异。它描述了一个人对他周围的人或事物的态度。宜人性被认为是善良，信任，同情，合作和体贴的。'
  },
  {
    dimension: '尽责性（责任心）',
    definition: '责任心表示个人的谨慎或警惕，例如个人倾向于在采取行动之前先认真思考。责任心分数高的人通常是有效率的，有条理的和有计划的。'
  },
  {
    dimension: '情绪稳定性',
    definition: '情绪稳定性 描述了一个人在情绪反应、压力应对和心理平衡方面的稳定程度，这与个体的情绪调节能力和压力承受能力有关。情绪稳定性较高的人通常较少受到焦虑、担忧、恐惧、孤独和沮丧等负面情绪的持续影响，在面对压力或挫折时更容易保持冷静、理性和稳定，能够较好地调节情绪并恢复心理平衡。'
  },
  {
    dimension: '开放性',
    definition: '开放性指体验或体验新颖事物的开放性，反映了个人的好奇心，创造力以及对新颖性和多样性的偏好。它也被描述为一个人的想象力或独立性的程度。高度开放的人们热衷于突破传统，并通过寻求新鲜而令人兴奋的经历来追求自我实现。'
  }
];

const PERSONALITY_REPORT_DISCLAIMER = [
  '本报告结果仅依据本次测量中作答者提交的问卷/测评数据生成，仅反映作答者在本次测量情境下的相对表现与倾向特征。测评结果受作答状态、理解方式、作答认真程度、情境因素以及量表适用范围等因素影响，不能完全代表作答者稳定、全面或绝对的心理特征。',
  '本报告仅供个人了解、学习研究或参考使用，不应作为临床诊断、心理诊断、就业录用、人员筛选、重大决策或其他高风险判断的唯一依据。如需进行专业判断，请结合更多资料，并咨询相关领域专业人员。'
];

function getScoreDimension(score) {
  return score.dimension || score.parent_dimension || '-';
}

function sortPersonalityScores(scores) {
  return (scores || []).slice().sort(function (a, b) {
    const aIndex = PERSONALITY_DIMENSION_ORDER.indexOf(getScoreDimension(a));
    const bIndex = PERSONALITY_DIMENSION_ORDER.indexOf(getScoreDimension(b));
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    }
    return String(getScoreDimension(a)).localeCompare(String(getScoreDimension(b)), 'zh-CN');
  });
}

function radarNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return isFinite(number) ? number : fallback;
}

function formatTScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!isFinite(number)) return '-';
  return Math.abs(number - Math.round(number)) < 0.05 ? String(Math.round(number)) : number.toFixed(1);
}

function radarAngle(index, total) {
  return (-Math.PI / 2) + (Math.PI * 2 * index / total);
}

function radarPoint(index, total, value, scaleMin, scaleMax, center, radius) {
  const min = Number(scaleMin || 1);
  const max = Number(scaleMax || 5);
  const bounded = Math.max(min, Math.min(max, radarNumber(value, min)));
  const ratio = max > min ? (bounded - min) / (max - min) : 0;
  const angle = radarAngle(index, total);
  const distance = ratio * radius;
  return {
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance
  };
}

function radarOffsetPoint(index, total, value, scaleMin, scaleMax, center, radius, offset) {
  const point = radarPoint(index, total, value, scaleMin, scaleMax, center, radius);
  const angle = radarAngle(index, total);
  return {
    x: point.x + Math.cos(angle) * offset,
    y: point.y + Math.sin(angle) * offset
  };
}

function radarPointString(points) {
  return points.map(function (point) {
    return point.x.toFixed(1) + ',' + point.y.toFixed(1);
  }).join(' ');
}

function getScoreTScore(score) {
  const existing = radarNumber(score.t_score, null);
  if (existing !== null) return existing;
  const meanScore = radarNumber(score.mean_score, null);
  const normMean = radarNumber(score.norm_mean, null);
  const normSd = radarNumber(score.norm_sd, null);
  if (meanScore === null || normMean === null || !normSd) return null;
  return 50 + 10 * ((meanScore - normMean) / normSd);
}

function getTScoreScale(scores) {
  const values = scores.map(getScoreTScore).filter(function (value) {
    return value !== null && isFinite(value);
  });
  values.push(50);
  const maxDeviation = values.reduce(function (max, value) {
    return Math.max(max, Math.abs(value - 50));
  }, 20);
  const span = Math.max(20, Math.ceil(maxDeviation / 10) * 10);
  return { min: 50 - span, max: 50 + span };
}

function buildPersonalityRadar(scores) {
  const size = 520;
  const center = size / 2;
  const radius = 178;
  const labelRadius = 222;
  const levels = 4;
  const total = scores.length;
  const scale = getTScoreScale(scores);
  const min = scale.min;
  const max = scale.max;

  let svg = [
    '<div class="personality-radar-wrap">',
      '<div class="personality-radar">',
        '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="大五人格 T 分数雷达图：个人T分数与常模T分数50对比">'
  ].join('');

  for (let level = levels; level >= 1; level--) {
    const value = min + ((max - min) * level / levels);
    const gridPoints = scores.map(function (_, index) {
      return radarPoint(index, total, value, min, max, center, radius);
    });
    svg += '<polygon class="radar-grid" points="' + radarPointString(gridPoints) + '"></polygon>';
  }

  scores.forEach(function (_, index) {
    const end = radarPoint(index, total, max, min, max, center, radius);
    svg += '<line class="radar-axis" x1="' + center + '" y1="' + center + '" x2="' + end.x.toFixed(1) + '" y2="' + end.y.toFixed(1) + '"></line>';
  });

  for (let level = 0; level <= levels; level++) {
    const value = min + ((max - min) * level / levels);
    const y = center - ((value - min) / (max - min || 1)) * radius;
    svg += '<text class="radar-scale-label" x="' + (center + 8) + '" y="' + y.toFixed(1) + '">T' + formatTScore(value) + '</text>';
  }

  scores.forEach(function (score, index) {
    const labelPoint = radarPoint(index, total, max, min, max, center, labelRadius);
    const anchor = Math.abs(labelPoint.x - center) < 8 ? 'middle' : (labelPoint.x > center ? 'start' : 'end');
    svg += '<text class="radar-label" text-anchor="' + anchor + '" x="' + labelPoint.x.toFixed(1) + '" y="' + labelPoint.y.toFixed(1) + '">' + escHtml(getScoreDimension(score)) + '</text>';
  });

  const personalPoints = scores.map(function (score, index) {
    const tScore = getScoreTScore(score);
    return radarPoint(index, total, tScore === null ? 50 : tScore, min, max, center, radius);
  });
  const normPoints = scores.map(function (score, index) {
    return radarPoint(index, total, radarNumber(score.norm_t_score, 50), min, max, center, radius);
  });

  svg += [
        '<polygon class="radar-area personal" points="' + radarPointString(personalPoints) + '"></polygon>',
        '<polygon class="radar-area norm" points="' + radarPointString(normPoints) + '"></polygon>',
        '<polygon class="radar-line personal" points="' + radarPointString(personalPoints) + '"></polygon>',
        '<polygon class="radar-line norm" points="' + radarPointString(normPoints) + '"></polygon>',
  ].join('');

  scores.forEach(function (score, index) {
    const tScore = getScoreTScore(score);
    const labelValue = tScore === null ? 50 : tScore;
    const scoreLabelPoint = radarOffsetPoint(index, total, labelValue, min, max, center, radius, 18);
    const anchor = Math.abs(scoreLabelPoint.x - center) < 8 ? 'middle' : (scoreLabelPoint.x > center ? 'start' : 'end');
    svg += '<text class="radar-score-label" text-anchor="' + anchor + '" x="' + scoreLabelPoint.x.toFixed(1) + '" y="' + scoreLabelPoint.y.toFixed(1) + '">T=' + formatTScore(tScore) + '</text>';
  });

  svg += [
      '</svg>',
      '</div>',
      '<div class="radar-legend" aria-label="雷达图图例">',
        '<span><i class="legend-swatch personal"></i>个人T分数</span>',
        '<span><i class="legend-swatch norm"></i>常模T分数 50</span>',
      '</div>',
    '</div>'
  ].join('');

  return svg;
}

function buildPersonalityDisclaimer() {
  return [
    '<div class="personality-disclaimer" role="note">',
      '<p>' + escHtml(PERSONALITY_REPORT_DISCLAIMER[0]) + '</p>',
      '<p>' + escHtml(PERSONALITY_REPORT_DISCLAIMER[1]) + '</p>',
    '</div>'
  ].join('');
}

function buildPersonalityDefinitionList() {
  let html = [
    '<div class="dimension-definitions">',
      '<h3>各维度定义</h3>',
      '<dl>'
  ].join('');

  PERSONALITY_DIMENSION_DEFINITIONS.forEach(function (item) {
    html += [
      '<div class="dimension-definition-item">',
        '<dt>' + escHtml(item.dimension) + '</dt>',
        '<dd>' + escHtml(item.definition) + '</dd>',
      '</div>'
    ].join('');
  });

  html += [
      '</dl>',
    '</div>'
  ].join('');
  return html;
}

function renderPersonalityReport(report) {
  removeLegacyResultActions();

  const header = document.querySelector('.completion-header');
  if (header) {
    const title = header.querySelector('h1');
    const desc = header.querySelector('p');
    if (title) title.textContent = '人格报告';
    if (desc) desc.textContent = '以下结果使用 T 分数展示您的大五人格维度相对常模的位置。';
  }

  const content = document.getElementById('resultContent');
  if (!content) return;
  const scores = sortPersonalityScores(report.personality_dimension_scores || report.parent_dimension_scores || []);

  if (!scores.length) {
    content.innerHTML = '<div class="warning-message"><h2>提示</h2><p>暂无可展示的人格报告数据。</p></div>';
    return;
  }

  const html = [
    '<div class="result-section">',
      '<h2>大五人格维度</h2>',
      buildPersonalityDisclaimer(),
      '<p class="result-note">T 分数雷达图展示每个维度的个人T分数，并以常模T分数 50 作为基线。</p>',
      buildPersonalityRadar(scores),
      buildPersonalityDefinitionList(),
    '</div>'
  ].join('');
  content.innerHTML = html;
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

function formatScoreOverMax(totalScore, totalMaxScore) {
  const score = totalScore || 0;
  if (totalMaxScore == null) return String(score);
  return score + '/' + (totalMaxScore || 0);
}

function renderParentScores(scores) {
  const container = document.getElementById('parentDimensionScores');
  if (!container) return;
  if (!scores || scores.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">暂无一级维度得分。</p>';
    return;
  }

  let html = '<table class="dimension-table">';
  html += '<tr><th class="dim-header">维度</th><th class="dim-header">得分/满分</th><th class="dim-header">题目数</th></tr>';

  scores.forEach(function (s) {
    html += '<tr class="dimension-row">';
    html += '<td class="dim-label">' + escHtml(s.parent_dimension || '-') + '</td>';
    html += '<td class="dim-data">' + formatScoreOverMax(s.total_score, s.total_max_score) + '</td>';
    html += '<td class="dim-data">' + (s.item_count || 0) + '</td>';
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
  html += '<tr><th class="dim-header">子维度</th><th class="dim-header">得分/满分</th><th class="dim-header">题目数</th><th class="dim-header">说明</th></tr>';

  scores.forEach(function (s) {
    const def = dimensionDefinitions.find(function (d) { return d.dimension_code === s.dimension_code; });
    const desc = def ? def.dimension_description : '';

    html += '<tr class="dimension-row">';
    html += '<td class="dim-label">' + escHtml(s.dimension_name || '-') + '<br><span class="dim-desc">' + escHtml(desc) + '</span></td>';
    html += '<td class="dim-data">' + formatScoreOverMax(s.total_score, s.total_max_score) + '</td>';
    html += '<td class="dim-data">' + (s.item_count || 0) + '</td>';
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
    '<td class="dim-data">得分/满分：' + formatScoreOverMax(score.total_score, score.total_max_score) + '</td>',
    '<td class="dim-data">总题数：' + (score.total_item_count || 0) + '</td>',
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
