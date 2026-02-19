const express = require('express');
const router = express.Router();
const db = require('./db');

// ===== 랭킹 조회 =====
// type: 'points' | 'won' | 'bet'
router.get('/', (req, res) => {
  const type = req.query.type || 'points';
  const limit = parseInt(req.query.limit) || 20;

  const users = db.get('users')
    .filter(u => u.role !== 'admin' && u.status !== 'banned')
    .value();

  let sorted;
  if (type === 'points') {
    sorted = users.sort((a, b) => (b.points || 0) - (a.points || 0));
  } else if (type === 'won') {
    sorted = users.sort((a, b) => (b.total_won || 0) - (a.total_won || 0));
  } else if (type === 'bet') {
    sorted = users.sort((a, b) => (b.total_bet || 0) - (a.total_bet || 0));
  } else {
    sorted = users.sort((a, b) => (b.points || 0) - (a.points || 0));
  }

  const ranking = sorted.slice(0, limit).map((u, i) => ({
    rank: i + 1,
    nickname: u.nickname,
    username: u.username.replace(/(.{2}).*(.{1})/, '$1***$2'), // 아이디 마스킹
    points: u.points || 0,
    total_won: u.total_won || 0,
    total_bet: u.total_bet || 0,
    created_at: u.created_at
  }));

  res.json({ ranking, type });
});

module.exports = router;
