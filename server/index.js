require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 미들웨어 =====
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'kry486_session_2026',
  resave: false, saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ===== 정적 파일 =====
app.use(express.static(path.join(__dirname, '../public')));

// ===== API 라우터 =====
const { router: authRouter } = require('./auth');
app.use('/api/auth', authRouter);
app.use('/api/points', require('./points'));
app.use('/api/sports', require('./sports'));
app.use('/api/casino', require('./casino'));
app.use('/api/minigame', require('./minigame'));
app.use('/api/admin', require('./admin'));
app.use('/api/report', require('./report'));
app.use('/api/ranking', require('./ranking'));

// ===== SPA 라우팅 =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ===== 자동 경기 결과 시뮬레이션 (60초마다) =====
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
setInterval(() => {
  const liveMatches = db.get('games.sports').filter({ status: 'live' }).value();
  liveMatches.forEach(match => {
    // 랜덤하게 스코어 업데이트
    if (Math.random() < 0.3) {
      const scoringTeam = Math.random() < 0.5 ? 'home' : 'away';
      const update = {};
      if (scoringTeam === 'home') update.home_score = match.home_score + 1;
      else update.away_score = match.away_score + 1;
      if (typeof match.minute === 'number') {
        update.minute = Math.min(90, match.minute + Math.floor(Math.random() * 10));
        if (update.minute >= 90) {
          update.status = 'finished';
          const hs = update.home_score || match.home_score;
          const as = update.away_score || match.away_score;
          update.result = hs > as ? 'home' : as > hs ? 'away' : 'draw';
          // 배팅 자동 정산
          const pendingBets = db.get('bets').filter({ match_id: match.id, status: 'pending' }).value();
          pendingBets.forEach(bet => {
            const won = bet.pick === update.result;
            const user = db.get('users').find({ id: bet.user_id }).value();
            if (!user) return;
            if (won) {
              db.get('users').find({ id: bet.user_id }).assign({
                points: user.points + bet.potential_win, total_won: user.total_won + bet.potential_win
              }).write();
              db.get('transactions').push({
                id: uuidv4(), user_id: bet.user_id, type: 'win',
                amount: bet.potential_win, balance_after: user.points + bet.potential_win,
                desc: `스포츠 배팅 당첨 (자동정산): ${bet.match_name}`, created_at: new Date().toISOString()
              }).write();
            }
            db.get('bets').find({ id: bet.id }).assign({ status: won ? 'won' : 'lost', settled_at: new Date().toISOString() }).write();
          });
        }
      }
      db.get('games.sports').find({ id: match.id }).assign(update).write();
    }
  });

  // 예정 경기 → 라이브로 전환
  const scheduled = db.get('games.sports').filter({ status: 'scheduled' }).value();
  scheduled.forEach(match => {
    if (new Date(match.start_time) <= new Date()) {
      db.get('games.sports').find({ id: match.id }).assign({ status: 'live' }).write();
    }
  });
}, 60000);

app.listen(PORT, () => {
  console.log(`\n🎰 KRY486 서버 실행중!`);
  console.log(`📡 주소: http://localhost:${PORT}`);
  console.log(`👤 관리자: admin / admin1234\n`);
});
