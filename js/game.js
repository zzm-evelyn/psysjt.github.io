/* ============================================================
   game.js — 剧情游戏页面逻辑（温暖主题）
   修改：最后一场景显示"体验结束"按钮，点击后保存数据并跳转
   ============================================================ */

let currentSceneIndex = 0;
let gameCompleted = false;

function initGame() {
  markGameStart();
  renderScene(0);
}

function renderScene(index) {
  const scenes = gameScenes;
  if (index < 0 || index >= scenes.length) {
    // 所有场景完成 → 显示"体验结束"界面
    showGameComplete();
    return;
  }

  currentSceneIndex = index;
  const scene = scenes[index];

  // 隐藏完成区域
  var completeArea = document.getElementById('gameCompleteArea');
  if (completeArea) completeArea.style.display = 'none';
  var gameCard = document.querySelector('.game-card');
  if (gameCard) gameCard.style.display = 'block';

  // 进度条
  const progressFill = document.getElementById('gameProgressFill');
  const progressText = document.getElementById('gameProgressText');
  if (progressFill) {
    progressFill.style.width = ((index / scenes.length) * 100) + '%';
  }
  if (progressText) {
    progressText.textContent = '场景 ' + (index + 1) + ' / ' + scenes.length;
  }

  // 背景图
  const gameContainer = document.getElementById('gameContainer');
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

  // 场景标题
  const titleEl = document.getElementById('sceneTitle');
  if (titleEl) titleEl.textContent = scene.scene_title;

  // 正文（带入场动画）
  const textEl = document.getElementById('sceneText');
  if (textEl) {
    textEl.style.animation = 'none';
    textEl.offsetHeight;
    textEl.textContent = scene.scene_text;
    textEl.style.animation = 'cardEntrance 0.5s ease-out';
  }

  // 问句
  const qEl = document.getElementById('gameQuestionText');
  if (qEl) {
    qEl.style.animation = 'none';
    qEl.offsetHeight;
    qEl.textContent = scene.question_text;
    qEl.style.animation = 'cardEntrance 0.4s ease-out 0.1s both';
  }

  // 选项
  const optionsContainer = document.getElementById('gameOptions');
  if (!optionsContainer) return;
  optionsContainer.innerHTML = '';

  scene.options.forEach((opt, i) => {
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
  const scenes = gameScenes;
  const scene = scenes[currentSceneIndex];

  const responseData = {
    participant_id: JSON.parse(localStorage.getItem('participant_id')),
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
  await saveGameResponse(responseData);

  // 点击反馈 - 快速缩放
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

/* ---- 显示游戏完成界面 ---- */
function showGameComplete() {
  var gameCard = document.querySelector('.game-card');
  if (gameCard) gameCard.style.display = 'none';
  var completeArea = document.getElementById('gameCompleteArea');
  if (completeArea) {
    completeArea.style.display = 'block';
    completeArea.style.animation = 'cardEntrance 0.5s ease-out';
  }
}

/* ---- 点击"体验结束" ---- */
async function finishGame() {
  if (gameCompleted) return;
  gameCompleted = true;

  var finishBtn = document.getElementById('finishGameBtn');
  if (finishBtn) {
    finishBtn.disabled = true;
    finishBtn.textContent = '处理中...';
  }

  await completeGame();
  navigateTo('result.html');
}

document.addEventListener('DOMContentLoaded', async function () {
  if (!localStorage.getItem('participant_id')) {
    await startParticipantSession();
  }
  initGame();
});
