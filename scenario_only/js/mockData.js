/* ============================================================
   mockData.js — 集中管理问卷、剧情、维度数据
   TODO: 后续替换为从后端 API 获取
   ============================================================ */

// ============================================================
// 1. 问卷题目数据
// ============================================================
let questionnaireItems = [
  {
    question_id: 'q_001',
    question_text: '我是一个爱说话、健谈的人',
    question_type: 'likert',
    required: true,
    page: 1,
    dimension_name: '外向性-社交',
    dimension_code: 'extraversion_sociability',
    parent_dimension: '外向性',
    parent_dimension_code: 'extraversion',
    facet_name: '社交',
    facet_code: 'sociability',
    reverse_scored: false,
    scale_min: 1,
    scale_max: 5,
    options: [
      { option_id: 'q_001_a', option_text: '非常不同意', score: 1 },
      { option_id: 'q_001_b', option_text: '比较不同意', score: 2 },
      { option_id: 'q_001_c', option_text: '不确定', score: 3 },
      { option_id: 'q_001_d', option_text: '比较同意', score: 4 },
      { option_id: 'q_001_e', option_text: '非常同意', score: 5 }
    ]
  },
  {
    question_id: 'q_002',
    question_text: '我是一个有条理、做事有计划的人',
    question_type: 'likert',
    required: true,
    page: 1,
    dimension_name: '尽责性-条理',
    dimension_code: 'conscientiousness_order',
    parent_dimension: '尽责性',
    parent_dimension_code: 'conscientiousness',
    facet_name: '条理',
    facet_code: 'order',
    reverse_scored: false,
    scale_min: 1,
    scale_max: 5,
    options: [
      { option_id: 'q_002_a', option_text: '非常不同意', score: 1 },
      { option_id: 'q_002_b', option_text: '比较不同意', score: 2 },
      { option_id: 'q_002_c', option_text: '不确定', score: 3 },
      { option_id: 'q_002_d', option_text: '比较同意', score: 4 },
      { option_id: 'q_002_e', option_text: '非常同意', score: 5 }
    ]
  },
  {
    question_id: 'q_003',
    question_text: '我有时会比较害羞，不太主动与人交流',
    question_type: 'likert',
    required: true,
    page: 1,
    dimension_name: '外向性-社交',
    dimension_code: 'extraversion_sociability',
    parent_dimension: '外向性',
    parent_dimension_code: 'extraversion',
    facet_name: '社交',
    facet_code: 'sociability',
    reverse_scored: true,
    scale_min: 1,
    scale_max: 5,
    options: [
      { option_id: 'q_003_a', option_text: '非常不同意', score: 1 },
      { option_id: 'q_003_b', option_text: '比较不同意', score: 2 },
      { option_id: 'q_003_c', option_text: '不确定', score: 3 },
      { option_id: 'q_003_d', option_text: '比较同意', score: 4 },
      { option_id: 'q_003_e', option_text: '非常同意', score: 5 }
    ]
  },
  {
    question_id: 'q_004',
    question_text: '请简单描述一下您对本次研究的感受或建议：',
    question_type: 'text_input',
    required: false,
    page: 1,
    dimension_name: '开放性-想象',
    dimension_code: 'openness_imagination',
    parent_dimension: '开放性',
    parent_dimension_code: 'openness',
    facet_name: '想象',
    facet_code: 'imagination',
    reverse_scored: false,
    scale_min: 1,
    scale_max: 5,
    options: []
  }
];

