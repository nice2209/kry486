/* ===================================================
   KRY486 – Frontend App v2.0 (Premium Quality)
   =================================================== */

// ===== STATE =====
let token = localStorage.getItem('kry486_token') || null;
let currentUser = null;
let currentSportFilter = 'all';
let selectedBetType = 'player';
let selectedRBet = 'red';
let miniTypes = { oddeven: 'odd', ladder: 'left', coin: 'heads', dice: 'high' };
let heroSlideIdx = 0;
let allMatches = [];
let particleSystem = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  initHeroSlider();
  animateStats();
  await loadMatchesHome();
  if (token) await checkAuth();
  setInterval(loadMatchesHome, 30000);
});

// ===========================
//  PARTICLE SYSTEM (Hero BG)
// ===========================
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = document.getElementById('heroSection');
  if (!hero) return;

  function resize() {
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  const COUNT = 70;

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.6 + 0.1,
      color: Math.random() > 0.7 ? '#f0c040' : Math.random() > 0.5 ? '#3b82f6' : '#a855f7'
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Connect nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(240,192,64,${(1 - dist / 100) * 0.1})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(')', `,${p.alpha})`).replace('rgb', 'rgba');
      // Simple hex color support
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });

    requestAnimationFrame(draw);
  }
  draw();
}

// ===========================
//  CONFETTI EFFECT
// ===========================
function launchConfetti(count = 60) {
  const colors = ['#f0c040', '#fde68a', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#f97316'];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left:${Math.random() * 100}vw;
        top:-10px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        width:${Math.random() * 8 + 6}px;
        height:${Math.random() * 8 + 6}px;
        border-radius:${Math.random() > 0.5 ? '50%' : '0'};
        animation-duration:${Math.random() * 2 + 2}s;
        animation-delay:${Math.random() * 0.5}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }, i * 20);
  }
}

// ===========================
//  WIN ANIMATION
// ===========================
function showWinEffect(amount) {
  launchConfetti();
  const overlay = document.createElement('div');
  overlay.className = 'win-overlay';
  overlay.innerHTML = `<div class="win-text">+${amount.toLocaleString()}P<br><span style="font-size:.4em;display:block;margin-top:8px">🎉 당첨!</span></div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .5s';
    setTimeout(() => overlay.remove(), 500);
  }, 1200);
}

// ===== AUTH CHECK =====
async function checkAuth() {
  try {
    const res = await api('GET', '/api/auth/me');
    if (res.id) {
      currentUser = res;
      setLoggedIn(res);
    }
  } catch { logout(); }
}

function setLoggedIn(user) {
  document.getElementById('headerRight').classList.add('hidden');
  document.getElementById('headerUser').classList.remove('hidden');
  document.getElementById('headerPoints').innerHTML = `<i class="fa fa-coins"></i> ${user.points.toLocaleString()}P`;
  document.getElementById('headerNick').textContent = user.nickname;
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('kry486_token');
  document.getElementById('headerRight').classList.remove('hidden');
  document.getElementById('headerUser').classList.add('hidden');
  showPage('home');
  showToast('로그아웃 되었습니다.');
}

async function refreshPoints() {
  if (!token) return;
  try {
    const res = await api('GET', '/api/points/balance');
    if (currentUser) currentUser.points = res.points;
    document.getElementById('headerPoints').innerHTML = `<i class="fa fa-coins"></i> ${res.points.toLocaleString()}P`;
    if (document.getElementById('mypgPoints')) {
      document.getElementById('mypgPoints').textContent = res.points.toLocaleString() + 'P';
    }
  } catch {}
}

// ===== API HELPER =====
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '오류가 발생했습니다.');
  return data;
}

// ===== NAVIGATION =====
function showPage(page, sub) {
  const authPages = ['mypage', 'admin'];
  if (authPages.includes(page) && !token) {
    showToast('로그인이 필요합니다.', 'error');
    openModal('loginModal'); return;
  }
  if (page === 'admin' && currentUser?.role !== 'admin') {
    showToast('관리자만 접근 가능합니다.', 'error'); return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'sports') { loadSportsPage(); loadMyBets(); }
  if (page === 'casino') { sub ? showCasino(sub) : showCasino('baccarat'); drawRoulette(); }
  if (page === 'minigame') { sub ? showMini(sub) : showMini('oddeven'); }
  if (page === 'mypage') loadMypage();
  if (page === 'admin') loadAdminPage();
  if (page === 'ranking') loadRanking('points');

  document.getElementById('nav').classList.remove('open');
}

function toggleNav() { document.getElementById('nav').classList.toggle('open'); }

// ===== HERO SLIDER =====
function initHeroSlider() {
  setInterval(() => goSlide(heroSlideIdx + 1), 5000);
}

function goSlide(n) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.dot');
  if (!slides.length) return;
  slides[heroSlideIdx].classList.remove('active');
  dots[heroSlideIdx].classList.remove('active');
  heroSlideIdx = (n + slides.length) % slides.length;
  slides[heroSlideIdx].classList.add('active');
  dots[heroSlideIdx].classList.add('active');
}

// ===== STATS COUNTER =====
function animateStats() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(el => {
      if (el.isIntersecting) {
        countUp(el.target);
        observer.unobserve(el.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.stat-num').forEach(el => observer.observe(el));
}

function countUp(el) {
  const target = parseInt(el.dataset.target);
  const duration = 1800;
  const start = performance.now();
  function update(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (p < 1) requestAnimationFrame(update);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(update);
}

// ===== LOAD MATCHES HOME =====
async function loadMatchesHome() {
  try {
    allMatches = await api('GET', '/api/sports/matches');
    const list = document.getElementById('homeMatchesList');
    if (!list) return;
    const featured = allMatches.filter(m => m.status === 'live' || m.status === 'scheduled').slice(0, 4);
    list.innerHTML = featured.length
      ? featured.map(m => renderMatchCard(m, false)).join('')
      : '<p style="color:var(--text-muted);padding:30px;text-align:center;grid-column:1/-1">진행중인 경기가 없습니다.</p>';
  } catch {}
}

function renderMatchCard(m, showBet = true) {
  const statusBadge = m.status === 'live'
    ? '<span class="badge-live">● LIVE</span>'
    : m.status === 'scheduled'
    ? '<span class="badge-soon">⏰ 예정</span>'
    : '<span class="badge-done">✔ 종료</span>';

  const score = m.status === 'scheduled'
    ? `<div class="score-box"><span class="vs-text">VS</span><span class="match-time">${formatTime(m.start_time)}</span></div>`
    : `<div class="score-box">
        <div class="score-row">
          <span class="score">${m.home_score}</span>
          <span class="vs-text" style="margin:0 6px">:</span>
          <span class="score">${m.away_score}</span>
        </div>
        <span class="match-time">${typeof m.minute === 'number' ? m.minute + "'" : (m.minute || '')}</span>
      </div>`;

  const odds = showBet && m.status !== 'finished' ? `
    <div class="odds-row" id="odds-${m.id}">
      <button class="odd-btn" onclick="selectOdd('${m.id}','home',${m.home_odds},this)">
        <span class="odd-name">${m.home}</span>
        <span class="odd-val">${m.home_odds}</span>
      </button>
      ${m.draw_odds ? `<button class="odd-btn" onclick="selectOdd('${m.id}','draw',${m.draw_odds},this)">
        <span class="odd-name">무</span>
        <span class="odd-val">${m.draw_odds}</span>
      </button>` : ''}
      <button class="odd-btn" onclick="selectOdd('${m.id}','away',${m.away_odds},this)">
        <span class="odd-name">${m.away}</span>
        <span class="odd-val">${m.away_odds}</span>
      </button>
    </div>
    <div class="bet-confirm" id="betConfirm-${m.id}">
      <input type="number" placeholder="배팅금액 (P)" id="betAmt-${m.id}" min="1000" step="1000"/>
      <button class="btn btn-gold btn-sm" onclick="submitBet('${m.id}')"><i class="fa fa-check"></i> 배팅</button>
      <button class="btn btn-outline btn-sm" onclick="cancelBet('${m.id}')">취소</button>
    </div>` : '';

  const winnerLabel = m.result
    ? `<div style="margin-top:8px;font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
        <i class="fa fa-flag" style="color:var(--green)"></i>
        결과: ${m.result === 'home' ? m.home : m.result === 'away' ? m.away : '무승부'} 승
      </div>` : '';

  return `<div class="match-card">
    <div class="match-league">${statusBadge} &nbsp;${m.league}</div>
    <div class="match-teams">
      <div class="team"><span>${m.home}</span></div>
      ${score}
      <div class="team right"><span>${m.away}</span></div>
    </div>
    ${odds}${winnerLabel}
  </div>`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ===== SPORTS PAGE =====
async function loadSportsPage() {
  try {
    allMatches = await api('GET', '/api/sports/matches');
    renderSportMatches();
  } catch {}
}

function renderSportMatches() {
  const list = document.getElementById('sportMatchesList');
  if (!list) return;
  let filtered = allMatches;
  if (currentSportFilter !== 'all') filtered = allMatches.filter(m => m.status === currentSportFilter);
  list.innerHTML = filtered.length
    ? filtered.map(m => renderMatchCard(m, true)).join('')
    : '<p style="color:var(--text-muted);padding:30px;text-align:center">해당 경기가 없습니다.</p>';
}

function filterSport(btn, status) {
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentSportFilter = status;
  renderSportMatches();
}

let selectedOdds = {};
function selectOdd(matchId, pick, odds, el) {
  if (!token) { openModal('loginModal'); return; }
  const row = document.getElementById(`odds-${matchId}`);
  row.querySelectorAll('.odd-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  selectedOdds[matchId] = { pick, odds };
  const conf = document.getElementById(`betConfirm-${matchId}`);
  conf.classList.add('show');
}

function cancelBet(matchId) {
  delete selectedOdds[matchId];
  const row = document.getElementById(`odds-${matchId}`);
  if (row) row.querySelectorAll('.odd-btn').forEach(b => b.classList.remove('selected'));
  const conf = document.getElementById(`betConfirm-${matchId}`);
  if (conf) conf.classList.remove('show');
}

async function submitBet(matchId) {
  const info = selectedOdds[matchId];
  const amt = parseInt(document.getElementById(`betAmt-${matchId}`).value);
  if (!info || !amt) { showToast('배팅 정보를 확인하세요.', 'error'); return; }
  try {
    const res = await api('POST', '/api/sports/bet', { match_id: matchId, pick: info.pick, amount: amt });
    showToast(`✅ 배팅 완료! 예상 당첨: ${res.bet.potential_win.toLocaleString()}P`);
    cancelBet(matchId);
    await refreshPoints();
    await loadSportsPage();
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadMyBets() {
  try {
    const bets = await api('GET', '/api/sports/my-bets');
    const el = document.getElementById('myBetsList');
    if (!el) return;
    el.innerHTML = bets.length
      ? bets.slice(0, 10).map(b => `
        <div class="tx-item">
          <span class="tx-type ${b.status === 'won' ? 'win' : b.status === 'lost' ? 'loss' : 'bet'}">${b.status === 'won' ? '당첨' : b.status === 'lost' ? '낙첨' : '대기'}</span>
          <span class="tx-desc">${b.match_name} – ${b.pick === 'home' ? '홈' : b.pick === 'away' ? '원정' : '무'} ×${b.odds}</span>
          <span class="tx-amount ${b.status === 'won' ? 'pos' : 'neg'}">${b.status === 'won' ? '+' + b.potential_win.toLocaleString() : '-' + b.amount.toLocaleString()}P</span>
        </div>`).join('')
      : '<p style="color:var(--text-muted);padding:20px;text-align:center">배팅 내역이 없습니다.</p>';
  } catch {}
}

// ===========================
//  CASINO
// ===========================
function showCasino(game) {
  document.querySelectorAll('.casino-game-area').forEach(g => g.classList.add('hidden'));
  document.getElementById('casino-' + game).classList.remove('hidden');
  document.querySelectorAll('.ctab').forEach((b, i) => {
    const games = ['baccarat', 'slots', 'roulette'];
    b.classList.toggle('active', games[i] === game);
  });
  if (game === 'roulette') drawRoulette();
  if (game === 'baccarat') initBaccaratLive();
}

function selectBetType(el) {
  el.closest('.bet-type-btns').querySelectorAll('.bet-type').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedBetType = el.dataset.type;
}

function setAmount(n) { document.getElementById('baccaratAmount').value = n; }
function setSlotsAmount(n) { document.getElementById('slotsAmount').value = n; }
function setRouletteAmount(n) { document.getElementById('rouletteAmount').value = n; }

// ================================================================
//  BACCARAT LIVE TABLE – Evolution Style
//  자동 라운드 루프:
//   [배팅 20초] → [딜링] → [결과 5초] → [다음 라운드]
// ================================================================

// ── 상태 ──────────────────────────────────────────────────────
const BAC_PHASES = { WAITING:'waiting', BETTING:'betting', DEALING:'dealing', RESULT:'result' };
let bacState = {
  phase: BAC_PHASES.WAITING,
  round: 0,
  timer: 0,
  timerInterval: null,
  bets: { player:0, banker:0, tie:0, playerPair:0, bankerPair:0 },
  selectedChip: 1000,
  history: [],
  running: false,
  dealingInProgress: false,
};

// ── 비드로드 ──────────────────────────────────────────────────
function updateBeadRoad() {
  const el = document.getElementById('beadRoad');
  if (!el) return;
  el.innerHTML = bacState.history.slice(-24).map(r => {
    const cls = r==='player'?'bead-p':r==='banker'?'bead-b':'bead-t';
    const lbl = r==='player'?'P':r==='banker'?'B':'T';
    return `<div class="bead ${cls}">${lbl}</div>`;
  }).join('');
}

// ================================================================
//  BACCARAT – Evolution Style Dealing System
// ================================================================

// ── 유틸 ──────────────────────────────────────────────────────
const BAC_RED = ['♥','♦'];

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function parseCard(c) {
  let suit = '', val = '';
  if (c && c.card) { suit = c.card[0]; val = c.card.slice(1); }
  const isRed = BAC_RED.includes(suit);
  return { suit, val, isRed };
}

function cardPoint(c) {
  const { val } = parseCard(c);
  if (['J','Q','K','10'].includes(val)) return 0;
  if (val === 'A') return 1;
  const n = parseInt(val);
  return isNaN(n) ? 0 : n;
}

// ── 앞면 HTML (실제 카드 모양) ────────────────────────────────
function buildCardFrontHTML(c) {
  const { suit, val, isRed } = parseCard(c);
  const colorClass = isRed ? 'red' : 'black';

  // 특수 카드 중앙 처리 (10,J,Q,K → 특수 표시)
  let centerHTML = '';
  if (['J','Q','K'].includes(val)) {
    // 인물 카드: 이니셜
    const faceMap = { J:'J', Q:'Q', K:'K' };
    centerHTML = `<div class="cf-face-big">${suit}<br>${faceMap[val]}</div>`;
  } else if (val === '10') {
    centerHTML = `<div class="cf-face-big">10<br>${suit}</div>`;
  } else if (val === 'A') {
    // 에이스: 큰 문양 하나
    centerHTML = `<div class="cf-center-suit">${suit}</div>`;
  } else {
    // 숫자 카드: 숫자에 따라 문양 배치
    const n = parseInt(val);
    const pips = Array(n).fill(suit).join(' ');
    centerHTML = `<div class="cf-center-suit" style="font-size:${n>=7?22:30}px;line-height:1.35">${pips}</div>`;
  }

  return `
    <div class="card-face card-front ${colorClass}">
      <div class="cf-corner-tl">
        <div class="cf-val">${val}</div>
        <div class="cf-suit-sm">${suit}</div>
      </div>
      ${centerHTML}
      <div class="cf-corner-br">
        <div class="cf-val">${val}</div>
        <div class="cf-suit-sm">${suit}</div>
      </div>
    </div>`;
}

// ── 뒷면 슬롯 생성 ────────────────────────────────────────────
function createCardSlot(id) {
  const slot = document.createElement('div');
  slot.className = 'card-slot';
  if (id) slot.id = id;
  slot.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back">
        <div class="card-back-logo">🃏</div>
      </div>
    </div>`;
  return slot;
}

