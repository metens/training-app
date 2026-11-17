import "./exercise-motion.js";

function conditioningLoad(exercise) {
  const {name, unit, amount, reps} = exercise;
  if (name === 'Jump Rope') {
    if (unit === 'seconds' && amount > 0) return `${amount} sec`;
    const jumps = unit === 'jumps' ? amount : reps;
    return jumps > 0 ? `${jumps} ${Number(jumps) === 1 ? 'jump' : 'jumps'}` : '';
  }
  if (name === 'Running Intervals') {
    const units = {miles: 'mi', meters: 'm', seconds: 'sec'};
    return Object.hasOwn(units, unit) && amount > 0 ? `${amount} ${units[unit]}` : '';
  }
  if (globalThis.PPExerciseMotion.find(name)?.measurement === 'time') {
    return unit === 'seconds' && amount > 0 ? `${amount} sec` : (exercise.load ?? '');
  }
  return null;
}

export function planFromWorkout(workout, startDate) {
  if (!workout?.name?.trim() || !Array.isArray(workout.exercises) || !workout.exercises.length) {
    throw new Error('Choose a saved workout with at least one exercise.');
  }
  return {
    name: workout.name.trim(), goal: '', startDate, endDate: '', coachNotes: '',
    days: [{name: 'Day 1', exercises: workout.exercises.map(exercise => {
      const measurement = conditioningLoad(exercise);
      return {
        name: String(exercise.name || '').trim(), sets: String(exercise.sets ?? ''),
        reps: measurement === null ? String(exercise.reps ?? '') : '',
        load: measurement ?? exercise.load ?? `${exercise.weight ?? 0} lb`,
        rest: String(exercise.rest ?? ''), notes: String(exercise.notes ?? '')
      };
    })}]
  };
}
