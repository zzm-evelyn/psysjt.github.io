/* ============================================================
   game.js — 两个情景游戏的呈现与提交
   ============================================================ */

let currentSceneIndex = 0;
let currentGame = null;
let orderedGameGroups = [];
let gameCompleted = false;
let currentFlowStep = null;
let pendingGameChoice = null;
let gameChoiceSubmitting = false;

function prepareGameScenes(rawScenes) {
  const scenes = (rawScenes || []).slice().sort(function (a, b) {
    return (a.display_order || a.scene_order || 0) - (b.display_order || b.scene_order || 0);
  });
  const midpoint = Math.max(1, Math.ceil(scenes.length / 2));

  return scenes.map(function (scene, idx) {
    const fallbackKey = idx < midpoint ? 'game_a' : 'game_b';
    const gameKey = normalizeGameKey(scene.game_key || fallbackKey);
    return {
      game_key: gameKey,
      game_title: scene.game_title || defaultGameTitle(gameKey),
      scene_id: scene.scene_id || '',
      scene_title: scene.scene_title || '',
      scene_order: scene.scene_order || idx + 1,
      display_order: scene.display_order || scene.scene_order || idx + 1,
      scene_text: scene.scene_text || '',
      question_text: scene.question_text || '',
      dimension_name: scene.dimension_name || '',
      dimension_code: scene.dimension_code || '',
      parent_dimension: scene.parent_dimension || '',
      parent_dimension_code: scene.parent_dimension_code || '',
      facet_name: scene.facet_name || '',
      facet_code: scene.facet_code || '',
      reverse_scored: scene.reverse_scored === true,
      background_image_url: scene.background_image_url || '',
      options: (scene.options || []).map(function (opt, optIdx) {
        return {
          option_label: opt.option_label || opt.option_id || String.fromCharCode(65 + optIdx),
          option_text: opt.option_text || '',
          score: opt.score !== undefined ? opt.score : optIdx + 1
        };
      })
    };
  });
}

async function loadGameScenesFromApi() {
  try {
    const remoteScenes = await apiGet('/game/scenes');
    if (Array.isArray(remoteScenes) && remoteScenes.length > 0) {
      gameScenes = prepareGameScenes(remoteScenes);
      console.log('[game] 已从后端加载剧情情景:', gameScenes.length);
      return;
    }
  } catch (e) {
    console.warn('[game] 后端剧情加载失败，使用本地备用数据:', e.message);
  }
  gameScenes = prepareGameScenes(gameScenes);
}

function buildGameGroups(scenes) {
  const groupMap = {};
  (scenes || []).forEach(function (scene) {
    const key = normalizeGameKey(scene.game_key);
    if (!groupMap[key]) {
      groupMap[key] = {
        key: key,
        title: scene.game_title || defaultGameTitle(key),
        scenes: []
      };
    }
    groupMap[key].scenes.push(scene);
  });

  Object.keys(groupMap).forEach(function (key) {
    groupMap[key].scenes.sort(function (a, b) {
      return (a.display_order || a.scene_order || 0) - (b.display_order || b.scene_order || 0);
    });
  });
  return groupMap;
}

async function resolveOrderedGameGroups(groupMap) {
  const order = await ensureGameOrder();
  const groups = [];
  order.forEach(function (key) {
    const normalized = normalizeGameKey(key);
    if (groupMap[normalized] && groupMap[normalized].scenes.length > 0) {
      groups.push(groupMap[normalized]);
    }
  });
  Object.keys(groupMap).forEach(function (key) {
    if (!groups.some(function (group) { return group.key === key; })) {
      groups.push(groupMap[key]);
    }
  });
  return groups;
}

function showGameLoadError(message) {
  var gameCard = document.querySelector('.game-card');
  if (gameCard) {
    gameCard.innerHTML = '<div class="error-message" style="display:block;">' + message + '</div>';
  }
}

function chooseCurrentGame() {
  if (currentFlowStep && currentFlowStep.game_key && orderedGameGroups.length) {
    setCurrentGameIndex(0);
    return orderedGameGroups[0];
  }
  const completed = getCompletedGameKeys();
  let index = getCurrentGameIndex();
  if (index >= orderedGameGroups.length) index = 0;

  if (orderedGameGroups[index] && completed.indexOf(orderedGameGroups[index].key) === -1) {
    setCurrentGameIndex(index);
    return orderedGameGroups[index];
  }

  const nextIndex = orderedGameGroups.findIndex(function (group) {
    return completed.indexOf(group.key) === -1;
  });
  if (nextIndex === -1) return null;
  setCurrentGameIndex(nextIndex);
  return orderedGameGroups[nextIndex];
}

