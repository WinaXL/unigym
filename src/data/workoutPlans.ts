export interface WorkoutExercise {
  id: string;
  sets?: number;
  reps?: string;
  minutes?: number;
}

export interface WorkoutDay {
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  id: string;
  days: WorkoutDay[];
}

const lift = (id: string, sets = 3, reps = '8–12'): WorkoutExercise => ({ id, sets, reps });
const cardio = (id: string, minutes: number): WorkoutExercise => ({ id, minutes });
const warmup = cardio('warmup', 5);
const cooldown = cardio('cooldown', 5);

export const WORKOUT_PLANS: WorkoutPlan[] = [
  {
    id: 'fatLoss',
    days: [
      { focus: 'fullBodyCardio', exercises: [warmup, lift('gobletSquat'), lift('chestPress'), lift('seatedRow'), cardio('inclineWalk', 20), cooldown] },
      { focus: 'legsCore', exercises: [warmup, lift('legPress'), lift('romanianDeadlift'), lift('stepUp', 3, '10 / side'), lift('deadBug', 3, '10 / side'), cardio('bike', 20), cooldown] },
      { focus: 'circuit', exercises: [warmup, lift('bodyweightSquat', 3, '12–15'), lift('inclinePushup', 3, '8–12'), lift('latPulldown'), lift('plank', 3, '30 s'), cardio('elliptical', 20), cooldown] },
    ],
  },
  {
    id: 'cardio',
    days: [
      { focus: 'steadyState', exercises: [warmup, cardio('briskWalk', 25), cardio('bike', 10), cooldown] },
      { focus: 'intervals', exercises: [warmup, cardio('bikeIntervals', 20), cardio('easyWalk', 10), cooldown] },
      { focus: 'endurance', exercises: [warmup, cardio('elliptical', 25), cardio('briskWalk', 15), cooldown] },
    ],
  },
  {
    id: 'bodySplit',
    days: [
      { focus: 'upperPush', exercises: [warmup, lift('chestPress'), lift('shoulderPress'), lift('inclineDumbbellPress'), lift('lateralRaise', 3, '12–15'), lift('tricepsPushdown', 3, '10–15'), cooldown] },
      { focus: 'lowerQuads', exercises: [warmup, lift('gobletSquat', 4), lift('legPress'), lift('legExtension', 3, '12–15'), lift('calfRaise', 3, '12–15'), lift('plank', 3, '30 s'), cooldown] },
      { focus: 'upperPull', exercises: [warmup, lift('latPulldown'), lift('seatedRow'), lift('facePull', 3, '12–15'), lift('bicepsCurl', 3, '10–15'), lift('hammerCurl', 3, '10–15'), cooldown] },
      { focus: 'lowerPosterior', exercises: [warmup, lift('romanianDeadlift'), lift('hipThrust'), lift('legCurl', 3, '10–15'), lift('stepUp', 3, '10 / side'), lift('deadBug', 3, '10 / side'), cooldown] },
    ],
  },
  {
    id: 'fullBody',
    days: [
      { focus: 'fullBodyA', exercises: [warmup, lift('gobletSquat'), lift('chestPress'), lift('seatedRow'), lift('plank', 3, '30 s'), cooldown] },
      { focus: 'fullBodyB', exercises: [warmup, lift('romanianDeadlift'), lift('shoulderPress'), lift('latPulldown'), lift('stepUp', 3, '10 / side'), cooldown] },
      { focus: 'fullBodyC', exercises: [warmup, lift('legPress'), lift('inclineDumbbellPress'), lift('seatedRow'), lift('hipThrust'), lift('deadBug', 3, '10 / side'), cooldown] },
    ],
  },
];

export function getWorkoutPlan(id: string): WorkoutPlan | undefined {
  return WORKOUT_PLANS.find((plan) => plan.id === id);
}