// ── 카드 슬롯에 앞면 삽입 후 플립 ────────────────────────────
// Evolution 타이밍: 카드 등장 0.3초 후 천천히 뒤집힘 (0.9초)
function flipCard(slot, cardData) {
  return new Promise(resolve => {
    const inner = slot.querySelector('.card-inner');
    // 앞면 HTML을 뒤집힌 상태로 삽입 (transform:rotateY(180deg) in CSS)
    inner.insertAdjacentHTML('beforeend', buildCardFrontHTML(cardData));

    // 두 프레임 후 클래스 추가 → CSS transition 발동
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slot.classList.add('flipped');
      // 0.9s transition + 0.1s 여유 = 1000ms 후 resolve
      setTimeout(resolve, 1000);
    }));
  });
}

// ── 실시간 점수 업데이트 + 플래시 효과 ──────────────────────
function updateLiveScore(side, revealedCards) {
  const total = revealedCards.reduce((s, c) => s + cardPoint(c), 0) % 10;
  const elId = side === 'player' ? 'playerTotal' : 'bankerTotal';
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = total;
  el.classList.remove('flash');
  void el.offsetWidth; // reflow
  el.classList.add('flash');
}

// ── 페이즈 UI 업데이트 ────────────────────────────────────────
function setBacPhase(phase, label) {
  bacState.phase = phase;
  const badge = document.getElementById('bacPhaseBadge');
  if (badge) {
    badge.textContent = label;
    badge.className = 'bac-phase-badge ' + phase;
  }
}

// ── 타이머 시작 ───────────────────────────────────────────────
function startBacTimer(seconds, color) {
  const arc = document.getElementById('bacTimerArc');
  const num = document.getElementById('bacTimerNum');
  const total = 2 * Math.PI * 16; // r=16 circumference ≈ 100.5
  if (arc) arc.style.stroke = color || '#22c55e';

  bacState.timer = seconds;
  if (bacState.timerInterval) clearInterval(bacState.timerInterval);

  const update = () => {
    if (num) num.textContent = bacState.timer;
    const offset = total * (1 - bacState.timer / seconds);
    if (arc) arc.style.strokeDashoffset = offset;
  };
  update();

  bacState.timerInterval = setInterval(() => {
    bacState.timer--;
    update();
    if (bacState.timer <= 0) {
      clearInterval(bacState.timerInterval);
      bacState.timerInterval = null;
    }
  }, 1000);
}