function findSavedGameResponse(sceneId, gameKey) {
  const responses = JSON.parse(localStorage.getItem('game_responses') || '[]');
  const normalizedGameKey = normalizeGameKey(gameKey || (currentGame && currentGame.key) || '');
  return responses.find(function (response) {
    return response.scene_id === sceneId &&
      normalizeGameKey(response.game_key || normalizedGameKey) === normalizedGameKey;
  });
}

function firstIncompleteGameSceneIndex(scenes, gameKey) {
  scenes = scenes || [];
  for (var i = 0; i < scenes.length; i++) {
    if (!findSavedGameResponse(scenes[i].scene_id, gameKey)) return i;
  }
  return scenes.length;
}

function setClassEnabled(element, className, enabled) {
  if (!element) return;
  const classes = (element.className || '').split(/\s+/).filter(Boolean);
  const hasClass = classes.indexOf(className) !== -1;
  if (enabled && !hasClass) classes.push(className);
  if (!enabled && hasClass) {
    element.className = classes.filter(function (name) { return name !== className; }).join(' ');
    return;
  }
  element.className = classes.join(' ');
}

function updateGameOptionSelection(optionLabel) {
  document.querySelectorAll('.game-option-btn').forEach(function (button) {
    const selected = button.dataset.optionLabel === optionLabel;
    setClassEnabled(button, 'selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function renderGameConfirmAction() {
  const optionsContainer = document.getElementById('gameOptions');
  if (!optionsContainer) return null;

  let actions = optionsContainer.querySelector('.game-confirm-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'game-confirm-actions';

    const button = document.createElement('button');
    button.id = 'gameConfirmChoiceBtn';
    button.className = 'btn btn-success btn-lg game-confirm-btn';
    button.type = 'button';
    button.disabled = true;
    button.textContent = '确认选择';
    button.addEventListener('click', confirmGameChoice);
    actions.appendChild(button);
    optionsContainer.appendChild(actions);
  }
  return actions;
}

function updateGameConfirmAction() {
  const actions = renderGameConfirmAction();
  if (!actions) return;
  const button = actions.querySelector('.game-confirm-btn');
  const hasChoice = !!pendingGameChoice;
  setClassEnabled(actions, 'visible', hasChoice);
  if (button) {
    button.disabled = !hasChoice || gameChoiceSubmitting;
    button.textContent = gameChoiceSubmitting ? '保存中...' : '确认选择';
  }
}

function buildGameResponseData(scene, option) {
  return {
    participant_id: JSON.parse(localStorage.getItem('participant_id')),
    game_key: currentGame.key,
    game_title: currentGame.title,
    scene_id: scene.scene_id,
    selected_option_label: option.option_label,
    selected_option_text: option.option_text,
    raw_score: option.score,
    final_score: 0,
    dimension_name: scene.dimension_name,
    dimension_code: scene.dimension_code,
    parent_dimension: scene.parent_dimension,
    parent_dimension_code: scene.parent_dimension_code,
    facet_name: scene.facet_name,
    facet_code: scene.facet_code,
    answered_at: new Date().toISOString()
  };
}

async function resolveGameFlowContext() {
  const stepId = getQueryParam('step_id') || '';
  const gameKey = getQueryParam('game') || '';
  if (stepId || gameKey) {
    currentFlowStep = {
      step_id: stepId,
      type: 'game',
      game_key: gameKey ? normalizeGameKey(gameKey) : ''
    };
    return;
  }

  const flow = await getCurrentFlow();
  if (flow.flow_enabled && flow.current_step && flow.current_step.type === 'game') {
    currentFlowStep = flow.current_step;
  }
}

async function initGame() {
  markGameStart();
  await resolveGameFlowContext();
  await loadGameScenesFromApi();
  if (!gameScenes || gameScenes.length === 0) {
    showGameLoadError('暂时没有可体验的剧情情景，请联系研究者检查后台配置。');
    return;
  }

  orderedGameGroups = await resolveOrderedGameGroups(buildGameGroups(gameScenes));
  if (currentFlowStep && currentFlowStep.game_key) {
    const targetKey = normalizeGameKey(currentFlowStep.game_key);
    orderedGameGroups = orderedGameGroups.filter(function (group) {
      return group.key === targetKey;
    });
  }
  currentGame = chooseCurrentGame();
  if (!currentGame) {
    navigateTo('result.html');
    return;
  }

  currentSceneIndex = firstIncompleteGameSceneIndex(currentGame.scenes, currentGame.key);
  gameCompleted = false;
  renderScene(currentSceneIndex);
}

function renderScene(index) {
  const scenes = currentGame ? currentGame.scenes : [];
  if (index < 0 || index >= scenes.length) {
    showGameComplete();
    return;
  }

  currentSceneIndex = index;
  const scene = scenes[index];
  pendingGameChoice = null;
  gameChoiceSubmitting = false;

  var completeArea = document.getElementById('gameCompleteArea');
  if (completeArea) completeArea.style.display = 'none';
  var gameCard = document.querySelector('.game-card');
  if (gameCard) gameCard.style.display = 'block';

  const progressFill = document.getElementById('gameProgressFill');
  const progressText = document.getElementById('gameProgressText');
  if (progressFill) {
    progressFill.style.width = ((index / scenes.length) * 100) + '%';
  }
  if (progressText) {
    progressText.textContent = currentGame.title + ' · 场景 ' + (index + 1) + ' / ' + scenes.length;
  }

  const gameContainer = document.getElementById('gameContainer');
  if (gameContainer) {
    gameContainer.style.backgroundImage = '';
    gameContainer.classList.remove('has-bg');
  }
  if (gameContainer && scene.background_image_url) {
    const img = new Image();
    img.onload = function () {
      gameContainer.style.backgroundImage = 'url(' + scene.background_image_url + ')';
      gameContainer.classList.add('has-bg');
    };
    img.onerror = function () {
      gameContainer.classList.remove('has-bg');
    };
    img.src = scene.background_image_url;
  }

  const titleEl = document.getElementById('sceneTitle');
  if (titleEl) titleEl.textContent = scene.scene_title;

  const textEl = document.getElementById('sceneText');
  if (textEl) {
    textEl.style.animation = 'none';
    textEl.offsetHeight;
    textEl.textContent = scene.scene_text;
    textEl.style.animation = 'cardEntrance 0.5s ease-out';
  }

  const qEl = document.getElementById('gameQuestionText');
  if (qEl) {
    qEl.style.animation = 'none';
    qEl.offsetHeight;
    qEl.textContent = scene.question_text;
    qEl.style.animation = 'cardEntrance 0.4s ease-out 0.1s both';
  }

  const optionsContainer = document.getElementById('gameOptions');
  if (!optionsContainer) return;
  optionsContainer.innerHTML = '';

  scene.options.forEach(function (opt, i) {
    const btn = document.createElement('button');
    btn.className = 'game-option-btn';
    btn.type = 'button';
    btn.dataset.optionLabel = opt.option_label;
    btn.setAttribute('aria-pressed', 'false');
    btn.style.animation = 'cardEntrance 0.4s ease-out ' + (0.15 + i * 0.08) + 's both';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'option-label';
    labelSpan.textContent = opt.option_label;

    const textSpan = document.createElement('span');
    textSpan.className = 'option-text';
    textSpan.textContent = opt.option_text;

    btn.appendChild(labelSpan);
    btn.appendChild(textSpan);

    btn.addEventListener('click', function () {
      handleChoice(opt);
    });
    optionsContainer.appendChild(btn);
  });
  renderGameConfirmAction();
  updateGameConfirmAction();
}

function handleChoice(option) {
  const scenes = currentGame ? currentGame.scenes : [];
  const scene = scenes[currentSceneIndex];
  if (!scene) return;
  if (gameChoiceSubmitting) return;

  pendingGameChoice = {
    option: option,
    sceneIndex: currentSceneIndex
  };
  updateGameOptionSelection(option.option_label);
  updateGameConfirmAction();
}

async function confirmGameChoice() {
  if (!pendingGameChoice || gameChoiceSubmitting) return;
  const scenes = currentGame ? currentGame.scenes : [];
  const scene = scenes[pendingGameChoice.sceneIndex];
  const option = pendingGameChoice.option;
  if (!scene || pendingGameChoice.sceneIndex !== currentSceneIndex) return;

  const responseData = buildGameResponseData(scene, option);
  gameChoiceSubmitting = true;
  updateGameConfirmAction();

  try {
    await saveGameResponse(responseData);
  } catch (e) {
    gameChoiceSubmitting = false;
    updateGameConfirmAction();
    console.error('[game] 保存剧情作答失败:', e);
    alert('保存失败：' + e.message + '。请检查网络后重试。');
    return;
  }

  pendingGameChoice = null;
  gameChoiceSubmitting = false;
  renderScene(currentSceneIndex + 1);
}

function showGameComplete() {
  var gameCard = document.querySelector('.game-card');
  if (gameCard) gameCard.style.display = 'none';
  var completeArea = document.getElementById('gameCompleteArea');
  if (completeArea) {
    const order = normalizeGameOrder(_getItem(STORAGE_KEYS.GAME_ORDER));
    const completed = getCompletedGameKeys();
    const currentKey = currentGame ? normalizeGameKey(currentGame.key) : '';
    const hasNextExperience = order.some(function (key) {
      const normalized = normalizeGameKey(key);
      return normalized !== currentKey && completed.indexOf(normalized) === -1;
    });
    const h2 = completeArea.querySelector('h2');
    const p = completeArea.querySelector('p');
    const button = document.getElementById('finishGameBtn');
    if (hasNextExperience) {
      if (h2) h2.textContent = '第一个体验结束';
      if (p) p.textContent = '您已完成本次剧情体验，请点击下方按钮进行下一体验。';
      if (button) button.textContent = '进行下一体验';
    } else {
      const nextStep = nextFlowStepAfterCurrentGame();
      if (h2) h2.textContent = '全部剧情体验结束';
      if (nextStep && nextStep.type === 'questionnaire') {
        if (p) p.textContent = '您已完成全部剧情体验，请点击下方按钮继续完成后测问卷。';
        if (button) button.textContent = '继续后测问卷';
      } else {
        if (p) p.textContent = '您已完成全部剧情体验，请点击下方按钮继续。';
        if (button) button.textContent = '继续';
      }
    }
    completeArea.style.display = 'block';
    completeArea.style.animation = 'cardEntrance 0.5s ease-out';
  }
}

function nextFlowStepAfterCurrentGame() {
  const plan = _getItem(STORAGE_KEYS.FLOW_PLAN) || [];
  if (!Array.isArray(plan) || !plan.length || !currentGame) return null;

  const completed = _getItem(STORAGE_KEYS.FLOW_COMPLETED_STEP_IDS) || [];
  const currentStepId = currentFlowStep && currentFlowStep.step_id ? currentFlowStep.step_id : '';
  const currentKey = normalizeGameKey(currentGame.key);
  let currentIndex = -1;

  if (currentStepId) {
    currentIndex = plan.findIndex(function (step) {
      return step && step.step_id === currentStepId;
    });
  }
  if (currentIndex === -1) {
    currentIndex = plan.findIndex(function (step) {
      return step && step.type === 'game' &&
        normalizeGameKey(step.game_key) === currentKey &&
        completed.indexOf(step.step_id) === -1;
    });
  }
  if (currentIndex === -1) return null;

  for (let i = currentIndex + 1; i < plan.length; i++) {
    const step = plan[i];
    if (step && completed.indexOf(step.step_id) === -1) return step;
  }
  return null;
}

async function finishGame() {
  if (gameCompleted || !currentGame) return;
  gameCompleted = true;

  var finishBtn = document.getElementById('finishGameBtn');
  if (finishBtn) {
    finishBtn.disabled = true;
    finishBtn.textContent = '保存中...';
  }

  try {
    const result = await completeGame(currentGame.key, currentGame.title, {
      step_id: currentFlowStep && currentFlowStep.step_id ? currentFlowStep.step_id : ''
    });
    if (result && result.next_step) {
      navigateToFlowStep(result.next_step);
      return;
    }
    const order = normalizeGameOrder(await ensureGameOrder());
    const completed = getCompletedGameKeys();
    const nextIndex = order.findIndex(function (key) {
      return completed.indexOf(normalizeGameKey(key)) === -1;
    });
    if (nextIndex !== -1) {
      setCurrentGameIndex(nextIndex);
      navigateTo('game.html');
      return;
    }
    navigateTo('result.html?complete=1');
  } catch (e) {
    console.error('[game] 完成剧情失败:', e);
    alert('提交失败：' + e.message + '。请检查网络后重试。');
    gameCompleted = false;
    if (finishBtn) {
      finishBtn.disabled = false;
      showGameComplete();
    }
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  if (!localStorage.getItem('participant_id')) {
    await startParticipantSession();
  }
  await initGame();
});
