const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// data 폴더가 없으면 자동 생성
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adapter = new FileSync(path.join(dataDir, 'db.json'));
const db = low(adapter);

// DB 기본값 초기화
db.defaults({
  users: [],
  bets: [],
  transactions: [],
  games: {
    sports: [],
    minigame_results: []
  },
  settings: {
    signup_bonus: 10000,
    min_bet: 1000,
    max_bet: 500000
  }
}).write();

// 초기 관리자 계정 생성
const bcrypt = require('bcryptjs');
const adminExists = db.get('users').find({ role: 'admin' }).value();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin1234', 10);
  db.get('users').push({
    id: uuidv4(),
    username: 'admin',
    password: hash,
    nickname: '관리자',
    role: 'admin',
    points: 9999999,
    total_charged: 0,
    total_withdrawn: 0,
    total_bet: 0,
    total_won: 0,
    status: 'active',
    referral_code: 'ADMIN',
    referred_by: null,
    created_at: new Date().toISOString(),
    last_login: null,
    ip: '127.0.0.1'
  }).write();
}

// 초기 스포츠 경기 데이터
const sportsExists = db.get('games.sports').value();
if (!sportsExists || sportsExists.length === 0) {
  const matches = [
    { id: uuidv4(), league: '프리미어리그', home: '맨시티', away: '맨유', home_odds: 1.65, draw_odds: 3.80, away_odds: 5.20, status: 'live', home_score: 1, away_score: 0, minute: 34, start_time: new Date().toISOString() },
    { id: uuidv4(), league: 'NBA', home: '레이커스', away: '셀틱스', home_odds: 1.90, draw_odds: null, away_odds: 1.95, status: 'live', home_score: 45, away_score: 48, minute: 'Q2', start_time: new Date().toISOString() },
    { id: uuidv4(), league: 'K리그1', home: '전북', away: '울산', home_odds: 2.10, draw_odds: 3.40, away_odds: 3.20, status: 'scheduled', home_score: 0, away_score: 0, minute: 0, start_time: new Date(Date.now() + 3600000).toISOString() },
    { id: uuidv4(), league: 'MLB', home: '다저스', away: '양키스', home_odds: 1.55, draw_odds: null, away_odds: 2.45, status: 'live', home_score: 3, away_score: 2, minute: '7회', start_time: new Date().toISOString() },
    { id: uuidv4(), league: '라리가', home: '바르셀로나', away: '레알마드리드', home_odds: 2.30, draw_odds: 3.50, away_odds: 2.80, status: 'scheduled', home_score: 0, away_score: 0, minute: 0, start_time: new Date(Date.now() + 7200000).toISOString() },
    { id: uuidv4(), league: '챔피언스리그', home: '바이에른', away: '파리생제르맹', home_odds: 1.75, draw_odds: 3.90, away_odds: 4.50, status: 'live', home_score: 2, away_score: 2, minute: 67, start_time: new Date().toISOString() },
  ];
  db.set('games.sports', matches).write();
}

module.exports = db;
