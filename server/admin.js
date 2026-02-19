const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { adminMiddleware } = require('./auth');

// ===== 전체 통계 =====
router.get('/stats', adminMiddleware, (req, res) => {
  const users = db.get('users').value();
  const bets  = db.get('bets').value();
  const txs   = db.get('transactions').value();
  const totalPoints = users.reduce((s, u) => s + (u.points || 0), 0);
  const totalBet = bets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalWon = txs.filter(t => t.type === 'win').reduce((s, t) => s + t.amount, 0);
  res.json({
    total_users: users.filter(u => u.role !== 'admin').length,
    active_users: users.filter(u => u.status === 'active' && u.role !== 'admin').length,
    banned_users: users.filter(u => u.status === 'banned').length,
    total_points_in_system: totalPoints,
    total_bet_amount: totalBet,
    total_won_amount: totalWon,
    house_edge: totalBet > 0 ? (((totalBet - totalWon) / totalBet) * 100).toFixed(2) + '%' : '0%',
    pending_bets: bets.filter(b => b.status === 'pending').length,
    today_signups: users.filter(u => new Date(u.created_at).toDateString() === new Date().toDateString()).length,
  });
});

// ===== 회원 목록 =====
router.get('/users', adminMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const search = req.query.search || '';
  let users = db.get('users').value().filter(u => u.role !== 'admin');
  if (search) users = users.filter(u => u.username.includes(search) || u.nickname.includes(search));
  users = users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = users.length;
  const items = users.slice((page - 1) * limit, page * limit).map(({ password, ...u }) => u);
  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

// ===== 회원 상세 =====
router.get('/users/:id', adminMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  const { password, ...safeUser } = user;
  const userBets = db.get('bets').filter({ user_id: user.id }).value();
  const userTxs = db.get('transactions').filter({ user_id: user.id }).value();
  res.json({ user: safeUser, bets: userBets.slice(-10), transactions: userTxs.slice(-10) });
});

// ===== 포인트 지급/차감 =====
router.post('/users/:id/points', adminMiddleware, (req, res) => {
  const { amount, reason } = req.body;
  const amt = parseInt(amount);
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  const newPoints = Math.max(0, user.points + amt);
  db.get('users').find({ id: user.id }).assign({ points: newPoints }).write();
  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: amt > 0 ? 'admin_give' : 'admin_take',
    amount: amt, balance_after: newPoints,
    desc: `관리자 ${amt > 0 ? '지급' : '차감'}: ${reason || '관리자 처리'}`,
    created_at: new Date().toISOString()
  }).write();
  res.json({ success: true, points: newPoints });
});

// ===== 회원 정지/해제 =====
router.post('/users/:id/ban', adminMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  const newStatus = user.status === 'banned' ? 'active' : 'banned';
  db.get('users').find({ id: user.id }).assign({ status: newStatus }).write();
  res.json({ success: true, status: newStatus });
});

// ===== 전체 배팅 내역 =====
router.get('/bets', adminMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 30;
  const bets = db.get('bets').value().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = bets.length;
  const items = bets.slice((page - 1) * limit, page * limit);
  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

// ===== 전체 거래내역 =====
router.get('/transactions', adminMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 30;
  const txs = db.get('transactions').value().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = txs.length;
  const items = txs.slice((page - 1) * limit, page * limit);
  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

// ===== 사이트 설정 =====
router.get('/settings', adminMiddleware, (req, res) => {
  res.json(db.get('settings').value());
});
router.put('/settings', adminMiddleware, (req, res) => {
  const { signup_bonus, min_bet, max_bet } = req.body;
  db.get('settings').assign({ signup_bonus: parseInt(signup_bonus), min_bet: parseInt(min_bet), max_bet: parseInt(max_bet) }).write();
  res.json({ success: true });
});

// ===== 경기 추가 =====
router.post('/matches', adminMiddleware, (req, res) => {
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

// ===== 경기 결과 처리 =====
router.post('/settle/:match_id', adminMiddleware, (req, res) => {
  const { result } = req.body;
  const match = db.get('games.sports').find({ id: req.params.match_id }).value();
  if (!match) return res.status(404).json({ error: '경기 없음' });

  db.get('games.sports').find({ id: req.params.match_id }).assign({ status: 'finished', result }).write();

  const pendingBets = db.get('bets').filter({ match_id: req.params.match_id, status: 'pending' }).value();
  let settled = 0;
  pendingBets.forEach(bet => {
    const won = bet.pick === result;
    const user = db.get('users').find({ id: bet.user_id }).value();
    if (!user) return;
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
    settled++;
  });
  res.json({ success: true, settled });
});

module.exports = router;
