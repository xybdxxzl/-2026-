import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMS } from '../src/data/terms.js';
import { solarModel, yearCurve } from '../src/lib/astronomy.js';
import { WHEEL, shadowRadius, shadowRingSamples, houLetterLayout, radialLabelAngle, polarPoint, termRingLayout, houRingLayout, nearestTermIndex, seasonRingLayout } from '../src/core/wheelGeometry.js';
import { normalize, termIndex, houIndex } from '../src/core/angle.js';
import { SEASON_PALETTE, SEASON_ANCHORS } from '../src/data/seasonPalette.js';
import { year } from '../src/state/year.js';

test('日影环72条射线与全年曲线使用同一影长，24个节气为主射线',()=>{
  const ring=shadowRingSamples(),curve=yearCurve();
  assert.equal(ring.length,72);assert.equal(ring.filter(sample=>sample.major).length,24);
  for(const sample of ring){
    assert.equal(sample.shadowChi,solarModel(sample.longitude).shadowChi);
    assert.equal(sample.shadowChi,curve[sample.angle].shadowChi);
    assert.ok(sample.radius>=WHEEL.shadowInner&&sample.radius<=WHEEL.shadowOuter);
  }
  assert.equal(ring.reduce((a,b)=>a.shadowChi<b.shadowChi?a:b).angle,135);
  assert.equal(ring.reduce((a,b)=>a.shadowChi>b.shadowChi?a:b).angle,315);
});
test('日影比例固定且从零起算，不能随当前季节重缩放',()=>{
  assert.equal(shadowRadius(0),WHEEL.shadowInner);assert.equal(shadowRadius(16),WHEEL.shadowOuter);
  assert.equal(shadowRadius(8)-shadowRadius(4),shadowRadius(4)-shadowRadius(0));
  assert.ok(WHEEL.shadowOuter<WHEEL.houInner);
});
test('所有候名完整放入径向文字带，8字长候名不截断',()=>{
  const hou=TERMS.flatMap(term=>term.hou);assert.equal(hou.length,72);
  const max=Math.max(...hou.map(item=>Array.from(item.name).length));assert.equal(max,8);
  for(const item of hou){const layout=houLetterLayout(item.name);assert.equal(layout.letters.map(letter=>letter.letter).join(''),item.name);assert.ok(layout.extent<=WHEEL.houOuter-WHEEL.houInner);}
});
test('转动后的下半圈候名翻正，翻转不改变文字带中点',()=>{
  for(let angle=0;angle<360;angle+=5)for(const rotation of [0,-45,-135,-315,735]){
    const screen=normalize(radialLabelAngle(angle,rotation)+rotation);
    assert.ok(screen<=90||screen>=270);
    const p=polarPoint(WHEEL.houLabel,angle);
    assert.ok(Math.abs(Math.hypot(p.x-WHEEL.center,p.y-WHEEL.center)-WHEEL.houLabel)<1e-8);
  }
});
test('四季弧与氛围共用四种不同颜料色及八个淡染锚点',()=>{
  assert.deepEqual(SEASON_PALETTE.map(item=>item.name),['春','夏','秋','冬']);
  assert.equal(new Set(SEASON_PALETTE.map(item=>item.color)).size,4);
  assert.equal(SEASON_ANCHORS.length,8);assert.ok(SEASON_ANCHORS.every(anchor=>anchor.length===2));
});
test('24节气文字、扇区中心与吸附角重合，边界在相邻文字正中',()=>{
  for(const term of TERMS){
    const sector=termRingLayout(term.index),theta=term.index*15;
    assert.equal((sector.start+sector.end)/2,theta);
    assert.equal(theta-sector.start,7.5);assert.equal(sector.end-theta,7.5);
    const radians=-theta*Math.PI/180,dx=sector.label.x-WHEEL.center,dy=sector.label.y-WHEEL.center;
    assert.ok(Math.abs(dx*Math.cos(radians)-dy*Math.sin(radians))<1e-8);
    for(const shift of [-720,0,1080])assert.equal(nearestTermIndex(theta+shift),term.index);
  }
  assert.equal(nearestTermIndex(7.49),0);assert.equal(nearestTermIndex(7.51),1);
  assert.equal(nearestTermIndex(359),0);assert.equal(nearestTermIndex(-15),23);
});
test('每节气三候在中心两侧-5、0、5度，各5度区间恰好铺满15度',()=>{
  for(const term of TERMS){
    const sector=termRingLayout(term.index),nodes=term.hou.map(hou=>houRingLayout(term.index,hou.order,hou.name));
    assert.deepEqual(nodes.map(node=>node.angle-sector.angle),[-5,0,5]);
    assert.equal(nodes[0].start,sector.start);assert.equal(nodes[2].end,sector.end);
    assert.equal(nodes[0].end,nodes[1].start);assert.equal(nodes[1].end,nodes[2].start);
  }
});
test('四季色带边界与六个节气外侧边界一致，霜降和立冬之间切换',()=>{
  for(let i=0;i<4;i++){
    const season=seasonRingLayout(i);
    assert.equal(season.start,termRingLayout(i*6).start);
    assert.equal(season.end,termRingLayout(i*6+5).end);
  }
  assert.equal(seasonRingLayout(2).end,termRingLayout(17).end);
  assert.equal(seasonRingLayout(3).start,termRingLayout(18).start);
});
test('切换三候只选择内容，主盘始终对准所属节气中心',()=>{
  for(const term of TERMS)for(const hou of term.hou){
    year.beginDrag('dial');year.dragTo(term.index*15);
    year.selectHou(term.id,hou.order);
    assert.equal(year.state.target,term.index*15);
    assert.equal(year.term.value.id,term.id);assert.equal(year.hou.value.id,hou.id);
  }
  year.beginDrag('dial');year.dragTo(8);assert.equal(year.term.value.id,'yushui');
  year.stop();
});