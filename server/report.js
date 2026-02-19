const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authMiddleware, adminMiddleware } = require('./auth');

// DB 기본값에 reports 추가
if (!db.has('reports').value()) {
  db.set('reports', []).write();
}

// ===== 신고 제출 (유저) =====
router.post('/', authMiddleware, (req, res) => {
  const { type, title, content } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '제목을 입력해 주세요.' });
  if (!content || !content.trim()) return res.status(400).json({ error: '내용을 입력해 주세요.' });

  const validTypes = ['game_error', 'cheating', 'point_error', 'other'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: '올바른 신고 유형을 선택하세요.' });

  const user = db.get('users').find({ id: req.user.id }).value();

  const report = {
    id: uuidv4(),
    user_id: req.user.id,
    username: user.username,
    nickname: user.nickname,
    type,
    title: title.trim(),
    content: content.trim(),
    status: 'pending',       // pending | resolved
    admin_reply: null,
    created_at: new Date().toISOString(),
    resolved_at: null
  };

  db.get('reports').push(report).write();
  res.json({ success: true, message: '신고가 접수되었습니다. 관리자가 검토 후 처리합니다.' });
});

// ===== 내 신고 내역 조회 (유저) =====
router.get('/my', authMiddleware, (req, res) => {
  const reports = db.get('reports')
    .filter({ user_id: req.user.id })
    .value()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);
  res.json({ reports });
});

// ===== 전체 신고 목록 (관리자) =====
router.get('/admin/list', adminMiddleware, (req, res) => {
  const { status } = req.query; // 'all' | 'pending' | 'resolved'
  let reports = db.get('reports').value()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (status && status !== 'all') {
    reports = reports.filter(r => r.status === status);
  }
  res.json({ reports, total: reports.length });
});

// ===== 신고 처리 (관리자) =====
router.post('/admin/:id/resolve', adminMiddleware, (req, res) => {
  const { admin_reply } = req.body;
  const report = db.get('reports').find({ id: req.params.id }).value();
  if (!report) return res.status(404).json({ error: '신고를 찾을 수 없습니다.' });

  db.get('reports').find({ id: req.params.id }).assign({
    status: 'resolved',
    admin_reply: admin_reply || '처리 완료',
    resolved_at: new Date().toISOString()
  }).write();

  res.json({ success: true });
});

// ===== 신고 삭제 (관리자) =====
router.delete('/admin/:id', adminMiddleware, (req, res) => {
  const reports = db.get('reports').value().filter(r => r.id !== req.params.id);
  db.set('reports', reports).write();
  res.json({ success: true });
});

module.exports = router;
