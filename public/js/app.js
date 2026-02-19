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
}

function selectBetType(el) {
  el.closest('.bet-type-btns').querySelectorAll('.bet-type').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedBetType = el.dataset.type;
}

function setAmount(n) { document.getElementById('baccaratAmount').value = n; }
function setSlotsAmount(n) { document.getElementById('slotsAmount').value = n; }
function setRouletteAmount(n) { document.getElementById('rouletteAmount').value = n; }

// ---- BACCARAT ----
async function playBaccarat() {
  if (!token) { openModal('loginModal'); return; }
  const amt = document.getElementById('baccaratAmount').value;
  if (!amt || amt < 1000) { showToast('배팅금액을 입력하세요.', 'error'); return; }

  // Reset cards
  document.getElementById('playerCards').innerHTML = '<div class="card-placeholder">?</div><div class="card-placeholder">?</div>';
  document.getElementById('bankerCards').innerHTML = '<div class="card-placeholder">?</div><div class="card-placeholder">?</div>';
  document.getElementById('playerTotal').textContent = '-';
  document.getElementById('bankerTotal').textContent = '-';
  document.getElementById('baccaratResult').className = 'result-box';
  document.getElementById('baccaratResult').textContent = '게임 진행중...';
  document.getElementById('baccarat-player-side').classList.remove('winner');
  document.getElementById('baccarat-banker-side').classList.remove('winner');

  try {
    await new Promise(r => setTimeout(r, 400));
    const res = await api('POST', '/api/casino/baccarat', { bet_type: selectedBetType, amount: amt });

    // Animate cards one by one
    renderBaccaratCards('playerCards', res.player.cards);
    await new Promise(r => setTimeout(r, 300));
    renderBaccaratCards('bankerCards', res.banker.cards);
    await new Promise(r => setTimeout(r, 300));

    document.getElementById('playerTotal').textContent = res.player.total;
    document.getElementById('bankerTotal').textContent = res.banker.total;

    // Highlight winner side
    if (res.winner === 'player') document.getElementById('baccarat-player-side').classList.add('winner');
    else if (res.winner === 'banker') document.getElementById('baccarat-banker-side').classList.add('winner');

    const rb = document.getElementById('baccaratResult');
    rb.className = 'result-box ' + (res.won ? 'won' : 'lost');
    const winnerName = res.winner === 'player' ? '플레이어' : res.winner === 'banker' ? '뱅커' : '타이';
    rb.textContent = res.won
      ? `🎉 당첨! ${winnerName} 승! +${res.win_amount.toLocaleString()}P`
      : `😢 낙첨 (${winnerName} 승)`;

    if (res.won) showWinEffect(res.win_amount);
    await refreshPoints();
  } catch (e) {
    document.getElementById('baccaratResult').className = 'result-box lost';
    document.getElementById('baccaratResult').textContent = e.message;
    showToast(e.message, 'error');
  }
}

function renderBaccaratCards(elId, cards) {
  const el = document.getElementById(elId);
  const RED_SUITS = ['♥', '♦'];
  el.innerHTML = cards.map(c => {
    const suit = c.card ? c.card[0] : '';
    const val = c.card ? c.card.slice(1) : c;
    const isRed = RED_SUITS.includes(suit);
    return `<div class="playing-card ${isRed ? 'red' : ''}">
      <div class="card-suit">${suit}</div>
      <div class="card-val">${val}</div>
    </div>`;
  }).join('');
}

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
    showMyTab('charge');
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
  document.querySelectorAll('.adtab').forEach((b, i) => {
    const tabs = ['users', 'matches', 'transactions', 'settings'];
    b.classList.toggle('active', tabs[i] === tab);
  });
  if (tab === 'users') adminLoadUsers();
  if (tab === 'matches') adminLoadMatches();
  if (tab === 'transactions') adminLoadTx();
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
  t.className = 'toast show' + (type === 'error' ? ' error-toast' : type === 'win' ? ' win-toast' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
