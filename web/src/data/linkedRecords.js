// 仅演示关系，不把待核对的占位文案伪装为史料。
export const DEMO_TERMS = ['jingzhe','mangzhong','xiazhi','xiaoxue'];
export const FARM_TASKS = DEMO_TERMS.flatMap(termId => ['north','south'].flatMap(region => [1,2].map(order => ({
  id:`${termId}-${region}-${order}`, termId, termIds:[termId], region, order,
  text:`【示例】${region==='north'?'北方':'南方'}农事${order===1?'一':'二'}：具体作物、操作与地域待录入`,
  source:'待核对', isPlaceholder:true,
}))));
export const PROVERBS = DEMO_TERMS.flatMap(termId => ['north','south'].map(region => ({
  id:`proverb-${termId}-${region}`, region,
  termIds:termId==='jingzhe'?[termId,'mangzhong']:termId==='mangzhong'?[termId,'xiazhi']:[termId],
  taskIds:[`${termId}-${region}-1`,`${termId}-${region==='north'?'south':'north'}-2`],
  text:`【示例】${region==='north'?'北方':'南方'}农谚占位 · 点击查看关联`,
  source:'待核对', isPlaceholder:true,
})));
export function relationsFor(kind,id) {
  if(kind==='proverb') {
    const proverb=PROVERBS.find(item=>item.id===id);
    return {proverbIds:proverb?[id]:[],taskIds:proverb?.taskIds||[],termIds:proverb?.termIds||[]};
  }
  const task=FARM_TASKS.find(item=>item.id===id), proverbs=PROVERBS.filter(item=>item.taskIds.includes(id));
  return {taskIds:task?[id]:[],proverbIds:proverbs.map(item=>item.id),termIds:[...new Set([...(task?.termIds||[]),...proverbs.flatMap(item=>item.termIds)])]};
}