// ============================================================
// 2. 剧情游戏情景数据
// ============================================================
let gameScenes = [
  {
    scene_id: 'scene_001',
    scene_title: '列车旅途',
    scene_order: 1,
    scene_text: '列车平稳提速，窗外的田野与建筑飞速后退。我调整好座椅靠背，把水杯放进前方的网兜里。邻座也是一位独自出行的旅客，膝盖上摊着一本翻折过的旅行杂志，正对着某一页出神，偶尔抬头看一眼窗外流过的路标。',
    question_text: '旅途中你与陌生人交流的倾向更接近？',
    dimension_name: '外向性-社交',
    dimension_code: 'extraversion_sociability',
    parent_dimension: '外向性',
    parent_dimension_code: 'extraversion',
    facet_name: '社交',
    facet_code: 'sociability',
    reverse_scored: false,
    background_image_url: 'assets/images/default-travel.svg',
    options: [
      { option_label: 'A', option_text: '基本不说话，只在进出时点头示意。', score: 1 },
      { option_label: 'B', option_text: '指着杂志上的一页简单聊两句。', score: 2 },
      { option_label: 'C', option_text: '聊上十来分钟，分享各自的见闻。', score: 3 },
      { option_label: 'D', option_text: '从景点聊到饮食，一路基本都在交谈。', score: 4 }
    ]
  },
  {
    scene_id: 'scene_002',
    scene_title: '旧书店',
    scene_order: 2,
    scene_text: '周末的午后，我偶然走进一条从未留意过的小巷。巷子深处有一家堆满书籍的旧书店，门口的黑板上用粉笔写着"今日推荐：未知的冒险"。店内灯光昏黄，层层叠叠的书架间散发着纸张特有的气息。角落里有一本封面已经泛黄的旅行笔记，翻开一看，里面密密麻麻记录着作者在世界各地的见闻和思考。',
    question_text: '面对这本陌生的旅行笔记，你更可能怎么做？',
    dimension_name: '开放性-好奇',
    dimension_code: 'openness_curiosity',
    parent_dimension: '开放性',
    parent_dimension_code: 'openness',
    facet_name: '好奇',
    facet_code: 'curiosity',
    reverse_scored: false,
    background_image_url: 'assets/images/default-travel.svg',
    options: [
      { option_label: 'A', option_text: '随手翻两页就放回原位，继续找自己熟悉的书。', score: 1 },
      { option_label: 'B', option_text: '大致浏览一下目录和几段有趣的内容。', score: 2 },
      { option_label: 'C', option_text: '找个角落坐下来，仔细读上几章。', score: 3 },
      { option_label: 'D', option_text: '被深深吸引，决定买下这本书并计划去探索其中提到的地方。', score: 4 }
    ]
  },
  {
    scene_id: 'scene_003',
    scene_title: '街头求助',
    scene_order: 3,
    scene_text: '下班路上，天色已经暗了下来。地铁出口的通道里，一位老人坐在地板上，面前放着一个纸杯，里面只有零星的几枚硬币。深秋的风从通道口灌进来，老人缩了缩肩膀，用粗糙的手拢了拢身上单薄的外套。周围的人行色匆匆，很少有人停下脚步。',
    question_text: '看到这一幕，你更可能会怎么做？',
    dimension_name: '宜人性-同情',
    dimension_code: 'agreeableness_compassion',
    parent_dimension: '宜人性',
    parent_dimension_code: 'agreeableness',
    facet_name: '同情',
    facet_code: 'compassion',
    reverse_scored: false,
    background_image_url: 'assets/images/default-travel.svg',
    options: [
      { option_label: 'A', option_text: '当作没看见，继续赶路。', score: 1 },
      { option_label: 'B', option_text: '放慢脚步看一眼，犹豫一下还是走了。', score: 2 },
      { option_label: 'C', option_text: '停下来在纸杯里放一些零钱，然后离开。', score: 3 },
      { option_label: 'D', option_text: '蹲下来询问老人是否需要帮助，然后去买一份热食和暖贴送给他。', score: 4 }
    ]
  }
];

