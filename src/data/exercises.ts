export type Muscle =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms'
  | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core' | 'Full Body' | 'Cardio'

export type Equipment =
  | 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Kettlebell'
  | 'Band' | 'Smith' | 'EZ Bar' | 'Trap Bar' | 'Other'

export type ExerciseKind = 'weight' | 'bodyweight' | 'time'

export interface Exercise {
  id: string
  name: string
  muscle: Muscle
  equipment: Equipment
  kind: ExerciseKind
}

// [name, equipment, kind?]
type Row = [string, Equipment, ExerciseKind?]

const LIB: Record<Muscle, Row[]> = {
  Chest: [
    ['Bench Press', 'Barbell'], ['Incline Bench Press', 'Barbell'], ['Decline Bench Press', 'Barbell'],
    ['Close-Grip Bench Press', 'Barbell'], ['Paused Bench Press', 'Barbell'], ['Floor Press', 'Barbell'],
    ['Dumbbell Bench Press', 'Dumbbell'], ['Incline Dumbbell Press', 'Dumbbell'], ['Decline Dumbbell Press', 'Dumbbell'],
    ['Dumbbell Fly', 'Dumbbell'], ['Incline Dumbbell Fly', 'Dumbbell'], ['Dumbbell Pullover', 'Dumbbell'],
    ['Squeeze Press', 'Dumbbell'], ['Chest Press', 'Machine'], ['Incline Chest Press', 'Machine'],
    ['Pec Deck', 'Machine'], ['Smith Machine Bench Press', 'Smith'], ['Smith Machine Incline Press', 'Smith'],
    ['Cable Fly', 'Cable'], ['Low-to-High Cable Fly', 'Cable'], ['High-to-Low Cable Fly', 'Cable'],
    ['Single-Arm Cable Press', 'Cable'], ['Push-Up', 'Bodyweight', 'bodyweight'], ['Incline Push-Up', 'Bodyweight', 'bodyweight'],
    ['Decline Push-Up', 'Bodyweight', 'bodyweight'], ['Diamond Push-Up', 'Bodyweight', 'bodyweight'],
    ['Chest Dip', 'Bodyweight', 'bodyweight'], ['Weighted Dip', 'Other'], ['Band Push-Up', 'Band', 'bodyweight'],
    ['Svend Press', 'Other'], ['Landmine Press', 'Barbell'],
  ],
  Back: [
    ['Deadlift', 'Barbell'], ['Barbell Row', 'Barbell'], ['Pendlay Row', 'Barbell'], ['Yates Row', 'Barbell'],
    ['T-Bar Row', 'Barbell'], ['Rack Pull', 'Barbell'], ['Seal Row', 'Barbell'], ['Meadows Row', 'Barbell'],
    ['Dumbbell Row', 'Dumbbell'], ['Chest-Supported Dumbbell Row', 'Dumbbell'], ['Kroc Row', 'Dumbbell'],
    ['Renegade Row', 'Dumbbell'], ['Pull-Up', 'Bodyweight', 'bodyweight'], ['Chin-Up', 'Bodyweight', 'bodyweight'],
    ['Neutral-Grip Pull-Up', 'Bodyweight', 'bodyweight'], ['Weighted Pull-Up', 'Other'], ['Weighted Chin-Up', 'Other'],
    ['Inverted Row', 'Bodyweight', 'bodyweight'], ['Assisted Pull-Up', 'Machine'], ['Lat Pulldown', 'Cable'],
    ['Close-Grip Lat Pulldown', 'Cable'], ['Single-Arm Lat Pulldown', 'Cable'], ['Straight-Arm Pulldown', 'Cable'],
    ['Seated Cable Row', 'Cable'], ['Wide-Grip Cable Row', 'Cable'], ['Single-Arm Cable Row', 'Cable'],
    ['Machine Row', 'Machine'], ['Chest-Supported T-Bar Row', 'Machine'], ['Iso-Lateral Row', 'Machine'],
    ['Machine Lat Pulldown', 'Machine'], ['Back Extension', 'Bodyweight', 'bodyweight'], ['Good Morning', 'Barbell'],
    ['Smith Machine Row', 'Smith'], ['Band Pull-Apart', 'Band'], ['Kettlebell Row', 'Kettlebell'],
    ['Trap Bar Deadlift', 'Trap Bar'], ['Snatch-Grip Deadlift', 'Barbell'], ['Deficit Deadlift', 'Barbell'],
    ['Barbell Shrug', 'Barbell'], ['Dumbbell Shrug', 'Dumbbell'], ['Trap Bar Shrug', 'Trap Bar'], ['Cable Shrug', 'Cable'],
  ],
  Shoulders: [
    ['Overhead Press', 'Barbell'], ['Push Press', 'Barbell'], ['Seated Barbell Press', 'Barbell'],
    ['Behind-the-Neck Press', 'Barbell'], ['Z Press', 'Barbell'], ['Dumbbell Shoulder Press', 'Dumbbell'],
    ['Seated Dumbbell Press', 'Dumbbell'], ['Arnold Press', 'Dumbbell'], ['Lateral Raise', 'Dumbbell'],
    ['Seated Lateral Raise', 'Dumbbell'], ['Lean-Away Lateral Raise', 'Dumbbell'], ['Front Raise', 'Dumbbell'],
    ['Rear Delt Fly', 'Dumbbell'], ['Chest-Supported Rear Delt Raise', 'Dumbbell'], ['Upright Row', 'Barbell'],
    ['Dumbbell Upright Row', 'Dumbbell'], ['Cable Lateral Raise', 'Cable'], ['Cable Front Raise', 'Cable'],
    ['Cable Rear Delt Fly', 'Cable'], ['Face Pull', 'Cable'], ['Cable Y-Raise', 'Cable'],
    ['Shoulder Press', 'Machine'], ['Lateral Raise Machine', 'Machine'], ['Reverse Pec Deck', 'Machine'],
    ['Smith Machine Shoulder Press', 'Smith'], ['Landmine Shoulder Press', 'Barbell'],
    ['Kettlebell Press', 'Kettlebell'], ['Band Face Pull', 'Band'], ['Band Lateral Raise', 'Band'],
    ['Pike Push-Up', 'Bodyweight', 'bodyweight'], ['Handstand Push-Up', 'Bodyweight', 'bodyweight'],
    ['Plate Front Raise', 'Other'], ['Cuban Press', 'Dumbbell'],
  ],
  Biceps: [
    ['Barbell Curl', 'Barbell'], ['EZ Bar Curl', 'EZ Bar'], ['Preacher Curl', 'EZ Bar'], ['Drag Curl', 'Barbell'],
    ['Reverse Curl', 'EZ Bar'], ['Dumbbell Curl', 'Dumbbell'], ['Hammer Curl', 'Dumbbell'],
    ['Incline Dumbbell Curl', 'Dumbbell'], ['Concentration Curl', 'Dumbbell'], ['Spider Curl', 'Dumbbell'],
    ['Zottman Curl', 'Dumbbell'], ['Cross-Body Hammer Curl', 'Dumbbell'], ['Dumbbell Preacher Curl', 'Dumbbell'],
    ['Cable Curl', 'Cable'], ['Rope Hammer Curl', 'Cable'], ['Bayesian Cable Curl', 'Cable'],
    ['High Cable Curl', 'Cable'], ['Machine Preacher Curl', 'Machine'], ['Bicep Curl Machine', 'Machine'],
    ['Band Curl', 'Band'], ['Kettlebell Curl', 'Kettlebell'],
  ],
  Triceps: [
    ['Skull Crusher', 'EZ Bar'], ['JM Press', 'Barbell'], ['Overhead Triceps Extension', 'Dumbbell'],
    ['Dumbbell Skull Crusher', 'Dumbbell'], ['Triceps Kickback', 'Dumbbell'], ['Tate Press', 'Dumbbell'],
    ['Triceps Pushdown', 'Cable'], ['Rope Pushdown', 'Cable'], ['Reverse-Grip Pushdown', 'Cable'],
    ['Single-Arm Pushdown', 'Cable'], ['Overhead Cable Extension', 'Cable'], ['Cable Kickback', 'Cable'],
    ['Triceps Dip', 'Bodyweight', 'bodyweight'], ['Bench Dip', 'Bodyweight', 'bodyweight'],
    ['Triceps Extension Machine', 'Machine'], ['Dip Machine', 'Machine'], ['Band Pushdown', 'Band'],
    ['Smith Machine Close-Grip Press', 'Smith'],
  ],
  Forearms: [
    ['Wrist Curl', 'Barbell'], ['Reverse Wrist Curl', 'Barbell'], ['Dumbbell Wrist Curl', 'Dumbbell'],
    ["Farmer's Carry", 'Dumbbell', 'time'], ['Dead Hang', 'Bodyweight', 'time'], ['Plate Pinch', 'Other', 'time'],
    ['Wrist Roller', 'Other'], ['Cable Wrist Curl', 'Cable'],
  ],
  Quads: [
    ['Back Squat', 'Barbell'], ['Front Squat', 'Barbell'], ['Pause Squat', 'Barbell'], ['Box Squat', 'Barbell'],
    ['Zercher Squat', 'Barbell'], ['Overhead Squat', 'Barbell'], ['Barbell Lunge', 'Barbell'],
    ['Barbell Split Squat', 'Barbell'], ['Goblet Squat', 'Dumbbell'], ['Dumbbell Lunge', 'Dumbbell'],
    ['Walking Lunge', 'Dumbbell'], ['Reverse Lunge', 'Dumbbell'], ['Bulgarian Split Squat', 'Dumbbell'],
    ['Dumbbell Step-Up', 'Dumbbell'], ['Leg Press', 'Machine'], ['Single-Leg Leg Press', 'Machine'],
    ['Hack Squat', 'Machine'], ['Pendulum Squat', 'Machine'], ['Belt Squat', 'Machine'],
    ['Leg Extension', 'Machine'], ['Single-Leg Extension', 'Machine'], ['V-Squat', 'Machine'],
    ['Smith Machine Squat', 'Smith'], ['Smith Machine Split Squat', 'Smith'], ['Sissy Squat', 'Bodyweight', 'bodyweight'],
    ['Bodyweight Squat', 'Bodyweight', 'bodyweight'], ['Pistol Squat', 'Bodyweight', 'bodyweight'],
    ['Jump Squat', 'Bodyweight', 'bodyweight'], ['Wall Sit', 'Bodyweight', 'time'], ['Kettlebell Goblet Squat', 'Kettlebell'],
    ['Trap Bar Squat', 'Trap Bar'], ['Cyclist Squat', 'Barbell'],
  ],
  Hamstrings: [
    ['Romanian Deadlift', 'Barbell'], ['Stiff-Leg Deadlift', 'Barbell'], ['Dumbbell Romanian Deadlift', 'Dumbbell'],
    ['Single-Leg Romanian Deadlift', 'Dumbbell'], ['Lying Leg Curl', 'Machine'], ['Seated Leg Curl', 'Machine'],
    ['Standing Leg Curl', 'Machine'], ['Nordic Hamstring Curl', 'Bodyweight', 'bodyweight'],
    ['Glute-Ham Raise', 'Bodyweight', 'bodyweight'], ['Cable Pull-Through', 'Cable'], ['Kettlebell Swing', 'Kettlebell'],
    ['Stability Ball Leg Curl', 'Other', 'bodyweight'], ['Smith Machine Romanian Deadlift', 'Smith'],
    ['Sliding Leg Curl', 'Bodyweight', 'bodyweight'], ['Band Leg Curl', 'Band'],
  ],
  Glutes: [
    ['Hip Thrust', 'Barbell'], ['Glute Bridge', 'Barbell'], ['Single-Leg Hip Thrust', 'Bodyweight', 'bodyweight'],
    ['Dumbbell Hip Thrust', 'Dumbbell'], ['Hip Thrust Machine', 'Machine'], ['Hip Abduction', 'Machine'],
    ['Hip Adduction', 'Machine'], ['Glute Kickback Machine', 'Machine'], ['Cable Kickback', 'Cable'],
    ['Cable Hip Abduction', 'Cable'], ['Sumo Deadlift', 'Barbell'], ['Sumo Squat', 'Dumbbell'],
    ['Curtsy Lunge', 'Dumbbell'], ['Frog Pump', 'Bodyweight', 'bodyweight'], ['Band Lateral Walk', 'Band'],
    ['Band Clamshell', 'Band'], ['Smith Machine Hip Thrust', 'Smith'], ['Reverse Hyperextension', 'Machine'],
    ['Kettlebell Sumo Deadlift', 'Kettlebell'], ['Step-Up', 'Bodyweight', 'bodyweight'],
  ],
  Calves: [
    ['Standing Calf Raise', 'Machine'], ['Seated Calf Raise', 'Machine'], ['Leg Press Calf Raise', 'Machine'],
    ['Smith Machine Calf Raise', 'Smith'], ['Dumbbell Calf Raise', 'Dumbbell'], ['Single-Leg Calf Raise', 'Bodyweight', 'bodyweight'],
    ['Donkey Calf Raise', 'Machine'], ['Barbell Calf Raise', 'Barbell'], ['Tibialis Raise', 'Bodyweight', 'bodyweight'],
  ],
  Core: [
    ['Plank', 'Bodyweight', 'time'], ['Side Plank', 'Bodyweight', 'time'], ['Crunch', 'Bodyweight', 'bodyweight'],
    ['Bicycle Crunch', 'Bodyweight', 'bodyweight'], ['Reverse Crunch', 'Bodyweight', 'bodyweight'],
    ['Sit-Up', 'Bodyweight', 'bodyweight'], ['Decline Sit-Up', 'Bodyweight', 'bodyweight'],
    ['Hanging Leg Raise', 'Bodyweight', 'bodyweight'], ['Hanging Knee Raise', 'Bodyweight', 'bodyweight'],
    ['Toes-to-Bar', 'Bodyweight', 'bodyweight'], ['Lying Leg Raise', 'Bodyweight', 'bodyweight'],
    ['Captain\'s Chair Leg Raise', 'Machine', 'bodyweight'], ['Ab Wheel Rollout', 'Other', 'bodyweight'],
    ['Cable Crunch', 'Cable'], ['Pallof Press', 'Cable'], ['Cable Woodchopper', 'Cable'],
    ['Russian Twist', 'Other'], ['Dead Bug', 'Bodyweight', 'bodyweight'], ['Bird Dog', 'Bodyweight', 'bodyweight'],
    ['Hollow Body Hold', 'Bodyweight', 'time'], ['L-Sit', 'Bodyweight', 'time'], ['Mountain Climber', 'Bodyweight', 'bodyweight'],
    ['Ab Crunch Machine', 'Machine'], ['Weighted Plank', 'Other', 'time'], ['Dragon Flag', 'Bodyweight', 'bodyweight'],
    ['V-Up', 'Bodyweight', 'bodyweight'], ['Suitcase Carry', 'Dumbbell', 'time'], ['Landmine Rotation', 'Barbell'],
  ],
  'Full Body': [
    ['Power Clean', 'Barbell'], ['Hang Clean', 'Barbell'], ['Clean and Jerk', 'Barbell'], ['Snatch', 'Barbell'],
    ['Hang Snatch', 'Barbell'], ['Thruster', 'Barbell'], ['Dumbbell Thruster', 'Dumbbell'],
    ['Dumbbell Snatch', 'Dumbbell'], ['Kettlebell Clean', 'Kettlebell'], ['Kettlebell Snatch', 'Kettlebell'],
    ['Turkish Get-Up', 'Kettlebell'], ['Burpee', 'Bodyweight', 'bodyweight'], ['Man Maker', 'Dumbbell'],
    ['Sled Push', 'Other', 'time'], ['Sled Pull', 'Other', 'time'], ['Battle Ropes', 'Other', 'time'],
    ['Wall Ball', 'Other'], ['Box Jump', 'Bodyweight', 'bodyweight'], ['Bear Crawl', 'Bodyweight', 'time'],
  ],
  Cardio: [
    ['Running', 'Other', 'time'], ['Treadmill', 'Machine', 'time'], ['Incline Walk', 'Machine', 'time'],
    ['Cycling', 'Machine', 'time'], ['Assault Bike', 'Machine', 'time'], ['Rowing Machine', 'Machine', 'time'],
    ['Elliptical', 'Machine', 'time'], ['Stair Climber', 'Machine', 'time'], ['SkiErg', 'Machine', 'time'],
    ['Jump Rope', 'Other', 'time'], ['Swimming', 'Other', 'time'], ['Jumping Jacks', 'Bodyweight', 'bodyweight'],
  ],
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const EXERCISES: Exercise[] = (Object.keys(LIB) as Muscle[]).flatMap((muscle) =>
  LIB[muscle].map(([name, equipment, kind]) => ({
    id: slug(`${muscle}-${name}`),
    name,
    muscle,
    equipment,
    kind: kind ?? 'weight',
  })),
)

export const MUSCLES = Object.keys(LIB) as Muscle[]

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))