function stopBacTimer() {
  if (bacState.timerInterval) clearInterval(bacState.timerInterval);
  bacState.timerInterval = null;
  const arc = document.getElementById('bacTimerArc');
  const num = document.getElementById('bacTimerNum');
  if (arc) arc.style.strokeDashoffset = 113;
  if (num) num.textContent = '–';
}

// ── 칩 선택 ───────────────────────────────────────────────────
function selectChip(val) {
  bacState.selectedChip = val;
  document.querySelectorAll('.ev-chip').forEach(c => {
    c.classList.toggle('active', Number(c.dataset.val) === val);
  });
}

// ── 배팅 추가 ─────────────────────────────────────────────────
function placeBet(type) {
  if (!token) { openModal('loginModal'); return; }
  if (bacState.phase !== BAC_PHASES.BETTING) {
    showToast('배팅 시간이 아닙니다.', 'error'); return;
  }
  bacState.bets[type] = (bacState.bets[type] || 0) + bacState.selectedChip;
  updateBetDisplay();

  // 칩 스택 시각화
  const chipStackMap = {
    player:'chipStackPlayer', banker:'chipStackBanker', tie:'chipStackTie',
    playerPair:'chipStackPlayerPair', bankerPair:'chipStackBankerPair'
  };
  const stackEl = document.getElementById(chipStackMap[type] || 'chipStackPlayer');
  if (stackEl && stackEl.children.length < 6) {
    const valIdx = [1000,5000,10000,50000,100000,500000].indexOf(bacState.selectedChip);
    const cls = ['c1k','c5k','c10k','c50k','c100k','c500k'][valIdx] || 'c1k';
    const labelMap = {1000:'1K',5000:'5K',10000:'1만',50000:'5만',100000:'10만',500000:'50만'};
    const chip = document.createElement('div');
    chip.className = `stacked-chip ${cls}`;
    chip.textContent = labelMap[bacState.selectedChip] || '?';
    stackEl.appendChild(chip);
  }
}

// ── 배팅 표시 업데이트 ────────────────────────────────────────
function updateBetDisplay() {
  const b = bacState.bets;
  const ids = {
    player:'dispPlayer', banker:'dispBanker', tie:'dispTie',
    playerPair:'dispPlayerPair', bankerPair:'dispBankerPair'
  };
  Object.keys(ids).forEach(k => {
    const el = document.getElementById(ids[k]);
    if (el) el.textContent = b[k] ? b[k].toLocaleString() + 'P' : '';
    // ev-bet-cell winner 클래스 (있을 때)
    const cellMap = {
      player:'btnBetPlayer', banker:'btnBetBanker', tie:'btnBetTie',
      playerPair:'btnBetPP', bankerPair:'btnBetBP'
    };
    const btn = document.getElementById(cellMap[k]);
    if (btn) btn.classList.toggle('has-bet', b[k] > 0);
  });
  const total = Object.values(b).reduce((s,v)=>s+v,0);
  const td = document.getElementById('bacTotalBetDisp');
  if (td) td.textContent = total.toLocaleString();
}