// ============================================================
// 3. 维度定义数据
// ============================================================
const dimensionDefinitions = [
  // ---- 开放性 ----
  {
    dimension_name: '开放性-审美',
    dimension_code: 'openness_aesthetic',
    parent_dimension: '开放性',
    parent_dimension_code: 'openness',
    facet_name: '审美',
    facet_code: 'aesthetic',
    dimension_description: '反映个体对艺术、美感、音乐、文学、自然景观和审美体验的敏感性与兴趣。'
  },
  {
    dimension_name: '开放性-好奇',
    dimension_code: 'openness_curiosity',
    parent_dimension: '开放性',
    parent_dimension_code: 'openness',
    facet_name: '好奇',
    facet_code: 'curiosity',
    dimension_description: '反映个体对新知识、新经验、新观点和复杂问题的探索兴趣与求知倾向。'
  },
  {
    dimension_name: '开放性-想象',
    dimension_code: 'openness_imagination',
    parent_dimension: '开放性',
    parent_dimension_code: 'openness',
    facet_name: '想象',
    facet_code: 'imagination',
    dimension_description: '反映个体在想象、联想、创造性构思和非现实情境加工方面的倾向。'
  },
  // ---- 宜人性 ----
  {
    dimension_name: '宜人性-同情',
    dimension_code: 'agreeableness_compassion',
    parent_dimension: '宜人性',
    parent_dimension_code: 'agreeableness',
    facet_name: '同情',
    facet_code: 'compassion',
    dimension_description: '反映个体对他人处境、感受和需要的关心程度，以及愿意提供帮助和支持的倾向。'
  },
  {
    dimension_name: '宜人性-谦恭',
    dimension_code: 'agreeableness_modesty',
    parent_dimension: '宜人性',
    parent_dimension_code: 'agreeableness',
    facet_name: '谦恭',
    facet_code: 'modesty',
    dimension_description: '反映个体在社会互动中保持谦逊、尊重他人、不夸大个人功劳和避免自我中心表达的倾向。'
  },
  {
    dimension_name: '宜人性-信任',
    dimension_code: 'agreeableness_trust',
    parent_dimension: '宜人性',
    parent_dimension_code: 'agreeableness',
    facet_name: '信任',
    facet_code: 'trust',
    dimension_description: '反映个体相信他人善意、可靠性和合作意图的倾向，以及在人际关系中较少怀疑和防备的特点。'
  },
  // ---- 外向性 ----
  {
    dimension_name: '外向性-社交',
    dimension_code: 'extraversion_sociability',
    parent_dimension: '外向性',
    parent_dimension_code: 'extraversion',
    facet_name: '社交',
    facet_code: 'sociability',
    dimension_description: '反映个体在社交情境中主动交流、表达和参与互动的倾向。'
  },
  {
    dimension_name: '外向性-果断',
    dimension_code: 'extraversion_assertiveness',
    parent_dimension: '外向性',
    parent_dimension_code: 'extraversion',
    facet_name: '果断',
    facet_code: 'assertiveness',
    dimension_description: '反映个体在群体或任务情境中表达意见、提出主张、推动决策和承担主导角色的倾向。'
  },
  {
    dimension_name: '外向性-活力',
    dimension_code: 'extraversion_energy',
    parent_dimension: '外向性',
    parent_dimension_code: 'extraversion',
    facet_name: '活力',
    facet_code: 'energy',
    dimension_description: '反映个体日常活动中的精力水平、行动积极性、兴奋感和参与外部活动的倾向。'
  },
  // ---- 尽责性 ----
  {
    dimension_name: '尽责性-条理',
    dimension_code: 'conscientiousness_order',
    parent_dimension: '尽责性',
    parent_dimension_code: 'conscientiousness',
    facet_name: '条理',
    facet_code: 'order',
    dimension_description: '反映个体在任务安排、计划执行、环境整理和秩序管理方面的倾向。'
  },
  {
    dimension_name: '尽责性-效率',
    dimension_code: 'conscientiousness_efficiency',
    parent_dimension: '尽责性',
    parent_dimension_code: 'conscientiousness',
    facet_name: '效率',
    facet_code: 'efficiency',
    dimension_description: '反映个体高效完成任务、避免拖延、集中精力并持续推进目标的倾向。'
  },
  {
    dimension_name: '尽责性-负责',
    dimension_code: 'conscientiousness_responsibility',
    parent_dimension: '尽责性',
    parent_dimension_code: 'conscientiousness',
    facet_name: '负责',
    facet_code: 'responsibility',
    dimension_description: '反映个体遵守承诺、履行义务、可靠可信并对任务结果承担责任的倾向。'
  },
  // ---- 情绪稳定性 ----
  {
    dimension_name: '情绪稳定性-焦虑',
    dimension_code: 'emotional_stability_anxiety',
    parent_dimension: '情绪稳定性',
    parent_dimension_code: 'emotional_stability',
    facet_name: '焦虑',
    facet_code: 'anxiety',
    dimension_description: '反映个体在压力、不确定性或潜在威胁情境中产生紧张、担忧和不安反应的倾向。'
  },
  {
    dimension_name: '情绪稳定性-抑郁',
    dimension_code: 'emotional_stability_depression',
    parent_dimension: '情绪稳定性',
    parent_dimension_code: 'emotional_stability',
    facet_name: '抑郁',
    facet_code: 'depression',
    dimension_description: '反映个体体验低落、沮丧、无助、兴趣下降和消极自我感受的倾向。'
  },
  {
    dimension_name: '情绪稳定性-易变',
    dimension_code: 'emotional_stability_volatility',
    parent_dimension: '情绪稳定性',
    parent_dimension_code: 'emotional_stability',
    facet_name: '易变',
    facet_code: 'volatility',
    dimension_description: '反映个体情绪起伏、易怒、冲动反应和情绪调节困难的倾向。'
  }
];

// ============================================================
// 4. 从 localStorage 加载编辑器数据（覆盖默认值）
// ============================================================
(function loadEditorData() {
  const qData = localStorage.getItem('editor_questionnaire_items');
  if (qData) {
    try { questionnaireItems = JSON.parse(qData); } catch (e) { /* ignore */ }
  }
  const sData = localStorage.getItem('editor_game_scenes');
  if (sData) {
    try { gameScenes = JSON.parse(sData); } catch (e) { /* ignore */ }
  }
})();
