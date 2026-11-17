import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverWorkout} from '../src/plan-delivery.mjs';
const document = (id, data) => ({id, exists:()=>!!data, data:()=>data});
function setup(linked = true) {
  const writes=[];
  const parameters={db:{},user:{uid:'coach'},staff:{name:'Nathan'},targetId:'client-a',plan:{name:'App workout',days:[{name:'Day 1',exercises:[{name:'Squat',sets:'3',reps:'8'}]}]},
    history:{docs:[document('old-plan',{status:'delivered',version:2})]},clientRef:'clients/client-a',planRef:'clients/client-a/workoutPlans/new'};
  const adapter={doc:(...parts)=>parts.join('/'),serverTimestamp:()=> 'server-time',
    runTransaction:async(db,work)=>work({
      get:async ref=>ref===parameters.clientRef ? document('client-a',linked?{authUid:'client-user',name:'Client',lastPlanId:'latest'}:{name:'Client'}) : document('latest',{version:3,status:'delivered'}),
      set:(ref,data)=>writes.push({operation:'set',ref,data}),update:(ref,data)=>writes.push({operation:'update',ref,data})
    })};
  return {writes,parameters,adapter};
}
test('app delivery writes the same delivered workoutPlans collection read by the website',async()=>{
  const f=setup();await deliverWorkout(f.parameters,f.adapter);
  const plan=f.writes.find(w=>w.operation==='set');
  assert.equal(plan.ref,'clients/client-a/workoutPlans/new');assert.equal(plan.data.status,'delivered');
  assert.equal(plan.data.clientId,'client-a');assert.equal(plan.data.version,4);
  assert.deepEqual(plan.data.days,f.parameters.plan.days);
  assert.equal(f.writes.filter(w=>w.data.archived===true).length,2);
  assert.equal(f.writes.at(-1).ref,'clients/client-a');
});
test('delivery refuses clients without linked website accounts and writes nothing',async()=>{
  const f=setup(false);await assert.rejects(deliverWorkout(f.parameters,f.adapter),/website access/);assert.equal(f.writes.length,0);
});
