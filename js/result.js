/* ============================================================
   result.js — 结果页面逻辑
   ============================================================ */

/**
 * 初始化结果页
 */
function initResult() {
  const data = getParticipantData();

  // 检查是否完成了问卷和游戏
  if (!data.questionnaire_completed || !data.game_completed) {
    showWarning();
    return;
  }

  // 计算得分
  const scores = calculateAllScores();

  // 渲染三层结果
  renderParentScores(scores.parent_dimension_scores);
  renderFacetScores(scores.facet_dimension_scores);
  renderOverallScore(scores.overall_score);
}

/**
 * 显示未完成警告
 */
function showWarning() {
  const content = document.getElementById('resultContent');
  if (!content) return;
  content.innerHTML = '';
  const warningDiv = document.createElement('div');
  warningDiv.className = 'warning-message';
  warningDiv.innerHTML = [
    '<h2>⚠️ 体验尚未完成</h2>',
    '<p>您还没有完成问卷填写和剧情体验的全部流程。</p>',
    '<p>请返回首页重新开始完整的体验流程。</p>',
    '<button class="btn btn-primary" onclick="navigateTo(\'index.html\')">返回首页</button>'
  ].join('');
  content.appendChild(warningDiv);
}

/**
 * 渲染一级大维度得分
 */
function renderParentScores(scores) {
  const container = document.getElementById('parentDimensionScores');
  if (!container || !scores || scores.length === 0) return;

  let html = '<table class="dimension-table">';
  html += '<tr><th class="dim-header">维度</th><th class="dim-header">总分</th><th class="dim-header">题目数</th><th class="dim-header">平均分</th></tr>';

  scores.forEach(s => {
    html += '<tr class="dimension-row">';
    html += '<td class="dim-label">' + s.parent_dimension + '</td>';
    html += '<td class="dim-data">' + s.total_score + '</td>';
    html += '<td class="dim-data">' + s.item_count + '</td>';
    html += '<td class="dim-data">' + s.average_score + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}

/**
 * 渲染子维度得分
 */
function renderFacetScores(scores) {
  const container = document.getElementById('facetDimensionScores');
  if (!container || !scores || scores.length === 0) return;

  let html = '<table class="dimension-table">';
  html += '<tr><th class="dim-header">子维度</th><th class="dim-header">总分</th><th class="dim-header">题目数</th><th class="dim-header">平均分</th><th class="dim-header">说明</th></tr>';

  scores.forEach(s => {
    // 查找维度描述
    const def = dimensionDefinitions.find(d => d.dimension_code === s.dimension_code);
    const desc = def ? def.dimension_description : '';

    html += '<tr class="dimension-row">';
    html += '<td class="dim-label">' + s.dimension_name + '<br><span class="dim-desc">' + desc + '</span></td>';
    html += '<td class="dim-data">' + s.total_score + '</td>';
    html += '<td class="dim-data">' + s.item_count + '</td>';
    html += '<td class="dim-data">' + s.average_score + '</td>';
    html += '<td class="dim-data">' + (s.item_count > 0 ? '' : '不足以计算') + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}

/**
 * 渲染总体得分
 */
function renderOverallScore(score) {
  const container = document.getElementById('overallScore');
  if (!container || !score) return;

  container.innerHTML = [
    '<table class="dimension-table">',
    '<tr class="dimension-row overall-row">',
    '<td class="dim-label">总体得分</td>',
    '<td class="dim-data">总分：' + score.total_score + '</td>',
    '<td class="dim-data">总题数：' + score.total_item_count + '</td>',
    '<td class="dim-data">平均分：' + score.total_average_score + '</td>',
    '</tr>',
    '</table>'
  ].join('');
}

// ============================================================
// 页面初始化
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  // 如果没有参与会话，先创建
  if (!localStorage.getItem('participant_id')) {
    startParticipantSession();
  }
  initResult();
});
