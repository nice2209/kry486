const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authMiddleware } = require('./auth');

// ===== 포인트 충전 신청 (관리자만 가능) =====
router.post('/charge', authMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();

  // 일반 유저 충전 완전 차단
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '포인트 충전은 관리자만 가능합니다. 고객센터에 문의하세요.' });
  }

  const { amount } = req.body;
  const amt = parseInt(amount);
  if (!amt || amt < 10000) return res.status(400).json({ error: '최소 충전 금액은 10,000P 입니다.' });
  if (amt > 10000000) return res.status(400).json({ error: '최대 충전 금액은 10,000,000P 입니다.' });

  const newPoints = user.points + amt;
  db.get('users').find({ id: user.id }).assign({
    points: newPoints,
    total_charged: user.total_charged + amt
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: 'charge',
    amount: amt, balance_after: newPoints,
    desc: `포인트 충전 (관리자)`, status: 'approved',
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, points: newPoints, message: `${amt.toLocaleString()}P가 충전되었습니다.` });
});

// ===== 포인트 환전 신청 =====
router.post('/withdraw', authMiddleware, (req, res) => {
  const { amount } = req.body;
  const amt = parseInt(amount);
  if (!amt || amt < 30000) return res.status(400).json({ error: '최소 환전 금액은 30,000P 입니다.' });

  const user = db.get('users').find({ id: req.user.id }).value();
  if (user.points < amt) return res.status(400).json({ error: '포인트가 부족합니다.' });

  const newPoints = user.points - amt;
  db.get('users').find({ id: user.id }).assign({
    points: newPoints,
    total_withdrawn: user.total_withdrawn + amt
  }).write();

  db.get('transactions').push({
    id: uuidv4(), user_id: user.id, type: 'withdraw',
    amount: -amt, balance_after: newPoints,
    desc: `포인트 환전 신청`, status: 'approved',
    created_at: new Date().toISOString()
  }).write();

  res.json({ success: true, points: newPoints, message: `${amt.toLocaleString()}P 환전 신청이 완료되었습니다.` });
});

// ===== 거래 내역 조회 =====
router.get('/history', authMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const allTx = db.get('transactions').filter({ user_id: req.user.id }).value()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = allTx.length;
  const items = allTx.slice((page - 1) * limit, page * limit);
  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

// ===== 현재 포인트 조회 =====
router.get('/balance', authMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  res.json({ points: user.points });
});

module.exports = router;
