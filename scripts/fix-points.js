/**
 * 비정상 충전 내역 정리 스크립트
 * 일반 유저의 모든 'charge' 타입 트랜잭션을 제거하고 포인트 재계산
 */
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, '../data/db.json'));
const db = low(adapter);

const allTx = db.get('transactions').value();
const users = db.get('users').value();

console.log('=== 비정상 충전 정리 시작 ===\n');

// 관리자 ID 목록
const adminIds = users.filter(u => u.role === 'admin').map(u => u.id);
console.log(`관리자 계정: ${adminIds.length}개`);

// 일반 유저의 charge 트랜잭션 찾기
const illegalCharges = allTx.filter(tx => 
  tx.type === 'charge' && !adminIds.includes(tx.user_id)
);

if (illegalCharges.length === 0) {
  console.log('\n비정상 충전 내역 없음. 종료.');
  process.exit(0);
}

console.log(`\n⚠️  비정상 충전 발견: ${illegalCharges.length}건`);

// 유저별 불법 충전 합계
const byUser = {};
illegalCharges.forEach(tx => {
  if (!byUser[tx.user_id]) byUser[tx.user_id] = 0;
  byUser[tx.user_id] += tx.amount;
});

Object.entries(byUser).forEach(([uid, total]) => {
  const user = users.find(u => u.id === uid);
  console.log(`  - ${user ? user.username : uid}: ${total.toLocaleString()}P 불법 충전`);
  
  // 포인트 차감 (최소 0)
  const currentUser = db.get('users').find({ id: uid }).value();
  const newPoints = Math.max(0, currentUser.points - total);
  db.get('users').find({ id: uid }).assign({ 
    points: newPoints,
    total_charged: Math.max(0, currentUser.total_charged - total)
  }).write();
  console.log(`    → 포인트 조정: ${currentUser.points.toLocaleString()}P → ${newPoints.toLocaleString()}P`);
});

// 불법 충전 트랜잭션 삭제
const illegalIds = new Set(illegalCharges.map(tx => tx.id));
const cleanTx = allTx.filter(tx => !illegalIds.has(tx.id));
db.set('transactions', cleanTx).write();

console.log(`\n✅ 완료! ${illegalCharges.length}건의 불법 충전 트랜잭션 삭제됨`);
console.log('=== 정리 완료 ===\n');
