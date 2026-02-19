const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const SECRET = process.env.JWT_SECRET || 'kry486_secret_2026';

// JWT 검증 미들웨어
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.session?.token;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인하세요.' });
  }
}

// 관리자 미들웨어
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 접근 가능합니다.' });
    next();
  });
}

// ===== 회원가입 =====
router.post('/register', (req, res) => {
  const { username, password, nickname, referral_code } = req.body;
  if (!username || !password || !nickname) return res.status(400).json({ error: '모든 필드를 입력하세요.' });
  if (username.length < 4 || username.length > 12) return res.status(400).json({ error: '아이디는 4~12자 이내입니다.' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상입니다.' });
  if (!/^[a-zA-Z0-9]+$/.test(username)) return res.status(400).json({ error: '아이디는 영문/숫자만 가능합니다.' });

  const exists = db.get('users').find({ username }).value();
  if (exists) return res.status(400).json({ error: '이미 사용중인 아이디입니다.' });

  const nicknameExists = db.get('users').find({ nickname }).value();
  if (nicknameExists) return res.status(400).json({ error: '이미 사용중인 닉네임입니다.' });

  // 추천인 처리
  let referred_by = null;
  if (referral_code) {
    const referrer = db.get('users').find({ referral_code }).value();
    if (referrer) {
      referred_by = referrer.id;
      // 추천인 보너스 지급
      db.get('users').find({ id: referrer.id }).assign({ 
        points: referrer.points + 3000
      }).write();
      // 추천인 트랜잭션
      db.get('transactions').push({
        id: uuidv4(), user_id: referrer.id, type: 'bonus',
        amount: 3000, balance_after: referrer.points + 3000,
        desc: `추천인 보너스 (${nickname} 가입)`, created_at: new Date().toISOString()
      }).write();
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const settings = db.get('settings').value();
  const signupBonus = settings.signup_bonus || 10000;
  const newUser = {
    id: uuidv4(), username, password: hash, nickname, role: 'user',
    points: signupBonus, total_charged: 0, total_withdrawn: 0,
    total_bet: 0, total_won: 0, status: 'active',
    referral_code: username.toUpperCase() + Math.floor(Math.random()*1000),
    referred_by, created_at: new Date().toISOString(),
    last_login: null, ip: req.ip || '0.0.0.0'
  };

  db.get('users').push(newUser).write();
  db.get('transactions').push({
    id: uuidv4(), user_id: newUser.id, type: 'bonus',
    amount: signupBonus, balance_after: signupBonus,
    desc: '회원가입 보너스', created_at: new Date().toISOString()
  }).write();

  const token = jwt.sign({ id: newUser.id, username, nickname, role: 'user' }, SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { username, nickname, points: signupBonus, role: 'user' } });
});

// ===== 로그인 =====
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });

  const user = db.get('users').find({ username }).value();
  if (!user) return res.status(400).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });
  if (user.status === 'banned') return res.status(403).json({ error: '정지된 계정입니다. 고객센터에 문의하세요.' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(400).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

  db.get('users').find({ id: user.id }).assign({ last_login: new Date().toISOString(), ip: req.ip || '0.0.0.0' }).write();

  const token = jwt.sign({ id: user.id, username, nickname: user.nickname, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { username, nickname: user.nickname, points: user.points, role: user.role } });
});

// ===== 내 정보 =====
router.get('/me', authMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

module.exports = { router, authMiddleware, adminMiddleware };
