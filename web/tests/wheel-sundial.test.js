import test from 'node:test';
import assert from 'node:assert/strict';
import { WHEEL } from '../src/core/wheelGeometry.js';
import { WHEEL_DIAL, projectDial, wheelSundial } from '../src/core/wheelSundial.js';
import { sundialModel, solarModel, DEMO_MODEL } from '../src/lib/astronomy.js';

test('全年圆心日晷使用同一午正模型，影端始终落在晷面内',()=>{
  for(let longitude=0;longitude<360;longitude++){
    const dial=wheelSundial(longitude), model=sundialModel(longitude,12);
    assert.deepEqual(dial.model,model);
    assert.ok(model.shadowDistance<WHEEL_DIAL.radius);
    assert.ok(dial.shadow.y>dial.foot.y,'影端在晷针底足外侧可见');
    assert.ok(Math.abs((dial.shadow.y-dial.foot.y)/(WHEEL_DIAL.scale*.5)-solarModel(longitude).shadowChi/DEMO_MODEL.heightChi)<1e-10);
  }
});

test('节气变化只移动影端，晷面与晷针保持固定朝向和比例',()=>{
  const summer=wheelSundial(90),winter=wheelSundial(270);
  for(const part of ['origin','foot','tip'])assert.deepEqual(summer[part],winter[part]);
  assert.ok(winter.shadow.y>summer.shadow.y);
  assert.deepEqual(wheelSundial(0),wheelSundial(360));
});

test('立体晷面及其厚度完整放在圆心内，不侵入候名环带',()=>{
  for(let angle=0;angle<360;angle++){
    const rad=angle*Math.PI/180,p=projectDial(WHEEL_DIAL.radius*Math.sin(rad),WHEEL_DIAL.radius*Math.cos(rad));
    for(const depth of [0,12])assert.ok(Math.hypot(p.x-WHEEL.center,p.y+depth-WHEEL.center)<WHEEL.centerRadius-10);
  }
  assert.ok(WHEEL.centerRadius<WHEEL.houInner);
});
