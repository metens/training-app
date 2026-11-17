import test from 'node:test';
import assert from 'node:assert/strict';
import {planFromWorkout} from '../src/plan-format.mjs';
test('an app workout becomes a website-compatible plan without losing its prescription',()=>{
  const original={name:'Strength',exercises:[{name:'Squat',sets:3,reps:8,weight:95,rest:90,notes:'Slow descent'}]};
  const plan=planFromWorkout(original,'2026-11-17');
  assert.deepEqual(plan.days,[{name:'Day 1',exercises:[{name:'Squat',sets:'3',reps:'8',load:'95 lb',rest:'90',notes:'Slow descent'}]}]);
  assert.equal(plan.startDate,'2026-11-17');assert.equal(original.exercises[0].sets,3);
});
test('plans preserve nonnumeric prescriptions and bodyweight loads',()=>{
  const plan=planFromWorkout({name:'Core',exercises:[{name:'Plank',sets:'3',reps:'30 sec',load:'Bodyweight'}]},'2026-11-17');
  assert.equal(plan.days[0].exercises[0].reps,'30 sec');assert.equal(plan.days[0].exercises[0].load,'Bodyweight');
});
test('empty workouts cannot be sent',()=>{assert.throws(()=>planFromWorkout({name:'Empty',exercises:[]},''));});
