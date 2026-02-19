const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authMiddleware } = require('./auth');

// =========================================
// 홀짝 (Odd/Even)
// =========================================
router.post('/oddeven', authMiddleware, (req, res) => {
  const { pick, amount } = req.body; // pick: 'odd' | 'even'
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });
  if (pick !== 'odd' && pick !== 'even') return res.status(400).json({ error: '홀 또는 짝을 선택하세요.' });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  // 1~100 숫자 뽑기
  const number = Math.floor(Math.random() * 100) + 1;
  const result = number % 2 === 0 ? 'even' : 'odd';
  const won = pick === result;
  const winAmount = won ? Math.floor(amt * 1.95) : 0;
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints, total_bet: user.total_bet + amt, total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: won ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `홀짝 [${number}/${result === 'odd' ? '홀' : '짝'}] ${won ? '당첨' : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, number, result, pick, won, win_amount: winAmount, net_change: netChange, points: newPoints });
});

// =========================================
// 사다리 (Ladder Game)
// =========================================
router.post('/ladder', authMiddleware, (req, res) => {
  const { pick, amount } = req.body; // pick: 'left' | 'right'
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });
  if (pick !== 'left' && pick !== 'right') return res.status(400).json({ error: '왼쪽 또는 오른쪽을 선택하세요.' });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  // 사다리 시뮬레이션
  const startLeft = Math.random() < 0.5; // 왼쪽 시작
  const bridges = Array.from({ length: 5 }, () => Math.random() < 0.5); // 각 단계 가로선 여부
  let pos = startLeft; // true = 왼쪽, false = 오른쪽
  const path = [pos];
  bridges.forEach(hasBridge => {
    if (hasBridge) pos = !pos;
    path.push(pos);
  });
  const result = pos ? 'left' : 'right';
  const won = pick === result;
  const winAmount = won ? Math.floor(amt * 1.95) : 0;
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints, total_bet: user.total_bet + amt, total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: won ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `사다리 [${result === 'left' ? '왼쪽' : '오른쪽'} 도착] ${won ? '당첨' : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, result, pick, won, win_amount: winAmount, net_change: netChange, points: newPoints, bridges, path });
});

// =========================================
// 동전 던지기 (Coin Flip)
// =========================================
router.post('/coin', authMiddleware, (req, res) => {
  const { pick, amount } = req.body; // pick: 'heads' | 'tails'
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = pick === result;
  const winAmount = won ? Math.floor(amt * 1.95) : 0;
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints, total_bet: user.total_bet + amt, total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: won ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `동전던지기 [${result === 'heads' ? '앞면' : '뒷면'}] ${won ? '당첨' : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, result, pick, won, win_amount: winAmount, net_change: netChange, points: newPoints });
});

// =========================================
// 주사위 (Dice)
// =========================================
router.post('/dice', authMiddleware, (req, res) => {
  const { pick, amount } = req.body; // pick: 'high'(4-6) | 'low'(1-3)
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  const dice = Math.floor(Math.random() * 6) + 1;
  const result = dice >= 4 ? 'high' : 'low';
  const won = pick === result;
  const winAmount = won ? Math.floor(amt * 1.95) : 0;
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints, total_bet: user.total_bet + amt, total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: won ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `주사위 [${dice}/${result === 'high' ? '대' : '소'}] ${won ? '당첨' : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, dice, result, pick, won, win_amount: winAmount, net_change: netChange, points: newPoints });
});

module.exports = router;
