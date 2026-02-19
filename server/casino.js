const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authMiddleware } = require('./auth');

// =========================================
// 바카라 (Baccarat) - 정통 룰
// =========================================
function drawCard() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const val = values[Math.floor(Math.random() * 13)];
  const suit = suits[Math.floor(Math.random() * 4)];
  // A=1, 2~9=face value, 10/J/Q/K=0
  let point = 0;
  if (val === 'A') point = 1;
  else if (['10', 'J', 'Q', 'K'].includes(val)) point = 0;
  else point = parseInt(val);
  return { card: suit + val, point };
}

function handTotal(cards) {
  return cards.reduce((s, c) => s + c.point, 0) % 10;
}

/**
 * 정통 바카라 3번째 카드 규칙
 * https://en.wikipedia.org/wiki/Baccarat_(card_game)#Third_card_rule
 */
function applyThirdCardRule(playerCards, bankerCards) {
  let pTotal = handTotal(playerCards);
  let bTotal = handTotal(bankerCards);
  let playerDrewThird = false;
  let playerThirdValue = null;

  // ─── Natural: 8 or 9 → 즉시 종료 ───
  if (pTotal >= 8 || bTotal >= 8) {
    return { playerCards, bankerCards };
  }

  // ─── 플레이어 3번째 카드 ───
  // 플레이어 합이 0~5면 반드시 드로우, 6~7이면 스탠드
  if (pTotal <= 5) {
    const c = drawCard();
    playerCards.push(c);
    playerDrewThird = true;
    playerThirdValue = c.point;
    pTotal = handTotal(playerCards);
  }

  // ─── 뱅커 3번째 카드 ───
  bTotal = handTotal(bankerCards); // 재계산
  if (!playerDrewThird) {
    // 플레이어가 스탠드(6~7)했을 때: 뱅커는 0~5면 드로우
    if (bTotal <= 5) {
      bankerCards.push(drawCard());
    }
  } else {
    // 플레이어가 드로우했을 때: 뱅커 규칙표 적용
    const p3 = playerThirdValue;
    if (bTotal <= 2) {
      bankerCards.push(drawCard());
    } else if (bTotal === 3) {
      // 플레이어 3번째가 8이 아니면 드로우
      if (p3 !== 8) bankerCards.push(drawCard());
    } else if (bTotal === 4) {
      // 플레이어 3번째가 2~7이면 드로우
      if (p3 >= 2 && p3 <= 7) bankerCards.push(drawCard());
    } else if (bTotal === 5) {
      // 플레이어 3번째가 4~7이면 드로우
      if (p3 >= 4 && p3 <= 7) bankerCards.push(drawCard());
    } else if (bTotal === 6) {
      // 플레이어 3번째가 6~7이면 드로우
      if (p3 === 6 || p3 === 7) bankerCards.push(drawCard());
    }
    // bTotal === 7: 항상 스탠드
  }

  return { playerCards, bankerCards };
}

