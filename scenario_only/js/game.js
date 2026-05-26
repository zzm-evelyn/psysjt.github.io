/* ============================================================
   scenario_only/game.js — 单独情景测验页面逻辑
   默认只运行 game_a，可通过 game.html?game=game_b 切换。
   ============================================================ */

const SCENARIO_ONLY_DEFAULT_GAME_KEY = 'game_a';

let currentSceneIndex = 0;
let currentGame = null;
let gameCompleted = false;

function getScenarioOnlyGameKey() {
  const stored = localStorage.getItem('scenario_only_game_key');
  let storedKey = '';
  try {
    storedKey = stored ? JSON.parse(stored) : '';
  } catch (e) {
    storedKey = '';
  }
  return normalizeGameKey(getQueryParam('game') || storedKey || SCENARIO_ONLY_DEFAULT_GAME_KEY);
}

function prepareScenarioScenes(rawScenes) {
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
      gameScenes = prepareScenarioScenes(remoteScenes);
      console.log('[scenario_only] 已从后端加载剧情情景:', gameScenes.length);
      return;
    }
  } catch (e) {
    console.warn('[scenario_only] 后端剧情加载失败，使用本地备用数据:', e.message);
  }
  gameScenes = prepareScenarioScenes(gameScenes);
}

function buildScenarioGroup() {
  const targetKey = getScenarioOnlyGameKey();
  let scenes = (gameScenes || []).filter(function (scene) {
    return normalizeGameKey(scene.game_key) === targetKey;
  });

  if (scenes.length === 0) {
    scenes = (gameScenes || []).slice(0, 1);
  }

  scenes.sort(function (a, b) {
    return (a.display_order || a.scene_order || 0) - (b.display_order || b.scene_order || 0);
  });

  const first = scenes[0] || {};
  return {
    key: targetKey,
    title: first.game_title || defaultGameTitle(targetKey),
    scenes: scenes
  };
}

function showGameLoadError(message) {
  var gameCard = document.querySelector('.game-card');
  if (gameCard) {
    gameCard.innerHTML = '<div class="error-message" style="display:block;">' + message + '</div>';
  }
}

async function initGame() {
  markGameStart();
  await loadGameScenesFromApi();
  if (!gameScenes || gameScenes.length === 0) {
    showGameLoadError('暂时没有可体验的剧情情景，请联系研究者检查后台配置。');
    return;
  }

  currentGame = buildScenarioGroup();
  localStorage.setItem('scenario_only_game_key', JSON.stringify(currentGame.key));
  if (!currentGame.scenes.length) {
    showGameLoadError('当前情景测验没有可用题目，请联系研究者检查后台分组。');
    return;
  }

  renderScene(0);
}

function renderScene(index) {
  const scenes = currentGame ? currentGame.scenes : [];
  if (index < 0 || index >= scenes.length) {
    showGameComplete();
    return;
  }

  currentSceneIndex = index;
  const scene = scenes[index];

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
}

async function handleChoice(option) {
  const scenes = currentGame ? currentGame.scenes : [];
  const scene = scenes[currentSceneIndex];
  if (!scene) return;

  const responseData = {
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

  try {
    await saveGameResponse(responseData);
  } catch (e) {
    console.error('[scenario_only] 保存剧情作答失败:', e);
    alert('保存失败：' + e.message + '。请检查网络后重试。');
    return;
  }

  const btn = document.querySelector('.game-option-btn:hover') ||
    document.querySelectorAll('.game-option-btn')[scene.options.indexOf(option)];
  if (btn) {
    btn.style.transform = 'scale(0.97)';
    setTimeout(function () {
      renderScene(currentSceneIndex + 1);
    }, 150);
  } else {
    renderScene(currentSceneIndex + 1);
  }
}

function showGameComplete() {
  var gameCard = document.querySelector('.game-card');
  if (gameCard) gameCard.style.display = 'none';
  var completeArea = document.getElementById('gameCompleteArea');
  if (completeArea) {
    const h2 = completeArea.querySelector('h2');
    const p = completeArea.querySelector('p');
    if (h2) h2.textContent = '情景体验完成';
    if (p) p.textContent = '系统将根据本次情景体验的选择生成报告。';
    completeArea.style.display = 'block';
    completeArea.style.animation = 'cardEntrance 0.5s ease-out';
  }
}

async function finishGame() {
  if (gameCompleted || !currentGame) return;
  gameCompleted = true;

  var finishBtn = document.getElementById('finishGameBtn');
  if (finishBtn) {
    finishBtn.disabled = true;
    finishBtn.textContent = '生成报告中...';
  }

  try {
    await completeGame(currentGame.key, currentGame.title);
    navigateTo('result.html?game=' + encodeURIComponent(currentGame.key));
  } catch (e) {
    console.error('[scenario_only] 完成情景体验失败:', e);
    alert('提交失败：' + e.message + '。请检查网络后重试。');
    gameCompleted = false;
    if (finishBtn) {
      finishBtn.disabled = false;
      finishBtn.textContent = '查看报告';
    }
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  if (!localStorage.getItem('participant_id')) {
    await startParticipantSession();
  }
  await initGame();
});
