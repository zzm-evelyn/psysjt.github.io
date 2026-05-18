/* ============================================================
   scoring.js — 计分逻辑（三层结构）
   TODO: 后续迁移到 Python 后端
   ============================================================ */

/**
 * 反向计分
 * @param {number} rawScore - 原始分数
 * @param {number} scaleMin - 量表最小值
 * @param {number} scaleMax - 量表最大值
 * @returns {number} 反向计分后的分数
 */
function reverseScore(rawScore, scaleMin, scaleMax) {
  return scaleMax + scaleMin - rawScore;
}

/**
 * 计算最终分数
 * @param {number} rawScore - 原始分数
 * @param {boolean} isReverse - 是否需要反向计分
 * @param {number} scaleMin - 量表最小值
 * @param {number} scaleMax - 量表最大值
 * @returns {number} 最终分数
 */
function computeFinalScore(rawScore, isReverse, scaleMin, scaleMax) {
  if (isReverse) {
    return reverseScore(rawScore, scaleMin, scaleMax);
  }
  return rawScore;
}

/**
 * 合并问卷和剧情的所有作答记录，统一格式
 * @returns {Array} 所有作答记录，每条包含 final_score、dimension_code、parent_dimension_code 等
 */
function getAllResponses() {
  const data = getParticipantData();
  const allResponses = [];

  // 问卷作答
  (data.questionnaire_responses || []).forEach(r => {
    const question = questionnaireItems.find(q => q.question_id === r.question_id);
    if (!question) return;
    const finalScore = computeFinalScore(r.raw_score, question.reverse_scored, question.scale_min, question.scale_max);
    allResponses.push({
      source: 'questionnaire',
      question_id: r.question_id,
      dimension_name: question.dimension_name,
      dimension_code: question.dimension_code,
      parent_dimension: question.parent_dimension,
      parent_dimension_code: question.parent_dimension_code,
      facet_name: question.facet_name,
      facet_code: question.facet_code,
      final_score: finalScore
    });
  });

  // 剧情作答
  (data.game_responses || []).forEach(r => {
    const scene = gameScenes.find(s => s.scene_id === r.scene_id);
    if (!scene) return;
    // 计算剧情的 scale_min / scale_max
    const scores = scene.options.map(o => o.score);
    const scaleMin = Math.min(...scores);
    const scaleMax = Math.max(...scores);
    const finalScore = computeFinalScore(r.raw_score, scene.reverse_scored, scaleMin, scaleMax);
    allResponses.push({
      source: 'game',
      scene_id: r.scene_id,
      dimension_name: scene.dimension_name,
      dimension_code: scene.dimension_code,
      parent_dimension: scene.parent_dimension,
      parent_dimension_code: scene.parent_dimension_code,
      facet_name: scene.facet_name,
      facet_code: scene.facet_code,
      final_score: finalScore
    });
  });

  return allResponses;
}

/**
 * 计算 15 个子维度得分
 * @param {Array} allResponses - 所有作答记录
 * @returns {Array} facet_dimension_scores
 */
function calculateFacetScores(allResponses) {
  const facetMap = {};

  allResponses.forEach(r => {
    const code = r.dimension_code;
    if (!facetMap[code]) {
      facetMap[code] = {
        dimension_name: r.dimension_name,
        dimension_code: r.dimension_code,
        parent_dimension: r.parent_dimension,
        parent_dimension_code: r.parent_dimension_code,
        facet_name: r.facet_name,
        facet_code: r.facet_code,
        total_score: 0,
        item_count: 0
      };
    }
    facetMap[code].total_score += r.final_score;
    facetMap[code].item_count += 1;
  });

  // 确保 15 个子维度都有条目（即使为 0）
  const result = [];
  dimensionDefinitions.forEach(def => {
    const code = def.dimension_code;
    if (facetMap[code]) {
      const f = facetMap[code];
      result.push({
        dimension_name: f.dimension_name,
        dimension_code: f.dimension_code,
        parent_dimension: f.parent_dimension,
        parent_dimension_code: f.parent_dimension_code,
        facet_name: f.facet_name,
        facet_code: f.facet_code,
        total_score: f.total_score,
        item_count: f.item_count,
        average_score: f.item_count > 0 ? parseFloat((f.total_score / f.item_count).toFixed(2)) : 0
      });
    } else {
      result.push({
        dimension_name: def.dimension_name,
        dimension_code: def.dimension_code,
        parent_dimension: def.parent_dimension,
        parent_dimension_code: def.parent_dimension_code,
        facet_name: def.facet_name,
        facet_code: def.facet_code,
        total_score: 0,
        item_count: 0,
        average_score: 0
      });
    }
  });

  return result;
}

/**
 * 计算 5 个一级大维度得分
 * 重要：直接用每道题的 final_score 按 parent_dimension_code 汇总，不从子维度累加
 * @param {Array} allResponses - 所有作答记录
 * @returns {Array} parent_dimension_scores
 */
function calculateParentDimensionScores(allResponses) {
  const parentMap = {};

  allResponses.forEach(r => {
    const code = r.parent_dimension_code;
    if (!parentMap[code]) {
      parentMap[code] = {
        parent_dimension: r.parent_dimension,
        parent_dimension_code: r.parent_dimension_code,
        total_score: 0,
        item_count: 0,
        included_facets: new Set()
      };
    }
    parentMap[code].total_score += r.final_score;
    parentMap[code].item_count += 1;
    parentMap[code].included_facets.add(r.facet_name);
  });

  // 按维度定义的顺序输出
  const parentOrder = [
    { name: '开放性', code: 'openness' },
    { name: '宜人性', code: 'agreeableness' },
    { name: '外向性', code: 'extraversion' },
    { name: '尽责性', code: 'conscientiousness' },
    { name: '情绪稳定性', code: 'emotional_stability' }
  ];

  return parentOrder.map(p => {
    const entry = parentMap[p.code];
    if (entry) {
      return {
        parent_dimension: entry.parent_dimension,
        parent_dimension_code: entry.parent_dimension_code,
        total_score: entry.total_score,
        item_count: entry.item_count,
        average_score: entry.item_count > 0 ? parseFloat((entry.total_score / entry.item_count).toFixed(2)) : 0,
        included_facets: Array.from(entry.included_facets)
      };
    }
    return {
      parent_dimension: p.name,
      parent_dimension_code: p.code,
      total_score: 0,
      item_count: 0,
      average_score: 0,
      included_facets: []
    };
  });
}

/**
 * 计算总体得分
 * @param {Array} allResponses - 所有作答记录
 * @returns {Object} overall_score
 */
function calculateOverallScore(allResponses) {
  const totalScore = allResponses.reduce((sum, r) => sum + r.final_score, 0);
  const totalItemCount = allResponses.length;

  return {
    total_score: totalScore,
    total_item_count: totalItemCount,
    total_average_score: totalItemCount > 0 ? parseFloat((totalScore / totalItemCount).toFixed(2)) : 0
  };
}

/**
 * 计算全部得分并保存到 localStorage
 * @returns {Object} result_scores
 */
function calculateAllScores() {
  const allResponses = getAllResponses();
  const facetScores = calculateFacetScores(allResponses);
  const parentScores = calculateParentDimensionScores(allResponses);
  const overallScore = calculateOverallScore(allResponses);

  const resultScores = {
    parent_dimension_scores: parentScores,
    facet_dimension_scores: facetScores,
    overall_score: overallScore
  };

  saveResultScores(resultScores);
  return resultScores;
}
