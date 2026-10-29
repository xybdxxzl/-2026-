import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, shortestDelta, nearestTurn, termIndex, houIndex } from '../src/core/angle.js';
import { createMotion, releaseMotion, advanceMotion, dragMotion, springMotion } from '../src/core/physics.js';
import { seasonAt } from '../src/core/season.js';
import { TERMS } from '../src/data/terms.js';
import { ANIMATED_HOU } from '../src/data/hou.js';
import { FARM_TASKS, PROVERBS, relationsFor } from '../src/data/linkedRecords.js';

test('循环角度、最短路径与节气/候边界',()=>{
  assert.equal(normalize(-5),355); assert.equal(normalize(720),0);
  assert.equal(shortestDelta(350,10),20); assert.equal(shortestDelta(10,350),-20);
  assert.equal(nearestTurn(710,10),730);
  assert.equal(termIndex(15),1); assert.equal(termIndex(360),0); assert.equal(termIndex(-.01),23);
  assert.equal(houIndex(4.99),0); assert.equal(houIndex(5),1); assert.equal(houIndex(10),2); assert.equal(houIndex(15),0);
});
function simulate(hz, velocity) {
  const model=createMotion(13.4); releaseMotion(model,velocity);
  for(let frame=0;frame<hz*10&&model.phase!=='idle';frame++)advanceMotion(model,1/hz);
  assert.equal(model.phase,'idle'); assert.ok(Math.abs(model.angle/15-Math.round(model.angle/15))<.05/15);
  return model;
}
test('60Hz与144Hz惯性吸附落点相同，正反甩动均能收敛',()=>{
  for(const velocity of [0,15,360,-360,720,-1200]){
    const a=simulate(60,velocity),b=simulate(144,velocity);
    assert.equal(a.angle,b.angle); assert.equal(a.settled,1); assert.equal(a.velocity,0);
  }
});
test('动画中再次拖动立即接管，减少动态效果直接落定',()=>{
  const model=createMotion(0); springMotion(model,135); advanceMotion(model,.1);
  const current=model.angle; dragMotion(model,current); advanceMotion(model,.1);
  assert.equal(model.angle,current); assert.equal(model.phase,'drag');
  dragMotion(model,43.7); assert.equal(model.angle,43.7);
  releaseMotion(model,0,true); assert.equal(model.angle,45); assert.equal(model.phase,'idle');
});
test('季相首尾闭合，雨水、惊蛰、小雪分别含雨、雷、雪',()=>{
  assert.deepEqual(seasonAt(0),seasonAt(360)); assert.deepEqual(seasonAt(-15),seasonAt(345));
  assert.ok(seasonAt(15).rain>0); assert.ok(seasonAt(30).thunder>0); assert.ok(seasonAt(285).snow>0);
  for(let angle=-360;angle<720;angle++)for(const key of ['rain','snow','fog','leaf','thunder'])assert.ok(seasonAt(angle)[key]>=0&&seasonAt(angle)[key]<=1);
});
test('72候ID完整且10候有动画，候名均保留草稿状态',()=>{
  const hou=TERMS.flatMap(item=>item.hou); assert.equal(hou.length,72); assert.equal(new Set(hou.map(item=>item.id)).size,72);
  assert.equal(Object.keys(ANIMATED_HOU).length,10); assert.ok(hou.every(item=>item.isDraft));
  assert.ok(Object.keys(ANIMATED_HOU).every(id=>hou.some(item=>item.id===id)));
});
test('农谚和农事双向关联完整且所有占位数据明确标识',()=>{
  for(const item of [...FARM_TASKS,...PROVERBS]){assert.ok(item.isPlaceholder);assert.ok(item.text.startsWith('【示例】'));assert.equal(item.source,'待核对');}
  for(const proverb of PROVERBS){
    const relation=relationsFor('proverb',proverb.id);assert.ok(relation.taskIds.length>0);
    for(const id of relation.taskIds){assert.ok(FARM_TASKS.some(item=>item.id===id));assert.ok(relationsFor('task',id).proverbIds.includes(proverb.id));}
    assert.ok(proverb.termIds.every(id=>TERMS.some(term=>term.id===id)));
  }
});
