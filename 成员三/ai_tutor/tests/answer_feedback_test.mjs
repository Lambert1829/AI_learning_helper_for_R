import assert from 'node:assert/strict';
import test from 'node:test';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const fb = await import('../static/answer-feedback.js');
const KEY = 'r-tutor-answer-feedback-v1';
const entry = (id, rating, extra = {}) => ({id, at:`2026-11-16T10:00:${String(id).padStart(2, '0')}Z`, rating, reasons:[], note:'',
  question:'q' + id, task_type:'concept', mode:'mock', model:'', knowledge:['K06'], case_id:'', status:'ok', answer_excerpt:'a', ...extra});
const seed = items => memory.set(KEY, JSON.stringify({version:1, items:Object.fromEntries(items.map(e => [e.id, e]))}));

test('summary counts ratings, tasks and reasons', () => {
  seed([entry(1, 1), entry(2, -1, {reasons:['没讲清楚'], task_type:'debug'}), entry(3, -1)]);
  const s = fb.summarize();
  assert.equal(s.total, 3); assert.equal(s.up, 1); assert.equal(s.down, 2);
  assert.equal(Math.round(s.rate * 100), 33);
  assert.deepEqual(s.byTask['纠错'], {up:0, total:1});
  assert.deepEqual(s.reasons, {'没讲清楚':1, '未注明':1});
  assert.equal(s.recentDown[0].id, 3);
});

test('csv has BOM, CRLF, escaped quotes and neutralised formulas', () => {
  seed([entry(1, -1, {note:'=SUM(A1)', question:'他说"对"', reasons:['讲解有误', '代码有问题']})]);
  const csv = fb.feedbackCsv();
  assert.ok(csv.startsWith('﻿"时间"'));
  const line = csv.split('\r\n')[1];
  assert.match(line, /"'=SUM\(A1\)"/);
  assert.match(line, /"他说""对"""/);
  assert.match(line, /"讲解有误、代码有问题"/);
  assert.match(line, /"需改进"/);
});

test('corrupt or foreign storage falls back to empty', () => {
  memory.set(KEY, '{not json'); assert.equal(fb.feedbackEntries().length, 0);
  memory.set(KEY, JSON.stringify({version:9, items:{x:entry(1, 1)}})); assert.equal(fb.summarize().total, 0);
});
