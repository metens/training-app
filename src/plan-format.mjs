export function planFromWorkout(workout, startDate) {
  if (!workout?.name?.trim() || !Array.isArray(workout.exercises) || !workout.exercises.length) {
    throw new Error('Choose a saved workout with at least one exercise.');
  }
  return {
    name: workout.name.trim(), goal: '', startDate, endDate: '', coachNotes: '',
    days: [{name: 'Day 1', exercises: workout.exercises.map(exercise => ({
      name: String(exercise.name || '').trim(), sets: String(exercise.sets ?? ''),
      reps: String(exercise.reps ?? ''), load: exercise.load ?? `${exercise.weight ?? 0} lb`,
      rest: String(exercise.rest ?? ''), notes: String(exercise.notes ?? '')
    }))}]
  };
}
