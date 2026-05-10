(function () {
  const STORAGE_KEY = 'dish-clicker-high';
  const COIN_SAVE_INTERVAL = 5000;

  const dish = document.getElementById('dish');
  const stage = document.getElementById('stage');
  const stainLayer = document.getElementById('stainLayer');
  const hpFill = document.getElementById('hpFill');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const cleanedEl = document.getElementById('cleaned');
  const comboEl = document.getElementById('combo');
  const coinCountEl = document.getElementById('coinCount');

  const urlParams = new URLSearchParams(window.location.search);
  const alpToken = urlParams.get('token');
  const platformApi = window.__ALP_PLATFORM_API__ || '';

  let score = 0;
  let cleanedCount = 0;
  let highScore = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  let maxHp = 8;
  let hp = maxHp;
  let combo = 0;
  let comboTimer = null;
  let washing = false;

  let totalCoins = 0;
  let pendingCoins = 0;
  let isLoggedIn = false;

  if (alpToken && platformApi) {
    fetch(`${platformApi}/api/auth/me`, {
      headers: { Authorization: `Bearer ${alpToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          isLoggedIn = true;
          totalCoins = data.user.coins ?? 0;
          updateCoinDisplay();
        }
      })
      .catch(() => {});
  }

  function updateCoinDisplay() {
    if (!coinCountEl) return;
    if (!isLoggedIn) {
      coinCountEl.textContent = '로그인 필요';
      return;
    }
    const display = totalCoins + pendingCoins;
    coinCountEl.textContent = display.toLocaleString();
  }

  setInterval(() => {
    if (!isLoggedIn || pendingCoins <= 0 || !alpToken || !platformApi) return;
    const amount = pendingCoins;
    pendingCoins = 0;
    fetch(`${platformApi}/api/coins/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alpToken}`,
      },
      body: JSON.stringify({ amount }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.coins !== undefined) {
          totalCoins = data.coins;
          updateCoinDisplay();
        }
      })
      .catch(() => {
        pendingCoins += amount;
      });
  }, COIN_SAVE_INTERVAL);

  highScoreEl.textContent = String(highScore);

  function persistHigh() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_KEY, String(highScore));
      highScoreEl.textContent = String(highScore);
    }
  }

  function updateHpBar() {
    const ratio = Math.max(0, hp / maxHp);
    hpFill.style.transform = `scaleX(${ratio})`;
  }

  /** 얼룩 강도 0~1 (많을수록 진함) */
  function setStainIntensity(intensity) {
    const t = Math.min(1, Math.max(0, intensity));
    stainLayer.innerHTML = '';
    if (t < 0.05) return;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const cx = 50;
    const cy = 48;
    const branches = Math.floor(2 + t * 5);
    for (let i = 0; i < branches; i += 1) {
      const angle = (i / branches) * Math.PI * 2 + t * 0.8;
      const len = 18 + t * 28 + Math.random() * 8;
      const x2 = cx + Math.cos(angle) * len * 0.35;
      const y2 = cy + Math.sin(angle) * len * 0.35;
      const x3 = cx + Math.cos(angle) * len;
      const y3 = cy + Math.sin(angle) * len;

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M ${cx} ${cy} L ${x2} ${y2} L ${x3} ${y3}`);
      path.setAttribute('fill', 'none');
      const alpha = 0.35 + t * 0.45;
      path.setAttribute('stroke', `rgba(120, 74, 38, ${alpha})`);
      path.setAttribute('stroke-width', (0.8 + t * 1.4).toFixed(2));
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    }
    stainLayer.appendChild(svg);
  }

  function bumpCombo() {
    combo += 1;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      combo = 0;
      comboEl.classList.add('hidden');
    }, 1200);
    comboEl.textContent = `콤보 ×${combo}`;
    comboEl.classList.remove('hidden');
  }

  function spawnFloatText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function spawnParticles(x, y, count) {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('div');
      p.className = 'particle';
      const dx = (Math.random() - 0.5) * 140;
      const dy = (Math.random() - 0.5) * 140 - 40;
      p.style.setProperty('--dx', `${dx}px`);
      p.style.setProperty('--dy', `${dy}px`);
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  }

  function nextDishDifficulty() {
    cleanedCount += 1;
    cleanedEl.textContent = String(cleanedCount);
    maxHp = Math.min(40, 8 + Math.floor(cleanedCount * 1.2));
    hp = maxHp;
    updateHpBar();
    setStainIntensity(1);
  }

  function finishClean(clientX, clientY) {
    washing = true;
    dish.disabled = true;
    dish.classList.add('sparkle');

    const bonus = 25 + maxHp * 2 + combo * 3;
    score += bonus;
    scoreEl.textContent = String(score);
    persistHigh();

    const coinsEarned = Math.max(5, Math.floor(bonus * 0.1));
    if (isLoggedIn) {
      pendingCoins += coinsEarned;
      updateCoinDisplay();
    }

    const x = clientX ?? stage.getBoundingClientRect().left + stage.offsetWidth / 2;
    const y = clientY ?? stage.getBoundingClientRect().top + stage.offsetHeight / 2;
    spawnFloatText(x, y, `+${bonus} 깨끗!`);
    spawnParticles(x, y, 14);

    setTimeout(() => {
      dish.classList.remove('sparkle');
      nextDishDifficulty();
      dish.disabled = false;
      washing = false;
    }, 480);
  }

  function clientPoint(ev) {
    if (ev.changedTouches && ev.changedTouches[0]) {
      const t = ev.changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: ev.clientX, y: ev.clientY };
  }

  let lastHitFromPointer = false;

  function scrubDish(ev) {
    if (washing) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    bumpCombo();
    const mult = 1 + Math.min(5, combo) * 0.08;
    const base = Math.max(1, Math.round(2 * mult));
    score += base;
    scoreEl.textContent = String(score);
    persistHigh();

    hp -= 1;
    updateHpBar();
    setStainIntensity(hp / maxHp);

    dish.style.transform = `translate(${(Math.random() - 0.5) * 6}px, ${(Math.random() - 0.5) * 4}px) scale(0.97)`;
    requestAnimationFrame(() => {
      dish.style.transform = '';
    });

    const { x, y } = clientPoint(ev);
    spawnFloatText(x, y, `+${base}`);

    if (hp <= 0) {
      finishClean(x, y);
    }
  }

  dish.addEventListener(
    'pointerdown',
    (ev) => {
      if (!ev.isPrimary) return;
      lastHitFromPointer = true;
      scrubDish(ev);
    },
    { passive: true }
  );

  dish.addEventListener('click', (ev) => {
    if (lastHitFromPointer) {
      lastHitFromPointer = false;
      return;
    }
    scrubDish(ev);
  });

  updateHpBar();
  setStainIntensity(1);
})();