// ── 배팅 취소 ─────────────────────────────────────────────────
function clearBets() {
  if (bacState.phase !== BAC_PHASES.BETTING) return;
  bacState.bets = { player:0, banker:0, tie:0, playerPair:0, bankerPair:0 };
  ['chipStackPlayer','chipStackBanker','chipStackTie',
   'chipStackPlayerPair','chipStackBankerPair'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  updateBetDisplay();
}

// ── 재배팅 (이전 배팅 복원) ───────────────────────────────────
function reBet() {
  if (bacState.phase !== BAC_PHASES.BETTING) return;
  if (!bacState.lastBets) return;
  bacState.bets = { ...bacState.lastBets };
  updateBetDisplay();
  // 칩 스택 시각화
  Object.keys(bacState.bets).forEach(type => {
    if (!bacState.bets[type]) return;
    const stackMap = {
      player:'chipStackPlayer', banker:'chipStackBanker', tie:'chipStackTie',
      playerPair:'chipStackPlayerPair', bankerPair:'chipStackBankerPair'
    };
    const el = document.getElementById(stackMap[type]);
    if (el) {
      el.innerHTML = '';
      const chip = document.createElement('div');
      chip.className = 'stacked-chip c10k';
      chip.textContent = (bacState.bets[type]/1000)+'K';
      el.appendChild(chip);
    }
  });
}

// ── 더블 배팅 ─────────────────────────────────────────────────
function doubleBets() {
  if (bacState.phase !== BAC_PHASES.BETTING) return;
  Object.keys(bacState.bets).forEach(k => { bacState.bets[k] *= 2; });
  updateBetDisplay();
}

// ── 배팅 잠금/해제 ───────────────────────────────────────────
function lockBetPanel(msg) {
  const ov = document.getElementById('bacLockedOverlay');
  const msgEl = document.getElementById('bacLockedMsg');
  if (ov) ov.classList.remove('hidden');
  if (msgEl) msgEl.textContent = msg || '🃏 배팅 마감';
  document.querySelectorAll('.ev-bet-cell,.ev-wo-btn,.ev-chip,.ev-double-btn').forEach(el => {
    el.style.pointerEvents = 'none';
  });
}
function unlockBetPanel() {
  const ov = document.getElementById('bacLockedOverlay');
  if (ov) ov.classList.add('hidden');
  document.querySelectorAll('.ev-bet-cell,.ev-wo-btn,.ev-chip,.ev-double-btn').forEach(el => {
    el.style.pointerEvents = '';
  });
}

// ── 결과 오버레이 ─────────────────────────────────────────────
function showBacResult(res, earned) {
  const ov = document.getElementById('bacResultOverlay');
  const box = document.getElementById('bacResultBox');
  if (!ov || !box) return;
  const wname = res.winner === 'player' ? 'PLAYER WIN' : res.winner === 'banker' ? 'BANKER WIN' : 'TIE';
  const wcolor = res.winner === 'player' ? '#60a5fa' : res.winner === 'banker' ? '#f87171' : '#4ade80';
  let earnHTML = '';
  if (earned > 0) earnHTML = `<div class="ev-res-earn" style="color:#4ade80">+${earned.toLocaleString()}P 획득!</div>`;
  else if (earned < 0) earnHTML = `<div class="ev-res-earn" style="color:#f87171">${earned.toLocaleString()}P</div>`;
  else earnHTML = `<div class="ev-res-earn" style="color:rgba(255,255,255,.4)">배팅 없음</div>`;

  // 타이 push 설명
  let pushNote = '';
  if (res.push) pushNote = '<div style="font-size:11px;color:#4ade80;margin-top:4px">✓ 플레이어/뱅커 배팅 환불</div>';

  box.innerHTML = `
    <div class="ev-res-winner" style="color:${wcolor}">${wname}</div>
    <div class="ev-res-detail">P: ${res.player.total} &nbsp;|&nbsp; B: ${res.banker.total}
      ${res.natural ? '&nbsp;|&nbsp;<span style="color:#fbbf24">NATURAL</span>' : ''}</div>
    ${pushNote}
    ${earnHTML}
  `;
  ov.classList.remove('hidden');
}
function hideBacResult() {
  const ov = document.getElementById('bacResultOverlay');
  if (ov) ov.classList.add('hidden');
}

// ── 카드 초기화 ───────────────────────────────────────────────
function resetBacCards() {
  ['playerCards','bankerCards'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  const pt = document.getElementById('playerTotal');
  const bt = document.getElementById('bankerTotal');
  if (pt) { pt.textContent = '–'; pt.className = 'ev-score-num'; }
  if (bt) { bt.textContent = '–'; bt.className = 'ev-score-num'; }
  const nb = document.getElementById('naturalBadge');
  if (nb) nb.style.display = 'none';
  const ra = document.getElementById('bacResultAnnounce');
  if (ra) ra.textContent = '';
  // 승자 셀 클래스 제거
  document.querySelectorAll('.ev-bet-cell').forEach(z => z.classList.remove('winner-zone'));
  // 칩 스택 초기화
  ['chipStackPlayer','chipStackBanker','chipStackTie',
   'chipStackPlayerPair','chipStackBankerPair'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

// ── 점수 업데이트 ─────────────────────────────────────────────
function updateBacScore(side, cards) {
  const total = cards.reduce((s,c)=>s+cardPoint(c),0) % 10;
  const id = side === 'player' ? 'playerTotal' : 'bankerTotal';
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = total;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  if (total >= 8) el.style.color = '#fbbf24';
}

// ── 빅로드 업데이트 ───────────────────────────────────────────
function updateBigRoad() {
  const el = document.getElementById('evBigRoad');
  if (!el) return;
  el.innerHTML = bacState.history.slice(-36).map(r => {
    const cls = r==='player'?'ev-br-p':r==='banker'?'ev-br-b':'ev-br-t';
    const lbl = r==='player'?'P':r==='banker'?'B':'T';
    return `<div class="ev-br-cell ${cls}">${lbl}</div>`;
  }).join('');
}

// ── 실시간 배팅 채팅 (실제 DB 조회) ─────────────────────────
let chatInterval = null;
let lastChatCount = 0;

function addChatItem(nick, side, amt, isResult) {
  const list = document.getElementById('evChatList');
  if (!list) return;
  const sideMap = { player:'플레이어', banker:'뱅커', tie:'무승부', playerPair:'P보너스', bankerPair:'B보너스' };
  const classMap = { player:'ev-chat-side-p', banker:'ev-chat-side-b', tie:'ev-chat-side-t', playerPair:'ev-chat-side-p', bankerPair:'ev-chat-side-b' };
  const sides = Object.keys(amt).filter(k => amt[k] > 0);
  if (!sides.length) return;
  const mainSide = sides[0];
  const total = Object.values(amt).reduce((s,v)=>s+v,0);

  const div = document.createElement('div');
  div.className = 'ev-chat-item' + (isResult ? ' ev-chat-result' : '');
  div.innerHTML = `
    <span class="ev-chat-nick">${nick}</span>
    <span class="${classMap[mainSide]||'ev-chat-side-p'}">${sideMap[mainSide]||mainSide}</span>
    <span class="ev-chat-amt">${total>=1000?(total/1000).toFixed(0)+'K':total+'P'}</span>
  `;
  list.appendChild(div);
  while (list.children.length > 40) list.removeChild(list.firstChild);
  list.scrollTop = list.scrollHeight;
}

async function fetchLiveBets() {
  if (!token) return;
  try {
    const data = await api('GET', '/api/casino/baccarat/live-bets');
    if (!data.bets) return;
    // 새로운 항목만 추가
    const newItems = data.bets.slice(0, data.bets.length - lastChatCount);
    lastChatCount = data.bets.length;
    newItems.reverse().forEach(b => {
      addChatItem(maskNick(b.nickname), b.bets, b.bets);
    });
  } catch(e) {}
}

function maskNick(nick) {
  if (!nick) return 'user***';
  if (nick.length <= 3) return nick + '***';
  return nick.slice(0, 2) + '***' + nick.slice(-1);
}

function startFakeChat() {
  // 배팅 페이즈에 실제 DB 폴링 (3초마다)
  if (chatInterval) return;
  lastChatCount = 0;
  fetchLiveBets();
  chatInterval = setInterval(fetchLiveBets, 3000);
}
function stopFakeChat() {
  if (chatInterval) { clearInterval(chatInterval); chatInterval = null; }
}

// ================================================================
//  메인 딜링 함수 (API 호출 + 에볼루션 딜 시퀀스)
// ================================================================
async function runBaccaratDeal() {
  if (bacState.dealingInProgress) return;
  bacState.dealingInProgress = true;

  setBacPhase(BAC_PHASES.DEALING, '딜링중');
  lockBetPanel('🃏 딜링중...');
  resetBacCards();
  hideBacResult();

  // 총 배팅 계산
  const b = bacState.bets;
  const totalBet = Object.values(b).reduce((s,v)=>s+v,0);

  let res = null;
  try {
    if (totalBet > 0 && token) {
      // 배팅 타입 결정 (가장 큰 배팅 기준으로 주 배팅)
      const mainType = Object.keys(b).reduce((a,k) => b[k]>b[a]?k:a, 'player');
      const mainAmt = b[mainType];
      res = await api('POST', '/api/casino/baccarat', {
        bet_type: mainType, amount: mainAmt,
        extra_bets: b // 전체 배팅 정보
      });
    } else {
      // 배팅 없이도 게임은 계속 (데모 모드)
      res = await api('POST', '/api/casino/baccarat', { bet_type: 'player', amount: 0, demo: true });
    }
  } catch(e) {
    // 오류 시 랜덤 결과로 시각화만
    showToast(e.message || '오류 발생', 'error');
    bacState.dealingInProgress = false;
    return;
  }

  const pCards = res.player.cards;
  const bCards = res.banker.cards;
  const playerEl = document.getElementById('playerCards');
  const bankerEl = document.getElementById('bankerCards');

  // ── STEP 1: 뒷면 4장 배치 P1→B1→P2→B2 ─────────────────
  const slots = { player:[], banker:[] };
  await sleep(400);
  const ps0 = createCardSlot('ps-0'); playerEl.appendChild(ps0); slots.player.push(ps0);
  await sleep(280);
  const bs0 = createCardSlot('bs-0'); bankerEl.appendChild(bs0); slots.banker.push(bs0);
  await sleep(280);
  const ps1 = createCardSlot('ps-1'); playerEl.appendChild(ps1); slots.player.push(ps1);
  await sleep(280);
  const bs1 = createCardSlot('bs-1'); bankerEl.appendChild(bs1); slots.banker.push(bs1);
  await sleep(500);

  // ── STEP 2: 플립 P1→B1→P2→B2 ───────────────────────────
  await flipCard(ps0, pCards[0]); updateBacScore('player', pCards.slice(0,1)); await sleep(180);
  await flipCard(bs0, bCards[0]); updateBacScore('banker', bCards.slice(0,1)); await sleep(180);
  await flipCard(ps1, pCards[1]); updateBacScore('player', pCards.slice(0,2)); await sleep(180);
  await flipCard(bs1, bCards[1]); updateBacScore('banker', bCards.slice(0,2)); await sleep(400);

  // 내추럴 체크
  const pNow = pCards.slice(0,2).reduce((s,c)=>s+cardPoint(c),0) % 10;
  const bNow = bCards.slice(0,2).reduce((s,c)=>s+cardPoint(c),0) % 10;
  if (pNow >= 8 || bNow >= 8) {
    const nb = document.getElementById('naturalBadge');
    if (nb) nb.style.display = 'block';
    const ra = document.getElementById('bacResultAnnounce');
    if (ra) ra.textContent = 'NATURAL';
    await sleep(1000);
  }

  // ── STEP 3: 3번째 카드 ──────────────────────────────────
  if (pCards[2]) {
    await sleep(350);
    const ps2 = createCardSlot('ps-2'); playerEl.appendChild(ps2); slots.player.push(ps2);
    await sleep(350);
    await flipCard(ps2, pCards[2]); updateBacScore('player', pCards); await sleep(250);
  }
  if (bCards[2]) {
    await sleep(350);
    const bs2 = createCardSlot('bs-2'); bankerEl.appendChild(bs2); slots.banker.push(bs2);
    await sleep(350);
    await flipCard(bs2, bCards[2]); updateBacScore('banker', bCards); await sleep(250);
  }

  // ── STEP 4: 최종 점수 확정 ──────────────────────────────
  await sleep(400);
  const ptEl = document.getElementById('playerTotal');
  const btEl = document.getElementById('bankerTotal');
  if (ptEl) { ptEl.textContent = res.player.total; ptEl.classList.add('flash'); }
  if (btEl) { btEl.textContent = res.banker.total; btEl.classList.add('flash'); }

  // 승자 존 하이라이트 (새 ev-bet-cell 구조)
  const cellMap = { player:'btnBetPlayer', banker:'btnBetBanker', tie:'btnBetTie' };
  if (res.winner === 'tie') {
    ['btnBetPlayer','btnBetBanker','btnBetTie'].forEach(id => document.getElementById(id)?.classList.add('winner-zone'));
  } else {
    document.getElementById(cellMap[res.winner])?.classList.add('winner-zone');
  }
  // 페어 승리
  if (res.pair && res.pair.player) document.getElementById('btnBetPP')?.classList.add('winner-zone');
  if (res.pair && res.pair.banker) document.getElementById('btnBetBP')?.classList.add('winner-zone');

  // 이긴 카드 글로우
  const winSlots = res.winner === 'tie' ? [...slots.player,...slots.banker] : slots[res.winner] || [];
  winSlots.forEach(s => s.classList.add('win-glow'));

  // 비드로드 + 빅로드 업데이트
  bacState.history.push(res.winner);
  updateBeadRoad();
  updateBigRoad();

  // 포인트 업데이트 & 결과 계산
  await refreshPoints();
  let earned = 0;
  if (totalBet > 0) {
    if (res.push) {
      // 타이 push: 원금 환불, 손실 없음
      earned = 0;
      showToast('무승부! 배팅금 환불 ✓', 'info');
    } else if (res.won) {
      earned = res.net_change; // 순이익
      if (earned > 0) showWinEffect(earned);
    } else {
      earned = -totalBet;
    }
  }
  if (!res.push && !res.won && totalBet > 0) { /* 패배 */ }

  // 결과 오버레이 표시
  showBacResult(res, earned);
  setBacPhase(BAC_PHASES.RESULT, '결과');
  const ra = document.getElementById('bacResultAnnounce');
  const wname = res.winner === 'player' ? 'PLAYER' : res.winner === 'banker' ? 'BANKER' : 'TIE';
  if (ra) ra.textContent = wname;

  bacState.dealingInProgress = false;
}

// ================================================================
//  자동 라운드 루프
//  배팅(20초) → 딜링 → 결과(5초) → 반복
// ================================================================
const BAC_BET_TIME    = 20; // 배팅 시간 (초)
const BAC_RESULT_TIME = 5;  // 결과 표시 시간 (초)

async function baccaratLoop() {
  if (bacState.running) return;
  bacState.running = true;

  while (bacState.running) {
    bacState.round++;
    const roundEl = document.getElementById('bacRound');
    if (roundEl) roundEl.textContent = bacState.round;

    // ── 배팅 페이즈 ────────────────────────────────────────
    // 이전 배팅 저장 (재배팅용)
    const totalPrev = Object.values(bacState.bets).reduce((s,v)=>s+v,0);
    if (totalPrev > 0) bacState.lastBets = { ...bacState.bets };
    bacState.bets = { player:0, banker:0, tie:0, playerPair:0, bankerPair:0 };
    updateBetDisplay();
    hideBacResult();
    setBacPhase(BAC_PHASES.BETTING, '배팅중');
    unlockBetPanel();
    startBacTimer(BAC_BET_TIME, '#22c55e');
    startFakeChat();

    // BAC_BET_TIME초 대기
    await sleep(BAC_BET_TIME * 1000);

    // ── 배팅 마감 ───────────────────────────────────────────
    stopFakeChat();
    lockBetPanel('⏳ 배팅 마감');
    stopBacTimer();
    await sleep(800);

    // ── 딜링 페이즈 ─────────────────────────────────────────
    await runBaccaratDeal();

    // ── 결과 페이즈 ─────────────────────────────────────────
    setBacPhase(BAC_PHASES.RESULT, '결과');
    startBacTimer(BAC_RESULT_TIME, '#f59e0b');
    await sleep(BAC_RESULT_TIME * 1000);
    stopBacTimer();

    // 다음 라운드로
    await sleep(500);
  }
}

// 바카라 페이지 진입 시 자동 시작
function initBaccaratLive() {
  if (bacState.running) return;
  resetBacCards();
  updateBetDisplay();
  baccaratLoop();
}

// 레거시 호환 (기존 코드 참조 방지)
function playBaccarat() { /* 라이브 테이블 방식으로 대체됨 */ }
function selectBetType() {}
function makeCardHTML(c) { return ''; }
function renderBaccaratCards(elId, cards) {}
function toggleBacRule() {}

// ---- SLOTS ----
const SLOT_SYMBOLS = ['🍒', '🍊', '🍋', '🍇', '⭐', '🔔', '🃏', '7️⃣', '💎'];
let slotsSpinning = false;

async function playSlots() {
  if (!token) { openModal('loginModal'); return; }
  if (slotsSpinning) return;
  const amt = document.getElementById('slotsAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  slotsSpinning = true;
  document.getElementById('slotsResult').className = 'result-box';
  document.getElementById('slotsResult').textContent = '';

  // Visual spin - rapid random symbols
  const reels = ['reel1', 'reel2', 'reel3'];
  const intervals = reels.map((id, i) => {
    const el = document.getElementById(id);
    el.classList.add('spinning');
    return setInterval(() => {
      el.textContent = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    }, 80);
  });

  try {
    await new Promise(r => setTimeout(r, 300));
    const res = await api('POST', '/api/casino/slots', { amount: amt });
    await new Promise(r => setTimeout(r, 700));

    // Stop reels one by one
    for (let i = 0; i < reels.length; i++) {
      await new Promise(r => setTimeout(r, 200));
      clearInterval(intervals[i]);
      const el = document.getElementById(reels[i]);
      el.classList.remove('spinning');
      el.textContent = res.reels[i];

      if (res.won && res.reels[0] === res.reels[i]) {
        el.classList.add('winner-reel');
      } else {
        el.classList.remove('winner-reel');
      }
    }

    await new Promise(r => setTimeout(r, 100));

    const sr = document.getElementById('slotsResult');
    sr.className = 'result-box ' + (res.won ? 'won' : 'lost');
    sr.textContent = res.won
      ? `🎉 당첨! ×${res.multiplier} → +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) {
    intervals.forEach(clearInterval);
    reels.forEach(id => document.getElementById(id).classList.remove('spinning'));
    showToast(e.message, 'error');
  } finally {
    slotsSpinning = false;
  }
}

// ---- ROULETTE ----
let rouletteAngle = 0;
let rouletteSpinning = false;

function drawRoulette() {
  const canvas = document.getElementById('rouletteCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 6;
  const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const NUMS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const sliceAngle = (Math.PI * 2) / NUMS.length;

  // Outer ring
  ctx.clearRect(0, 0, W, H);

  // Outer border
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#c99a20';
  ctx.fill();

  NUMS.forEach((n, i) => {
    const start = i * sliceAngle + rouletteAngle - Math.PI / 2;
    const end = start + sliceAngle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.fillStyle = n === 0 ? '#16a34a' : RED.includes(n) ? '#dc2626' : '#1e293b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Number
    const mid = start + sliceAngle / 2;
    ctx.save();
    ctx.translate(cx + (r - 22) * Math.cos(mid), cy + (r - 22) * Math.sin(mid));
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r < 100 ? 8 : 10}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n, 0, 0);
    ctx.restore();
  });

  // Center circle
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
  grad.addColorStop(0, '#2a2a3e');
  grad.addColorStop(1, '#0f1520');
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pointer (top)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 2);
  ctx.lineTo(cx - 7, cy - r + 14);
  ctx.lineTo(cx + 7, cy - r + 14);
  ctx.closePath();
  ctx.fillStyle = '#f0c040';
  ctx.fill();
}

function selectRBet(el) {
  document.querySelectorAll('.rbet').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedRBet = el.dataset.type;
}

async function playRoulette() {
  if (!token) { openModal('loginModal'); return; }
  if (rouletteSpinning) return;
  const amt = document.getElementById('rouletteAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  rouletteSpinning = true;
  document.getElementById('rouletteResult').className = 'result-box';
  document.getElementById('rouletteResult').textContent = '';
  document.getElementById('rouletteNum').textContent = '?';
  document.getElementById('rouletteColorLabel').textContent = '–';
  document.getElementById('rouletteColorLabel').className = 'roulette-color-label';

  // Spin animation
  let speed = 0.25;
  let decel = false;
  const spinAnim = () => {
    rouletteAngle += speed;
    if (decel) speed = Math.max(speed - 0.002, 0);
    drawRoulette();
    if (speed > 0 || !decel) requestAnimationFrame(spinAnim);
  };
  requestAnimationFrame(spinAnim);

  try {
    await new Promise(r => setTimeout(r, 1000));
    const res = await api('POST', '/api/casino/roulette', { bet_type: selectedRBet, amount: amt });
    await new Promise(r => setTimeout(r, 600));
    decel = true;
    await new Promise(r => setTimeout(r, 800));

    const colorLabel = res.result === 0 ? '그린' : res.is_red ? '빨강' : '검정';
    const colorClass = res.result === 0 ? 'green' : res.is_red ? 'red' : 'black';
    document.getElementById('rouletteNum').textContent = res.result;
    document.getElementById('rouletteColorLabel').textContent = colorLabel;
    document.getElementById('rouletteColorLabel').className = `roulette-color-label ${colorClass}`;

    const rr = document.getElementById('rouletteResult');
    rr.className = 'result-box ' + (res.won ? 'won' : 'lost');
    rr.textContent = res.won
      ? `🎉 당첨! ${res.result}번 ${colorLabel} ×${res.multiplier} → +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨 (${res.result}번 ${colorLabel})`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) {
    decel = true;
    showToast(e.message, 'error');
  } finally {
    rouletteSpinning = false;
  }
}

// ===========================
//  MINI GAMES
// ===========================
function showMini(game) {
  document.querySelectorAll('.mini-game-area').forEach(g => g.classList.add('hidden'));
  document.getElementById('mini-' + game).classList.remove('hidden');
  document.querySelectorAll('.mtab').forEach((b, i) => {
    const games = ['oddeven', 'ladder', 'coin', 'dice'];
    b.classList.toggle('active', games[i] === game);
  });
  if (game === 'ladder') drawLadderIdle();
}

function selectMiniType(el, game) {
  el.closest('.bet-type-btns').querySelectorAll('.bet-type').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  miniTypes[game] = el.dataset.type;
}

function setMiniAmt(game, n) { document.getElementById(game + 'Amount').value = n; }

// Odd/Even
async function playOddEven() {
  if (!token) { openModal('loginModal'); return; }
  const amt = document.getElementById('oddevenAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  const ball = document.getElementById('oddevenBall');
  ball.textContent = '?';
  ball.className = 'number-ball';

  // Rolling animation
  let rolling = setInterval(() => {
    ball.textContent = Math.floor(Math.random() * 100) + 1;
  }, 80);

  try {
    await new Promise(r => setTimeout(r, 300));
    const res = await api('POST', '/api/minigame/oddeven', { pick: miniTypes.oddeven, amount: amt });
    await new Promise(r => setTimeout(r, 400));
    clearInterval(rolling);

    ball.textContent = res.number;
    ball.className = `number-ball ${res.result === 'odd' ? 'odd-color' : 'even-color'}`;
    document.getElementById('oddevenLabel').textContent = res.result === 'odd' ? '🔴 홀' : '🔵 짝';

    const r = document.getElementById('oddevenResult');
    r.className = 'result-box ' + (res.won ? 'won' : 'lost');
    r.textContent = res.won
      ? `🎉 당첨! +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨 (${res.result === 'odd' ? '홀' : '짝'})`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) {
    clearInterval(rolling);
    showToast(e.message, 'error');
  }
}

// Ladder
async function playLadder() {
  if (!token) { openModal('loginModal'); return; }
  const amt = document.getElementById('ladderAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  try {
    const res = await api('POST', '/api/minigame/ladder', { pick: miniTypes.ladder, amount: amt });
    await animateLadder(res.bridges, res.result);
    const r = document.getElementById('ladderResult');
    r.className = 'result-box ' + (res.won ? 'won' : 'lost');
    r.textContent = res.won
      ? `🎉 ${res.result === 'left' ? '왼쪽' : '오른쪽'} 도착! +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨 (${res.result === 'left' ? '왼쪽' : '오른쪽'} 도착)`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) { showToast(e.message, 'error'); }
}

function drawLadderIdle() {
  const canvas = document.getElementById('ladderCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const lx = W * 0.25, rx = W * 0.75;
  ctx.strokeStyle = '#1e2d45'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lx, 30); ctx.lineTo(lx, H - 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx, 30); ctx.lineTo(rx, H - 30); ctx.stroke();

  ctx.fillStyle = '#f0c040'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
  ctx.fillText('왼쪽', lx, 22);
  ctx.fillText('오른쪽', rx, 22);

  ctx.fillStyle = '#3d4f6e'; ctx.font = '13px Arial';
  ctx.fillText('게임 시작 버튼을 누르세요', W / 2, H / 2);
}

async function animateLadder(bridges, result) {
  const canvas = document.getElementById('ladderCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const lx = W * 0.25, rx = W * 0.75;
  const topY = 40, bottomY = H - 30;
  const stepH = (bottomY - topY) / (bridges.length + 1);

  ctx.clearRect(0, 0, W, H);

  // Draw verticals
  ctx.strokeStyle = '#2a3a55'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lx, topY); ctx.lineTo(lx, bottomY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx, topY); ctx.lineTo(rx, bottomY); ctx.stroke();

  // Draw bridges with animation
  for (let i = 0; i < bridges.length; i++) {
    if (bridges[i]) {
      const y = topY + (i + 1) * stepH;
      ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke();
    }
    await new Promise(r => setTimeout(r, 60));
  }

  // Labels
  ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
  ctx.fillStyle = '#f0c040';
  ctx.fillText('왼쪽', lx, topY - 10);
  ctx.fillText('오른쪽', rx, topY - 10);

  // Result arrow
  ctx.fillStyle = result === 'left' ? '#22c55e' : '#ef4444';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(result === 'left' ? '◀ 왼쪽' : '오른쪽 ▶', result === 'left' ? lx : rx, bottomY + 20);
}

// Coin
function coinClickFlip() { /* just decorative */ }

async function playCoin() {
  if (!token) { openModal('loginModal'); return; }
  const amt = document.getElementById('coinAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  const coin = document.getElementById('coinEl');
  coin.classList.add('flip');

  try {
    await new Promise(r => setTimeout(r, 500));
    const res = await api('POST', '/api/minigame/coin', { pick: miniTypes.coin, amount: amt });
    await new Promise(r => setTimeout(r, 400));
    coin.classList.remove('flip');

    const r = document.getElementById('coinResult');
    r.className = 'result-box ' + (res.won ? 'won' : 'lost');
    r.textContent = res.won
      ? `🎉 당첨! ${res.result === 'heads' ? '앞면' : '뒷면'}! +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨 (${res.result === 'heads' ? '앞면' : '뒷면'})`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) {
    coin.classList.remove('flip');
    showToast(e.message, 'error');
  }
}

// Dice
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

async function playDice() {
  if (!token) { openModal('loginModal'); return; }
  const amt = document.getElementById('diceAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  const dEl = document.getElementById('diceEl');
  dEl.classList.add('rolling');

  // Rapid random faces
  let rolling = setInterval(() => {
    dEl.textContent = DICE_FACES[Math.floor(Math.random() * 6) + 1];
  }, 80);

  try {
    await new Promise(r => setTimeout(r, 300));
    const res = await api('POST', '/api/minigame/dice', { pick: miniTypes.dice, amount: amt });
    await new Promise(r => setTimeout(r, 400));
    clearInterval(rolling);
    dEl.classList.remove('rolling');
    dEl.textContent = DICE_FACES[res.dice] || '🎲';
    document.getElementById('diceLabel').textContent = `${res.dice}점 (${res.result === 'high' ? '대' : '소'})`;

    const r = document.getElementById('diceResult');
    r.className = 'result-box ' + (res.won ? 'won' : 'lost');
    r.textContent = res.won
      ? `🎉 당첨! ${res.dice}점 ${res.result === 'high' ? '대' : '소'} +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨 (${res.dice}점 ${res.result === 'high' ? '대' : '소'})`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) {
    clearInterval(rolling);
    dEl.classList.remove('rolling');
    showToast(e.message, 'error');
  }
}

// ===========================
//  MYPAGE
// ===========================
async function loadMypage() {
  try {
    const user = await api('GET', '/api/auth/me');
    document.getElementById('mypgNick').textContent = user.nickname;
    document.getElementById('mypgId').textContent = '@' + user.username;
    document.getElementById('mypgPoints').textContent = user.points.toLocaleString() + 'P';
    document.getElementById('mypgBet').textContent = (user.total_bet || 0).toLocaleString() + 'P';
    document.getElementById('mypgWon').textContent = (user.total_won || 0).toLocaleString() + 'P';
    document.getElementById('mypgReferral').textContent = user.referral_code || '-';

    // 일반 유저는 충전/환전 탭 숨김
    const chargeTab = document.querySelector('.atab[onclick*="charge"]');
    const withdrawTab = document.querySelector('.atab[onclick*="withdraw"]');
    const chargeContent = document.getElementById('mytab-charge');
    const withdrawContent = document.getElementById('mytab-withdraw');

    if (user.role !== 'admin') {
      if (chargeTab) chargeTab.style.display = 'none';
      if (withdrawTab) withdrawTab.style.display = 'none';
      if (chargeContent) chargeContent.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:16px">🔒</div>
          <h3 style="color:#fff;margin-bottom:10px">포인트 충전</h3>
          <p style="color:var(--text-muted);font-size:14px;line-height:1.7">
            포인트 충전은 고객센터를 통해 진행됩니다.<br>
            아래 채팅 버튼을 눌러 문의해 주세요.
          </p>
          <button class="btn btn-gold" style="margin-top:20px" onclick="alert('고객센터에 문의해 주세요.')">
            <i class="fa fa-comment-dots"></i> 고객센터 문의
          </button>
        </div>`;
      if (withdrawContent) withdrawContent.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:16px">🔒</div>
          <h3 style="color:#fff;margin-bottom:10px">포인트 환전</h3>
          <p style="color:var(--text-muted);font-size:14px;line-height:1.7">
            포인트 환전은 고객센터를 통해 진행됩니다.<br>
            아래 채팅 버튼을 눌러 문의해 주세요.
          </p>
          <button class="btn btn-gold" style="margin-top:20px" onclick="alert('고객센터에 문의해 주세요.')">
            <i class="fa fa-comment-dots"></i> 고객센터 문의
          </button>
        </div>`;
      showMyTab('history');
    } else {
      if (chargeTab) chargeTab.style.display = '';
      if (withdrawTab) withdrawTab.style.display = '';
      showMyTab('charge');
    }
    // 신고 내역 로드
    loadMyReports();
  } catch {}
}

function showMyTab(tab) {
  document.querySelectorAll('.mytab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById('mytab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.atab').forEach((b, i) => {
    const tabs = ['charge', 'withdraw', 'history', 'mybets'];
    b.classList.toggle('active', tabs[i] === tab);
  });
  if (tab === 'history') loadTxHistory();
  if (tab === 'mybets') loadMyBetsDetail();
}

function setChargeAmt(n) { document.getElementById('chargeAmount').value = n; }
function setWithdrawAmt(n) { document.getElementById('withdrawAmount').value = n; }

async function doCharge() {
  const amt = document.getElementById('chargeAmount').value;
  const msgEl = document.getElementById('chargeMsg');
  msgEl.style.display = 'none';
  try {
    const res = await api('POST', '/api/points/charge', { amount: amt });
    msgEl.textContent = res.message;
    msgEl.className = 'msg-box success';
    msgEl.style.display = 'block';
    showToast(`💰 ${parseInt(amt).toLocaleString()}P 충전 완료!`);
    await refreshPoints();
    await loadMypage();
  } catch (e) {
    msgEl.textContent = e.message;
    msgEl.className = 'msg-box error';
    msgEl.style.display = 'block';
  }
}

async function doWithdraw() {
  const amt = document.getElementById('withdrawAmount').value;
  const msgEl = document.getElementById('withdrawMsg');
  msgEl.style.display = 'none';
  try {
    const res = await api('POST', '/api/points/withdraw', { amount: amt });
    msgEl.textContent = res.message;
    msgEl.className = 'msg-box success';
    msgEl.style.display = 'block';
    await refreshPoints();
    await loadMypage();
  } catch (e) {
    msgEl.textContent = e.message;
    msgEl.className = 'msg-box error';
    msgEl.style.display = 'block';
  }
}

async function loadTxHistory() {
  try {
    const res = await api('GET', '/api/points/history');
    const el = document.getElementById('txList');
    el.innerHTML = res.items.length
      ? res.items.map(t => `
        <div class="tx-item">
          <span class="tx-type ${t.type}">${txLabel(t.type)}</span>
          <span class="tx-desc">${t.desc}</span>
          <span class="tx-amount ${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount >= 0 ? '+' : ''}${t.amount.toLocaleString()}P</span>
          <span class="tx-date">${fmtDate(t.created_at)}</span>
        </div>`).join('')
      : '<p style="color:var(--text-muted);padding:20px;text-align:center">거래 내역이 없습니다.</p>';
  } catch {}
}

async function loadMyBetsDetail() {
  try {
    const bets = await api('GET', '/api/sports/my-bets');
    const el = document.getElementById('myBetsDetail');
    el.innerHTML = bets.length
      ? bets.map(b => `
        <div class="tx-item">
          <span class="tx-type ${b.status === 'won' ? 'win' : b.status === 'lost' ? 'loss' : 'bet'}">${b.status === 'won' ? '당첨' : b.status === 'lost' ? '낙첨' : '대기'}</span>
          <span class="tx-desc">${b.match_name} [${b.pick}] ×${b.odds}</span>
          <span class="tx-amount ${b.status === 'won' ? 'pos' : 'neg'}">${b.status === 'won' ? '+' + b.potential_win.toLocaleString() : '-' + b.amount.toLocaleString()}P</span>
          <span class="tx-date">${fmtDate(b.created_at)}</span>
        </div>`).join('')
      : '<p style="color:var(--text-muted);padding:20px;text-align:center">배팅 내역이 없습니다.</p>';
  } catch {}
}

function txLabel(type) {
  const map = { charge: '충전', withdraw: '환전', bet: '배팅', win: '당첨', loss: '낙첨', bonus: '보너스', admin_give: '지급', admin_take: '차감' };
  return map[type] || type;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ===========================
//  ADMIN
// ===========================
async function loadAdminPage() {
  try {
    const stats = await api('GET', '/api/admin/stats');
    document.getElementById('adminStats').innerHTML = [
      { label: '전체 회원', val: stats.total_users.toLocaleString(), icon: 'fa-users' },
      { label: '오늘 가입', val: stats.today_signups, icon: 'fa-user-plus' },
      { label: '총 배팅', val: stats.total_bet_amount.toLocaleString() + 'P', icon: 'fa-coins' },
      { label: '하우스 엣지', val: stats.house_edge, icon: 'fa-chart-line' },
    ].map(s => `<div class="astat-card">
      <span class="astat-val">${s.val}</span>
      <span class="astat-label"><i class="fa ${s.icon}" style="margin-right:4px;opacity:.6"></i>${s.label}</span>
    </div>`).join('');

    showAdTab('users');
    const settings = await api('GET', '/api/admin/settings');
    document.getElementById('cfgSignup').value = settings.signup_bonus;
    document.getElementById('cfgMinBet').value = settings.min_bet;
    document.getElementById('cfgMaxBet').value = settings.max_bet;
  } catch {}
}

function showAdTab(tab) {
  document.querySelectorAll('.adtab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById('adtab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.adtab').forEach(b => {
    const tabs = ['users', 'matches', 'transactions', 'reports', 'settings'];
    const btnTab = b.getAttribute('onclick')?.match(/showAdTab\('(\w+)'\)/)?.[1];
    b.classList.toggle('active', btnTab === tab);
  });
  if (tab === 'users') adminLoadUsers();
  if (tab === 'matches') adminLoadMatches();
  if (tab === 'transactions') adminLoadTx();
  if (tab === 'reports') loadAdminReports('all');
}

async function adminLoadUsers(search = '') {
  try {
    const url = search ? `/api/admin/users?search=${encodeURIComponent(search)}` : '/api/admin/users';
    const res = await api('GET', url);
    document.getElementById('adminUserList').innerHTML = res.items.map(u => `
      <div class="admin-user-row">
        <span class="uid">${u.username}</span>
        <span class="unick">${u.nickname}</span>
        <span class="upoints">${(u.points || 0).toLocaleString()}P</span>
        <span class="${u.status === 'banned' ? 'badge-banned' : 'badge-active'}">${u.status === 'banned' ? '정지' : '정상'}</span>
        <input type="number" placeholder="P 지급/차감" id="giveP-${u.id}" style="width:110px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px"/>
        <button class="btn btn-sm btn-green" onclick="adminGivePoints('${u.id}')"><i class="fa fa-plus"></i> 지급</button>
        <button class="btn btn-sm btn-danger" onclick="adminBanUser('${u.id}','${u.username}')">${u.status === 'banned' ? '해제' : '정지'}</button>
        <span style="font-size:11px;color:var(--text-dim);margin-left:auto">${fmtDate(u.created_at)}</span>
      </div>`).join('') || '<p style="color:var(--text-muted);padding:20px;text-align:center">회원 없음</p>';
  } catch {}
}

function adminSearchUsers() { adminLoadUsers(document.getElementById('userSearch').value); }

async function adminGivePoints(uid) {
  const amt = document.getElementById('giveP-' + uid).value;
  if (!amt) return;
  try {
    await api('POST', `/api/admin/users/${uid}/points`, { amount: amt, reason: '관리자 지급' });
    showToast('포인트 처리 완료');
    adminLoadUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminBanUser(uid, username) {
  if (!confirm(`${username} 계정을 정지/해제 하시겠습니까?`)) return;
  try {
    const res = await api('POST', `/api/admin/users/${uid}/ban`);
    showToast(`계정 ${res.status === 'banned' ? '정지' : '해제'} 완료`);
    adminLoadUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminLoadMatches() {
  try {
    const matches = await api('GET', '/api/sports/matches');
    document.getElementById('adminMatchList').innerHTML = matches.map(m => `
      <div class="match-admin-row">
        <span class="${m.status === 'live' ? 'badge-live' : m.status === 'finished' ? 'badge-done' : 'badge-soon'}">${m.status}</span>
        <span style="flex:1">${m.league}: ${m.home} vs ${m.away}</span>
        <span style="color:var(--gold)">${m.home_score}:${m.away_score}</span>
        ${m.status !== 'finished' ? `
          <button class="settle-btn settle-home" onclick="adminSettle('${m.id}','home')">홈승</button>
          ${m.draw_odds ? `<button class="settle-btn settle-draw" onclick="adminSettle('${m.id}','draw')">무</button>` : ''}
          <button class="settle-btn settle-away" onclick="adminSettle('${m.id}','away')">원정승</button>
        ` : `<span style="color:var(--green);font-size:12px;font-weight:700">✔ 정산완료</span>`}
      </div>`).join('');
  } catch {}
}

async function adminSettle(matchId, result) {
  try {
    const res = await api('POST', `/api/admin/settle/${matchId}`, { result });
    showToast(`✅ 정산 완료: ${res.settled}건`);
    adminLoadMatches();
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminAddMatch() {
  const league = document.getElementById('mLeague').value;
  const home = document.getElementById('mHome').value;
  const away = document.getElementById('mAway').value;
  const home_odds = document.getElementById('mHomeOdds').value;
  const draw_odds = document.getElementById('mDrawOdds').value || null;
  const away_odds = document.getElementById('mAwayOdds').value;
  const start_time = document.getElementById('mStartTime').value;
  try {
    await api('POST', '/api/admin/matches', { league, home, away, home_odds, draw_odds, away_odds, start_time });
    showToast('경기가 추가되었습니다.');
    adminLoadMatches();
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminLoadTx() {
  try {
    const res = await api('GET', '/api/admin/transactions');
    document.getElementById('adminTxList').innerHTML = res.items.map(t => `
      <div class="tx-item">
        <span class="tx-type ${t.type}">${txLabel(t.type)}</span>
        <span class="tx-desc" style="font-size:11px;color:var(--text-dim)">${(t.user_id || '').slice(0, 8)}…</span>
        <span class="tx-desc">${t.desc}</span>
        <span class="tx-amount ${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount >= 0 ? '+' : ''}${t.amount.toLocaleString()}P</span>
        <span class="tx-date">${fmtDate(t.created_at)}</span>
      </div>`).join('');
  } catch {}
}

async function saveSettings() {
  try {
    await api('PUT', '/api/admin/settings', {
      signup_bonus: document.getElementById('cfgSignup').value,
      min_bet: document.getElementById('cfgMinBet').value,
      max_bet: document.getElementById('cfgMaxBet').value
    });
    showToast('✅ 설정이 저장되었습니다.');
  } catch (e) { showToast(e.message, 'error'); }
}

// ===========================
//  AUTH
// ===========================
async function doLogin() {
  const username = document.getElementById('loginId').value.trim();
  const password = document.getElementById('loginPw').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!username || !password) {
    errEl.textContent = '아이디와 비밀번호를 입력하세요.';
    errEl.classList.remove('hidden'); return;
  }
  try {
    const res = await api('POST', '/api/auth/login', { username, password });
    token = res.token;
    localStorage.setItem('kry486_token', token);
    currentUser = res.user;
    setLoggedIn(res.user);
    closeModal('loginModal');
    showToast(`🎉 환영합니다, ${res.user.nickname}님!`);
    if (res.user.role === 'admin') {
      const nav = document.querySelector('.nav');
      if (!document.getElementById('nav-admin')) {
        nav.insertAdjacentHTML('beforeend', `<a href="#" id="nav-admin" onclick="showPage('admin')"><i class="fa fa-gear"></i> 관리자</a>`);
      }
    }
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

async function doRegister() {
  const username = document.getElementById('regId').value.trim();
  const password = document.getElementById('regPw').value;
  const pw2 = document.getElementById('regPw2').value;
  const nickname = document.getElementById('regNick').value.trim();
  const referral_code = document.getElementById('regRef').value.trim();
  const errEl = document.getElementById('regError');
  errEl.classList.add('hidden');

  if (!username || !password || !nickname) {
    errEl.textContent = '모든 필수 항목을 입력하세요.';
    errEl.classList.remove('hidden'); return;
  }
  if (password !== pw2) {
    errEl.textContent = '비밀번호가 일치하지 않습니다.';
    errEl.classList.remove('hidden'); return;
  }

  try {
    const res = await api('POST', '/api/auth/register', { username, password, nickname, referral_code });
    token = res.token;
    localStorage.setItem('kry486_token', token);
    currentUser = res.user;
    setLoggedIn(res.user);
    closeModal('registerModal');
    showToast('🎉 가입 완료! 10,000P가 지급되었습니다!');
    launchConfetti(80);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

// ===========================
//  MODAL HELPERS
// ===========================
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
function closeModalOut(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 220);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ===========================
//  TOAST
// ===========================
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error-toast' : type === 'win' ? ' win-toast' : type === 'info' ? ' info-toast' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ===========================
//  RANKING
// ===========================
let currentRankTab = 'points';

async function loadRanking(type = 'points') {
  currentRankTab = type;

  // 탭 active
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.rtab[onclick*="${type}"]`);
  if (activeTab) activeTab.classList.add('active');

  const podiumEl = document.getElementById('rankingPodium');
  const listEl = document.getElementById('rankingList');
  if (!podiumEl || !listEl) return;

  podiumEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fa fa-spinner fa-spin"></i> 불러오는 중...</div>';
  listEl.innerHTML = '';

  try {
    const data = await api('GET', `/api/ranking?type=${type}&limit=20`);
    const ranking = data.ranking;
    if (!ranking.length) {
      podiumEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">랭킹 데이터가 없습니다.</div>';
      return;
    }

    const typeLabel = type === 'points' ? '보유 포인트' : type === 'won' ? '총 당첨금' : '총 배팅금';
    const getValue = u => type === 'points' ? u.points : type === 'won' ? u.total_won : u.total_bet;

    // 포디움 (1~3위)
    const top3 = ranking.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); // 2위-1위-3위 순
    const podiumHeight = ['140px', '180px', '110px'];
    const podiumPos = [1, 0, 2]; // index in original top3

    podiumEl.innerHTML = `
      <div class="podium-wrap">
        ${podiumOrder.map((u, i) => {
          const rank = podiumPos[i] + 1;
          const medals = ['🥇','🥈','🥉'];
          const h = podiumHeight[i];
          return `<div class="podium-item rank-${rank}">
            <div class="podium-avatar">${medals[rank-1]}</div>
            <div class="podium-nick">${u.nickname}</div>
            <div class="podium-val">${getValue(u).toLocaleString()}P</div>
            <div class="podium-bar" style="height:${h}">
              <span class="podium-rank">${rank}위</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    // 4위 이하 리스트
    const rest = ranking.slice(3);
    if (!rest.length) { listEl.innerHTML = ''; return; }

    listEl.innerHTML = `
      <div class="rank-list-header">
        <span>순위</span><span>닉네임</span><span>${typeLabel}</span>
      </div>
      ${rest.map(u => `
        <div class="rank-list-row">
          <span class="rank-num">${u.rank}위</span>
          <span class="rank-nick">${u.nickname}</span>
          <span class="rank-val">${getValue(u).toLocaleString()}P</span>
        </div>`).join('')}`;
  } catch (e) {
    podiumEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)">${e.message}</div>`;
  }
}

function showRankTab(type) {
  loadRanking(type);
}

// ===========================
//  REPORT (신고)
// ===========================
async function submitReport() {
  if (!token) { openModal('loginModal'); return; }
  const type = document.getElementById('reportType').value;
  const title = document.getElementById('reportTitle').value.trim();
  const content = document.getElementById('reportContent').value.trim();
  const msgEl = document.getElementById('reportMsg');

  if (!title || !content) {
    msgEl.style.display = 'block';
    msgEl.className = 'msg-box error';
    msgEl.textContent = '제목과 내용을 모두 입력하세요.';
    return;
  }

  try {
    const res = await api('POST', '/api/report', { type, title, content });
    msgEl.style.display = 'block';
    msgEl.className = 'msg-box success';
    msgEl.textContent = '✅ ' + res.message;
    document.getElementById('reportTitle').value = '';
    document.getElementById('reportContent').value = '';
    loadMyReports();
  } catch (e) {
    msgEl.style.display = 'block';
    msgEl.className = 'msg-box error';
    msgEl.textContent = e.message;
  }
}

async function loadMyReports() {
  const el = document.getElementById('myReportList');
  if (!el) return;
  try {
    const data = await api('GET', '/api/report/my');
    const typeNames = { game_error:'🎮 게임 오류', cheating:'🚫 부정행위', point_error:'💰 포인트 오류', other:'📝 기타' };
    if (!data.reports.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">신고 내역이 없습니다.</div>';
      return;
    }
    el.innerHTML = data.reports.map(r => `
      <div class="tx-item" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span style="font-weight:700;color:#fff">${typeNames[r.type]||r.type} – ${r.title}</span>
          <span class="tx-badge ${r.status === 'resolved' ? 'win' : 'pending'}">${r.status === 'resolved' ? '✅ 처리완료' : '⏳ 검토중'}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">${r.content.slice(0,80)}${r.content.length>80?'…':''}</div>
        ${r.admin_reply ? `<div style="font-size:12px;padding:6px 10px;background:var(--bg3);border-radius:6px;color:var(--gold)">💬 관리자 답변: ${r.admin_reply}</div>` : ''}
        <div style="font-size:11px;color:var(--text-dim)">${new Date(r.created_at).toLocaleString('ko-KR')}</div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
  }
}

// ===========================
//  ADMIN - 신고 관리
// ===========================
async function loadAdminReports(status = 'all') {
  const el = document.getElementById('adminReportList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fa fa-spinner fa-spin"></i></div>';
  try {
    const data = await api('GET', `/api/report/admin/list?status=${status}`);
    const typeNames = { game_error:'🎮 게임 오류', cheating:'🚫 부정행위', point_error:'💰 포인트 오류', other:'📝 기타' };
    if (!data.reports.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">신고 내역이 없습니다.</div>';
      return;
    }
    el.innerHTML = data.reports.map(r => `
      <div class="admin-user-card" style="flex-direction:column;align-items:flex-start;gap:8px" id="report-${r.id}">
        <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:6px">
          <div>
            <span style="font-weight:800;color:#fff">${typeNames[r.type]||r.type}</span>
            <span style="margin-left:8px;color:var(--text-muted);font-size:13px">by ${r.nickname} (${r.username})</span>
          </div>
          <span class="tx-badge ${r.status === 'resolved' ? 'win' : 'pending'}">${r.status === 'resolved' ? '✅ 처리완료' : '⏳ 미처리'}</span>
        </div>
        <div style="font-weight:700;color:var(--gold)">${r.title}</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5">${r.content}</div>
        ${r.admin_reply ? `<div style="font-size:12px;padding:6px 10px;background:var(--bg3);border-radius:6px;color:var(--gold)">💬 답변: ${r.admin_reply}</div>` : ''}
        <div style="font-size:11px;color:var(--text-dim)">${new Date(r.created_at).toLocaleString('ko-KR')}</div>
        ${r.status !== 'resolved' ? `
          <div style="display:flex;gap:8px;width:100%;flex-wrap:wrap">
            <input type="text" id="reply-${r.id}" placeholder="답변 입력 (선택)" style="flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:#fff;font-size:13px"/>
            <button class="btn btn-sm btn-gold" onclick="resolveReport('${r.id}')">✅ 처리완료</button>
            <button class="btn btn-sm btn-danger" onclick="deleteReport('${r.id}')">🗑 삭제</button>
          </div>` : `<button class="btn btn-sm btn-danger" onclick="deleteReport('${r.id}')">🗑 삭제</button>`}
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
  }
}

async function resolveReport(id) {
  const reply = document.getElementById(`reply-${id}`)?.value || '';
  try {
    await api('POST', `/api/report/admin/${id}/resolve`, { admin_reply: reply });
    showToast('✅ 신고 처리 완료');
    loadAdminReports();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteReport(id) {
  if (!confirm('이 신고를 삭제하시겠습니까?')) return;
  try {
    await api('DELETE', `/api/report/admin/${id}`);
    showToast('🗑 신고 삭제 완료');
    loadAdminReports();
  } catch (e) { showToast(e.message, 'error'); }
}
