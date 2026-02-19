const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authMiddleware } = require('./auth');

// =========================================
// 바카라 (Baccarat)
// =========================================
function drawCard() {
  const suits = ['♠','♥','♦','♣'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const val = values[Math.floor(Math.random() * 13)];
  const suit = suits[Math.floor(Math.random() * 4)];
  let point = parseInt(val) || 0; // A=1, J/Q/K=0
  if (val === 'A') point = 1;
  return { card: suit + val, point: point % 10 };
}
function handTotal(cards) {
  return cards.reduce((s, c) => s + c.point, 0) % 10;
}

router.post('/baccarat', authMiddleware, (req, res) => {
  const { bet_type, amount } = req.body; // bet_type: 'player'|'banker'|'tie'
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  // 딜
  const playerCards = [drawCard(), drawCard()];
  const bankerCards = [drawCard(), drawCard()];
  let playerTotal = handTotal(playerCards);
  let bankerTotal = handTotal(bankerCards);

  // 3번째 카드 규칙 (간략화)
  if (playerTotal <= 5) { const c = drawCard(); playerCards.push(c); playerTotal = handTotal(playerCards); }
  if (bankerTotal <= 5) { const c = drawCard(); bankerCards.push(c); bankerTotal = handTotal(bankerCards); }

  let winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';

  // 배당
  let multiplier = 0;
  if (bet_type === winner) {
    if (winner === 'banker') multiplier = 1.95;
    else if (winner === 'player') multiplier = 2.00;
    else multiplier = 9.00; // tie
  }

  const winAmount = Math.floor(amt * multiplier);
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints,
    total_bet: user.total_bet + amt,
    total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: winAmount > 0 ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `바카라 - ${bet_type === 'player' ? '플레이어' : bet_type === 'banker' ? '뱅커' : '타이'} 배팅 ${winAmount > 0 ? '당첨' : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({
    success: true, winner, bet_type,
    player: { cards: playerCards, total: playerTotal },
    banker: { cards: bankerCards, total: bankerTotal },
    won: bet_type === winner, win_amount: winAmount,
    net_change: netChange, points: newPoints
  });
});

// =========================================
// 슬롯머신 (Slot Machine)
// =========================================
const SLOT_SYMBOLS = ['🍒','🍊','🍋','🔔','⭐','💎','7️⃣','🃏'];
const SLOT_PAYS = {
  '💎💎💎': 50, '7️⃣7️⃣7️⃣': 30, '⭐⭐⭐': 20, '🔔🔔🔔': 10,
  '🍒🍒🍒': 8, '🍊🍊🍊': 6, '🍋🍋🍋': 5,
  '🃏🃏🃏': 15,
  '💎💎': 3, '7️⃣7️⃣': 2.5, '⭐⭐': 2, '🍒🍒': 1.5, '🃏🃏': 2,
};

function spinSlot() {
  // 살짝 가중치 (흔한 심볼이 더 자주 나오게)
  const weights = [20, 18, 18, 15, 12, 5, 8, 10]; // 🍒 많이, 💎 적게
  function pick() {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return SLOT_SYMBOLS[i]; }
    return SLOT_SYMBOLS[0];
  }
  return [pick(), pick(), pick()];
}

router.post('/slots', authMiddleware, (req, res) => {
  const { amount } = req.body;
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > 100000) return res.status(400).json({ error: '슬롯 최대 배팅은 100,000P' });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  const reels = spinSlot();
  const key3 = reels.join('');
  const key2 = reels[0] === reels[1] ? reels[0] + reels[1] : null;
  let multiplier = SLOT_PAYS[key3] || (key2 ? SLOT_PAYS[key2] : 0) || 0;

  const winAmount = Math.floor(amt * multiplier);
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints,
    total_bet: user.total_bet + amt,
    total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: winAmount > 0 ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `슬롯머신 [${reels.join(' ')}] ${winAmount > 0 ? `x${multiplier} 당첨!` : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, reels, multiplier, won: winAmount > 0, win_amount: winAmount, net_change: netChange, points: newPoints });
});

// =========================================
// 룰렛 (Roulette)
// =========================================
router.post('/roulette', authMiddleware, (req, res) => {
  const { bet_type, bet_value, amount } = req.body;
  // bet_type: 'number'(0-36), 'red', 'black', 'odd', 'even', '1-18', '19-36', 'dozen1','dozen2','dozen3'
  const amt = parseInt(amount);
  const settings = db.get('settings').value();
  if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
  if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트 부족' });

  const result = Math.floor(Math.random() * 37); // 0~36
  const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const isRed = RED_NUMS.includes(result);
  const isOdd = result !== 0 && result % 2 !== 0;

  let won = false, multiplier = 0;
  if (bet_type === 'number') {
    won = parseInt(bet_value) === result; multiplier = 36;
  } else if (bet_type === 'red') { won = isRed; multiplier = 2; }
  else if (bet_type === 'black') { won = !isRed && result !== 0; multiplier = 2; }
  else if (bet_type === 'odd') { won = isOdd; multiplier = 2; }
  else if (bet_type === 'even') { won = !isOdd && result !== 0; multiplier = 2; }
  else if (bet_type === '1-18') { won = result >= 1 && result <= 18; multiplier = 2; }
  else if (bet_type === '19-36') { won = result >= 19 && result <= 36; multiplier = 2; }
  else if (bet_type === 'dozen1') { won = result >= 1 && result <= 12; multiplier = 3; }
  else if (bet_type === 'dozen2') { won = result >= 13 && result <= 24; multiplier = 3; }
  else if (bet_type === 'dozen3') { won = result >= 25 && result <= 36; multiplier = 3; }

  const winAmount = won ? Math.floor(amt * multiplier) : 0;
  const netChange = winAmount - amt;
  const newPoints = user.points - amt + winAmount;

  db.get('users').find({ id: user.id }).assign({
    points: newPoints,
    total_bet: user.total_bet + amt,
    total_won: user.total_won + winAmount
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: won ? 'win' : 'loss',
    amount: netChange, balance_after: newPoints,
    desc: `룰렛 [${result}${isRed ? '🔴' : result === 0 ? '🟢' : '⚫'}] - ${bet_type} ${won ? '당첨' : '낙첨'}`,
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, result, is_red: isRed, is_odd: isOdd, won, multiplier: won ? multiplier : 0, win_amount: winAmount, net_change: netChange, points: newPoints });
});

module.exports = router;