router.post('/baccarat', authMiddleware, (req, res) => {
  // bet_type: 'player'|'banker'|'tie'|'playerPair'|'bankerPair'
  // extra_bets: { player, banker, tie, playerPair, bankerPair }
  // demo: true → 포인트 차감 없이 카드만 딜
  const { bet_type, amount, extra_bets, demo } = req.body;
  const isDemo = demo === true || parseInt(amount) === 0;

  const user = db.get('users').find({ id: req.user.id }).value();
  const settings = db.get('settings').value();

  // ── 배팅 금액 파싱 ──────────────────────────────────────────
  // extra_bets가 있으면 전체 배팅 처리, 없으면 단일 bet_type/amount
  let bets = {}; // { player, banker, tie, playerPair, bankerPair }
  if (extra_bets && typeof extra_bets === 'object') {
    bets = {
      player:     Math.max(0, parseInt(extra_bets.player)     || 0),
      banker:     Math.max(0, parseInt(extra_bets.banker)     || 0),
      tie:        Math.max(0, parseInt(extra_bets.tie)        || 0),
      playerPair: Math.max(0, parseInt(extra_bets.playerPair) || 0),
      bankerPair: Math.max(0, parseInt(extra_bets.bankerPair) || 0),
    };
  } else if (!isDemo) {
    const amt = parseInt(amount);
    if (!amt || amt < settings.min_bet) return res.status(400).json({ error: `최소 배팅은 ${settings.min_bet.toLocaleString()}P` });
    if (amt > settings.max_bet) return res.status(400).json({ error: `최대 배팅은 ${settings.max_bet.toLocaleString()}P` });
    bets[bet_type] = amt;
  }

  const totalBet = Object.values(bets).reduce((s, v) => s + v, 0);

  if (!isDemo) {
    if (totalBet < 1) return res.status(400).json({ error: '배팅 금액이 없습니다.' });
    if (user.points < totalBet) return res.status(400).json({ error: '포인트 부족' });
  }

  // ── 카드 딜 + 3번째 카드 규칙 ──────────────────────────────
  let playerCards = [drawCard(), drawCard()];
  let bankerCards = [drawCard(), drawCard()];
  const dealt = applyThirdCardRule(playerCards, bankerCards);
  playerCards = dealt.playerCards;
  bankerCards = dealt.bankerCards;

  const playerTotal = handTotal(playerCards);
  const bankerTotal = handTotal(bankerCards);
  const winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
  const isNatural = playerTotal >= 8 || bankerTotal >= 8;

  // ── 페어 체크 ────────────────────────────────────────────────
  const playerPairWon = playerCards.length >= 2 && playerCards[0].point === playerCards[1].point;
  const bankerPairWon = bankerCards.length >= 2 && bankerCards[0].point === bankerCards[1].point;

  // ── 배당 계산 ────────────────────────────────────────────────
  // 배당률: player×2, banker×1.95, tie×9, pair×12
  let totalWin = 0;
  const betResults = {};

  const calcWin = (type, betAmt) => {
    if (!betAmt) return 0;
    let won = false;
    let mult = 0;
    if (type === 'player')     { won = winner === 'player'; mult = 2.00; }
    if (type === 'banker')     { won = winner === 'banker'; mult = 1.95; }
    if (type === 'tie')        { won = winner === 'tie';    mult = 9.00; }
    if (type === 'playerPair') { won = playerPairWon;       mult = 12.00; }
    if (type === 'bankerPair') { won = bankerPairWon;       mult = 12.00; }
    const win = won ? Math.floor(betAmt * mult) : 0;
    betResults[type] = { bet: betAmt, won, win };
    return win;
  };

  if (!isDemo) {
    Object.keys(bets).forEach(k => { totalWin += calcWin(k, bets[k]); });
  }

  const netChange = totalWin - totalBet;
  const newPoints = isDemo ? user.points : user.points - totalBet + totalWin;

  // ── DB 저장 ──────────────────────────────────────────────────
  if (!isDemo && totalBet > 0) {
    db.get('users').find({ id: user.id }).assign({
      points: newPoints,
      total_bet: user.total_bet + totalBet,
      total_won: user.total_won + totalWin
    }).write();

    const betDesc = Object.keys(bets).filter(k => bets[k] > 0)
      .map(k => ({ player:'플레이어', banker:'뱅커', tie:'타이', playerPair:'플레이어페어', bankerPair:'뱅커페어' }[k]))
      .join('+');
    db.get('transactions').push({
      id: uuidv4(), user_id: user.id,
      type: totalWin > totalBet ? 'win' : 'loss',
      amount: netChange, balance_after: newPoints,
      desc: `바카라 [${betDesc}] - ${winner === 'player' ? '플레이어' : winner === 'banker' ? '뱅커' : '타이'} 승`,
      created_at: new Date().toISOString()
    }).write();
  }

  // 주 배팅 기준 won/win_amount (레거시 호환)
  const mainType = Object.keys(bets).find(k => bets[k] > 0) || bet_type || 'player';
  const mainWon = betResults[mainType] ? betResults[mainType].won : false;

  res.json({
    success: true, winner, bet_type: mainType,
    player: { cards: playerCards, total: playerTotal },
    banker: { cards: bankerCards, total: bankerTotal },
    won: totalWin > 0,
    win_amount: totalWin,
    net_change: netChange,
    points: newPoints,
    natural: isNatural,
    pair: { player: playerPairWon, banker: bankerPairWon },
    bet_results: betResults,
    demo: isDemo
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
