const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authMiddleware } = require('./auth');

// ===== 경기 목록 =====
router.get('/matches', (req, res) => {
  const matches = db.get('games.sports').value();
  res.json(matches);
});

// ===== 단일 경기 =====
router.get('/matches/:id', (req, res) => {
  const match = db.get('games.sports').find({ id: req.params.id }).value();
  if (!match) return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
  res.json(match);
});

// ===== 배팅하기 =====
router.post('/bet', authMiddleware, (req, res) => {
  const { match_id, pick, amount } = req.body; // pick: 'home' | 'draw' | 'away'
  const amt = parseInt(amount);

  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅금액은 ${settings.min_bet.toLocaleString()}P 입니다.` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅금액은 ${settings.max_bet.toLocaleString()}P 입니다.` });

  const match = db.get('games.sports').find({ id: match_id }).value();
  if (!match) return res.status(404).json({ error: '존재하지 않는 경기입니다.' });
  if (match.status === 'finished') return res.status(400).json({ error: '이미 종료된 경기입니다.' });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트가 부족합니다.' });

  // 이미 배팅했는지 확인
  const alreadyBet = db.get('bets').find({ user_id: user.id, match_id, status: 'pending' }).value();
  if (alreadyBet) return res.status(400).json({ error: '이미 이 경기에 배팅하셨습니다.' });

  // 배당률 선택
  let odds;
  if (pick === 'home') odds = match.home_odds;
  else if (pick === 'draw') odds = match.draw_odds;
  else if (pick === 'away') odds = match.away_odds;
  else return res.status(400).json({ error: '잘못된 배팅 선택입니다.' });
  if (!odds) return res.status(400).json({ error: '해당 배팅 옵션이 없습니다.' });

  const potential_win = Math.floor(amt * odds);
  const newPoints = user.points - amt;

  // 포인트 차감
  db.get('users').find({ id: user.id }).assign({
    points: newPoints,
    total_bet: user.total_bet + amt
  }).write();

  // 배팅 기록
  const bet = {
    id: uuidv4(), user_id: user.id, match_id,
    match_name: `${match.home} vs ${match.away}`,
    league: match.league, pick, odds, amount: amt,
    potential_win, status: 'pending',
    created_at: new Date().toISOString(), settled_at: null
  };
  db.get('bets').push(bet).write();

  // 거래내역
  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: 'bet',
    amount: -amt, balance_after: newPoints,
    desc: `스포츠 배팅: ${match.home} vs ${match.away} (${pick === 'home' ? match.home : pick === 'away' ? match.away : '무승부'}) x${odds}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, bet, points: newPoints });
});

// ===== 내 배팅 내역 =====
router.get('/my-bets', authMiddleware, (req, res) => {
  const bets = db.get('bets').filter({ user_id: req.user.id }).value()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(bets);
});

// ===== 경기 결과 처리 (관리자 / 자동 시뮬레이션) =====
router.post('/settle/:match_id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.' });
  const { result } = req.body; // 'home' | 'draw' | 'away'
  const match = db.get('games.sports').find({ id: req.params.match_id }).value();
  if (!match) return res.status(404).json({ error: '경기 없음' });

  db.get('games.sports').find({ id: req.params.match_id }).assign({ status: 'finished', result }).write();

  // 해당 경기 배팅 정산
  const pendingBets = db.get('bets').filter({ match_id: req.params.match_id, status: 'pending' }).value();
  let settledCount = 0;
  pendingBets.forEach(bet => {
    const won = bet.pick === result;
    const user = db.get('users').find({ id: bet.user_id }).value();
    if (won) {
      db.get('users').find({ id: bet.user_id }).assign({
        points: user.points + bet.potential_win,
        total_won: user.total_won + bet.potential_win
      }).write();
      db.get('transactions').push({
        id: uuidv4(), user_id: bet.user_id, type: 'win',
        amount: bet.potential_win, balance_after: user.points + bet.potential_win,
        desc: `스포츠 배팅 당첨: ${bet.match_name}`,
        created_at: new Date().toISOString()
      }).write();
    }
    db.get('bets').find({ id: bet.id }).assign({ status: won ? 'won' : 'lost', settled_at: new Date().toISOString() }).write();
    settledCount++;
  });

  res.json({ success: true, settled: settledCount });
});

// ===== 경기 스코어 업데이트 (관리자) =====
router.put('/matches/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.' });
  const { home_score, away_score, minute, status } = req.body;
  db.get('games.sports').find({ id: req.params.id }).assign({ home_score, away_score, minute, status }).write();
  res.json({ success: true });
});

// ===== 새 경기 추가 (관리자) =====
router.post('/matches', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.' });
  const { league, home, away, home_odds, draw_odds, away_odds, start_time } = req.body;
  const match = {
    id: uuidv4(), league, home, away,
    home_odds: parseFloat(home_odds), draw_odds: draw_odds ? parseFloat(draw_odds) : null,
    away_odds: parseFloat(away_odds), status: 'scheduled',
    home_score: 0, away_score: 0, minute: 0,
    start_time: start_time || new Date().toISOString()
  };
  db.get('games.sports').push(match).write();
  res.json({ success: true, match });
});

module.exports = router;
