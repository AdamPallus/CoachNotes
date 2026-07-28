#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SEED_KEY = 'coach-home-mission-control-demo';
const DEMO_NAME_PREFIX = 'demo-mission-control:';
const DEMO_DISPLAY_PREFIX = '[Demo MC] ';
const DEMO_MODEL = 'local-demo-seed.v1';
const CLIENT_COUNT = 22;
const SQLITE_BIN = process.env.SQLITE3_BIN || 'sqlite3';
const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'CoachNotes Dev',
  'coachnotes',
  'coachnotes.sqlite'
);

const REQUIRED_SCHEMA = {
  clients: ['id', 'name', 'display_name', 'archived', 'archived_at'],
  intake_sources: [
    'id',
    'client_id',
    'title',
    'source_type',
    'source_date',
    'annotation',
    'original_path',
    'vault_path',
    'raw_text',
    'created_at',
    'metadata_json'
  ],
  client_baselines: [
    'id',
    'client_id',
    'status',
    'structured_json',
    'source_ids_json',
    'model',
    'raw_output',
    'created_at',
    'accepted_at',
    'updated_at'
  ],
  client_section_undo: [
    'id',
    'baseline_id',
    'section_key',
    'previous_value_json',
    'current_value_json',
    'reason',
    'created_at'
  ],
  settings: ['key', 'value']
};

const CLIENT_SPECS = [
  {
    name: 'Ava Brooks',
    pronouns: 'she/her',
    location: 'Bend, OR',
    role: 'Elementary school principal',
    family: 'Partner, two teens, weekend hiking group',
    curriculumType: 'Menopause',
    programType: 'Fat Loss 4x',
    cohort: 'July',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Body Recomposition',
    contraindications: ['Perimenopause', 'Osteopenia'],
    equipment: 'Full gym plus adjustable dumbbells at home',
    motivation: 'Feel strong on long hikes and reduce the all-or-nothing cycle',
    barrier: 'Late meetings and inconsistent dinner prep',
    nutrition: 'Under-eats protein at breakfast and tends to snack during evening grading',
    mindset: 'Confidence is high when the week is planned, lower after travel',
    exercise: 'Strong lower-body base, cautious with loaded spinal flexion',
    communication: 'Prefers concise Sunday planning notes and one midweek nudge',
    flag: 'Reports new hip pinch on deep squats and wants substitutions before pushing load.',
    missing: ['Confirm current calcium and vitamin D plan', 'Ask whether hip pinch occurs outside training'],
    tags: ['menopause', 'osteopenia', 'high-touch', 'protein-breakfast']
  },
  {
    name: 'Mia Sanchez',
    pronouns: 'she/her',
    location: 'Austin, TX',
    role: 'Product marketing lead',
    family: 'Lives with spouse and a senior dog',
    curriculumType: 'GGS Coaching',
    programType: 'Strength Gain',
    cohort: 'April',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Strength Gain',
    contraindications: ['Surgery'],
    equipment: 'Commercial gym near office',
    motivation: 'Build back barbell confidence after shoulder surgery',
    barrier: 'Calendar volatility and fear of aggravating shoulder',
    nutrition: 'Consistent meals, low appetite after evening workouts',
    mindset: 'Wants permission to progress slowly without feeling behind',
    exercise: 'Needs careful overhead loading and warm-up tracking',
    communication: 'Likes direct checklists with clear stop signs',
    flag: 'Shoulder fatigue spikes after overhead pressing or high-volume push work.',
    missing: ['Confirm surgeon or PT restrictions for overhead loading'],
    tags: ['post-surgery', 'strength', 'shoulder', 'gym']
  },
  {
    name: 'Priya Raman',
    pronouns: 'she/her',
    location: 'Seattle, WA',
    role: 'Data scientist',
    family: 'Partner and young twins',
    curriculumType: 'GLP-1',
    programType: 'Fat Loss 3x',
    cohort: 'January',
    programFormat: 'On Demand',
    primaryTrainingGoal: 'Fat Loss',
    contraindications: ['Sleep Disorder'],
    equipment: 'Apartment gym, treadmill, bands',
    motivation: 'Preserve muscle while medication suppresses appetite',
    barrier: 'Interrupted sleep and nausea on dose-change weeks',
    nutrition: 'Needs easy protein options and small-meal structure',
    mindset: 'Gets anxious when weight changes slowly despite behavior wins',
    exercise: 'Walks consistently, strength sessions need shorter entry ramps',
    communication: 'Appreciates empathy plus simple experiments',
    flag: 'Low appetite and sleep disruption may be reducing total intake and recovery.',
    missing: ['Ask current medication dose-change cadence', 'Clarify nausea pattern across the week'],
    tags: ['glp-1', 'sleep', 'muscle-retention', 'small-meals']
  },
  {
    name: 'Jordan Lee',
    pronouns: 'they/them',
    location: 'Chicago, IL',
    role: 'Museum educator',
    family: 'Lives with roommate, active dance community',
    curriculumType: 'GGS Coaching',
    programType: 'Pull-Up Strength Gain',
    cohort: 'July',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Strength Gain',
    contraindications: [],
    equipment: 'Home pull-up bar, bands, kettlebell',
    motivation: 'Get first strict pull-up and feel capable in classes',
    barrier: 'Grip fatigue and inconsistent weekday training window',
    nutrition: 'Generally balanced, lunch can be too small before evening training',
    mindset: 'Needs progress markers that are not only the final pull-up',
    exercise: 'Responds well to banded eccentrics and scapular work',
    communication: 'Prefers brief technical cues with video links',
    flag: '',
    missing: ['Confirm current max assisted pull-up setup'],
    tags: ['pull-up', 'home-gym', 'skill-goal']
  },
  {
    name: 'Claire Nguyen',
    pronouns: 'she/her',
    location: 'San Jose, CA',
    role: 'Nurse practitioner',
    family: 'Married, expecting first child',
    curriculumType: 'GGS Coaching',
    programType: 'Prenatal',
    cohort: 'April',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Muscle Maintenance',
    contraindications: ['Perimenopause'],
    equipment: 'Dumbbells, bench, birth ball',
    motivation: 'Maintain strength and reduce stress through pregnancy',
    barrier: 'Shift-work fatigue and changing energy levels',
    nutrition: 'Eating regularly, wants portable snacks for long shifts',
    mindset: 'Wants adaptable plans without guilt when symptoms change',
    exercise: 'Needs pelvic-floor-aware core substitutions',
    communication: 'Likes options graded by energy level',
    flag: 'Needs conservative modifications if pelvic pressure increases.',
    missing: ['Confirm trimester and provider exercise guidance', 'Ask about pelvic floor symptoms'],
    tags: ['prenatal', 'shift-work', 'modifications']
  },
  {
    name: 'Tessa Morgan',
    pronouns: 'she/her',
    location: 'Portland, ME',
    role: 'Freelance designer',
    family: 'Six months postpartum, partner travels twice monthly',
    curriculumType: 'GGS Coaching',
    programType: 'Postnatal',
    cohort: 'January',
    programFormat: 'Workout Collections',
    primaryTrainingGoal: 'Body Recomposition',
    contraindications: ['Sleep Disorder'],
    equipment: 'Bands, dumbbells to 35 lb, stroller walks',
    motivation: 'Regain a stable routine without chasing pre-baby pace',
    barrier: 'Sleep variability and unpredictable childcare',
    nutrition: 'Often skips lunch when baby naps poorly',
    mindset: 'Sensitive to language around body change',
    exercise: 'Needs progressive core work and short sessions',
    communication: 'Prefers gentle reminders and flexible minimums',
    flag: 'Reports pelvic heaviness on long walk days.',
    missing: ['Ask whether pelvic heaviness has been assessed', 'Confirm breastfeeding status for hunger context'],
    tags: ['postnatal', 'sleep', 'short-sessions']
  },
  {
    name: 'Nora Patel',
    pronouns: 'she/her',
    location: 'Madison, WI',
    role: 'University administrator',
    family: 'Lives with spouse, cares for parent on weekends',
    curriculumType: 'Menopause',
    programType: 'Longevity',
    cohort: 'April',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Bone Density',
    contraindications: ['Osteopenia'],
    equipment: 'YMCA, weighted vest, bike path access',
    motivation: 'Train for long-term independence and bone health',
    barrier: 'Caregiving weekends interrupt recovery',
    nutrition: 'Consistent meals, calcium intake unclear',
    mindset: 'Motivated by health markers more than scale',
    exercise: 'Needs balance, impact tolerance, and progressive strength',
    communication: 'Likes rationale and measurable weekly targets',
    flag: 'Osteopenia context requires thoughtful impact and loading progression.',
    missing: ['Clarify DEXA date and provider guidance', 'Confirm fall history'],
    tags: ['bone-density', 'longevity', 'caregiving']
  },
  {
    name: 'Renee Walker',
    pronouns: 'she/her',
    location: 'Atlanta, GA',
    role: 'Attorney',
    family: 'Single parent of one middle-schooler',
    curriculumType: 'GLP-1',
    programType: 'Bodyweight and Bands',
    cohort: 'July',
    programFormat: 'On Demand',
    primaryTrainingGoal: 'Fat Loss',
    contraindications: [],
    equipment: 'Bands, yoga mat, hotel gym access',
    motivation: 'Feel in control during a demanding work season',
    barrier: 'Travel, court days, and unpredictable lunches',
    nutrition: 'Protein consistency drops on travel weeks',
    mindset: 'Can become perfectionistic when routines break',
    exercise: 'Needs hotel-room strength fallback options',
    communication: 'Wants Monday planning plus travel swaps',
    flag: '',
    missing: ['Ask next three travel dates'],
    tags: ['glp-1', 'travel', 'single-parent']
  },
  {
    name: 'Hannah Reed',
    pronouns: 'she/her',
    location: 'Boise, ID',
    role: 'Veterinary tech',
    family: 'Partner, two rescue cats, recreational cyclist',
    curriculumType: 'GGS Coaching',
    programType: 'Mobility',
    cohort: 'January',
    programFormat: 'Workout Collections',
    primaryTrainingGoal: 'Longevity',
    contraindications: ['Autoimmune Condition'],
    equipment: 'Bike trainer, bands, light dumbbells',
    motivation: 'Stay active through flare cycles',
    barrier: 'Energy swings and joint stiffness',
    nutrition: 'Reliable breakfast, inconsistent hydration',
    mindset: 'Needs validation that lower-intensity weeks still count',
    exercise: 'Mobility work helps, high volume can backfire',
    communication: 'Likes color-coded low, medium, high energy options',
    flag: 'Autoimmune flare patterns affect readiness and volume tolerance.',
    missing: ['Ask flare-warning signs and preferred adjustment rules'],
    tags: ['autoimmune', 'mobility', 'energy-management']
  },
  {
    name: 'Olivia Grant',
    pronouns: 'she/her',
    location: 'Denver, CO',
    role: 'Sales director',
    family: 'Spouse, teenage soccer player, frequent work travel',
    curriculumType: 'GGS Coaching',
    programType: 'Fat Loss 4x',
    cohort: 'July',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Fat Loss',
    contraindications: [],
    equipment: 'Full gym when home, hotel gyms when traveling',
    motivation: 'Stop restarting after every business trip',
    barrier: 'Restaurant meals, flights, and late client dinners',
    nutrition: 'Needs protein-forward restaurant defaults',
    mindset: 'All-or-nothing after disrupted weeks',
    exercise: 'Strong gym confidence, inconsistent travel plan execution',
    communication: 'Prefers assertive travel-game-plan messages',
    flag: '',
    missing: ['Ask which travel meals are hardest to navigate'],
    tags: ['travel', 'fat-loss', 'restaurant-strategy']
  },
  {
    name: 'Elena Torres',
    pronouns: 'she/her',
    location: 'Phoenix, AZ',
    role: 'High school teacher',
    family: 'Lives with sister, plays recreational volleyball',
    curriculumType: 'GGS Coaching',
    programType: 'Muscle Gain',
    cohort: 'April',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Strength Gain',
    contraindications: [],
    equipment: 'Commercial gym, volleyball court',
    motivation: 'Add muscle and improve volleyball power',
    barrier: 'Low appetite in hot weather and long school days',
    nutrition: 'Needs calorie-dense snacks and post-training meals',
    mindset: 'Worries that gaining scale weight means losing progress',
    exercise: 'Responds well to clear progression targets',
    communication: 'Likes specific rep targets and meal examples',
    flag: '',
    missing: ['Confirm current maintenance calorie estimate'],
    tags: ['muscle-gain', 'volleyball', 'teacher-schedule']
  },
  {
    name: 'Brooke Ellis',
    pronouns: 'she/her',
    location: 'Raleigh, NC',
    role: 'Accountant',
    family: 'Married, training for first 10K',
    curriculumType: 'GGS Coaching',
    programType: 'Cardio',
    cohort: 'January',
    programFormat: 'On Demand',
    primaryTrainingGoal: 'Longevity',
    contraindications: [],
    equipment: 'Treadmill, dumbbells to 25 lb',
    motivation: 'Finish a 10K feeling strong and avoid shin pain',
    barrier: 'Busy season desk time and missed mobility',
    nutrition: 'Good structure, long-run fueling is new',
    mindset: 'Motivated by event countdowns',
    exercise: 'Needs gradual run volume and calf strength',
    communication: 'Likes calendar-based reminders',
    flag: 'Early shin tightness after back-to-back run days.',
    missing: ['Ask shoe age and current weekly mileage'],
    tags: ['10k', 'cardio', 'shin-tightness']
  },
  {
    name: 'Marcus King',
    pronouns: 'he/him',
    location: 'Nashville, TN',
    role: 'Music producer',
    family: 'Partner, late studio nights',
    curriculumType: 'GGS Coaching',
    programType: 'Strength Gain',
    cohort: 'July',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Strength Gain',
    contraindications: [],
    equipment: 'Garage gym with rack and dumbbells',
    motivation: 'Build strength without wrecking sleep',
    barrier: 'Late sessions and inconsistent wake time',
    nutrition: 'Dinner timing slides late, protein target usually met',
    mindset: 'Likes autonomy and dislikes micromanagement',
    exercise: 'Progressing well on hinge and squat patterns',
    communication: 'Prefers low-friction weekly priorities',
    flag: '',
    missing: ['Clarify latest average sleep duration'],
    tags: ['garage-gym', 'sleep-routine', 'strength']
  },
  {
    name: 'Devon Carter',
    pronouns: 'he/him',
    location: 'Columbus, OH',
    role: 'Firefighter',
    family: 'Co-parents two kids, shift schedule',
    curriculumType: 'GGS Coaching',
    programType: 'Dumbbells and Bands',
    cohort: 'April',
    programFormat: 'Workout Collections',
    primaryTrainingGoal: 'Muscle Maintenance',
    contraindications: ['Sleep Disorder'],
    equipment: 'Station gym, home dumbbells',
    motivation: 'Stay capable on duty and manage stress',
    barrier: '24-hour shifts, interrupted sleep, station meals',
    nutrition: 'Needs resilient protein plan for shift days',
    mindset: 'Feels successful when plan has contingencies',
    exercise: 'Needs movement prep after poor-sleep shifts',
    communication: 'Likes direct if-this-then-that guidance',
    flag: 'Sleep disruption may require lower-volume training after overnight calls.',
    missing: ['Ask shift calendar for next two weeks'],
    tags: ['shift-work', 'sleep', 'dumbbells']
  },
  {
    name: 'Samir Patel',
    pronouns: 'he/him',
    location: 'Minneapolis, MN',
    role: 'Retired engineer',
    family: 'Spouse, grandkids nearby',
    curriculumType: 'GGS Coaching',
    programType: 'Longevity',
    cohort: 'January',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Longevity',
    contraindications: ['Osteopenia'],
    equipment: 'Community center, walking paths',
    motivation: 'Keep up with grandkids and improve balance',
    barrier: 'Winter walking limitations',
    nutrition: 'Stable meals, hydration is inconsistent',
    mindset: 'Enjoys simple scorecards',
    exercise: 'Needs balance and get-up practice',
    communication: 'Likes clear form videos and repetition',
    flag: 'Balance confidence is low on icy days.',
    missing: ['Ask whether any falls occurred this year'],
    tags: ['longevity', 'balance', 'community-center']
  },
  {
    name: 'Theo James',
    pronouns: 'he/him',
    location: 'Brooklyn, NY',
    role: 'Software engineer',
    family: 'Lives alone, new to structured exercise',
    curriculumType: 'GGS Coaching',
    programType: 'Start Training',
    cohort: 'July',
    programFormat: 'On Demand',
    primaryTrainingGoal: 'Body Recomposition',
    contraindications: [],
    equipment: 'Apartment gym and bands',
    motivation: 'Create a sustainable baseline routine',
    barrier: 'Decision fatigue after work',
    nutrition: 'Takeout-heavy weeknights, open to simple templates',
    mindset: 'Needs early wins and low-friction tracking',
    exercise: 'New lifter, needs movement confidence',
    communication: 'Prefers very concrete next actions',
    flag: '',
    missing: ['Ask preferred training days'],
    tags: ['beginner', 'takeout', 'habit-building']
  },
  {
    name: 'Luis Moreno',
    pronouns: 'he/him',
    location: 'Miami, FL',
    role: 'Consultant',
    family: 'Partner, frequent international travel',
    curriculumType: 'GGS Coaching',
    programType: 'Travel',
    cohort: 'April',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Muscle Maintenance',
    contraindications: [],
    equipment: 'Hotel gyms, jump rope, bands',
    motivation: 'Maintain rhythm across time zones',
    barrier: 'Jet lag and client dinners',
    nutrition: 'Needs airport and hotel breakfast defaults',
    mindset: 'Feels derailed when sleep is short',
    exercise: 'Can execute short hotel sessions well',
    communication: 'Likes pre-trip checklists',
    flag: '',
    missing: ['Ask next trip time zones and flight dates'],
    tags: ['international-travel', 'maintenance', 'hotel-gym']
  },
  {
    name: 'Jason Hale',
    pronouns: 'he/him',
    location: 'Spokane, WA',
    role: 'Physical therapist',
    family: 'Spouse and two dogs',
    curriculumType: 'GGS Coaching',
    programType: 'KB and Bands',
    cohort: 'January',
    programFormat: 'Workout Collections',
    primaryTrainingGoal: 'Strength Gain',
    contraindications: [],
    equipment: 'Kettlebells, bands, rower',
    motivation: 'Improve conditioning without losing strength',
    barrier: 'Over-programming himself',
    nutrition: 'Good intake awareness, inconsistent carbs around training',
    mindset: 'Needs constraints to avoid doing too much',
    exercise: 'Technically skilled, volume needs boundaries',
    communication: 'Prefers collaborative but firm guardrails',
    flag: 'Tendency to add extra conditioning when stress is high.',
    missing: ['Confirm weekly conditioning ceiling'],
    tags: ['kb', 'conditioning', 'volume-boundaries']
  },
  {
    name: 'Andre Wilson',
    pronouns: 'he/him',
    location: 'Charlotte, NC',
    role: 'Restaurant manager',
    family: 'Engaged, works late nights',
    curriculumType: 'GGS Coaching',
    programType: 'Bodyweight and Bands',
    cohort: 'July',
    programFormat: 'On Demand',
    primaryTrainingGoal: 'Fat Loss',
    contraindications: [],
    equipment: 'Bands, pull-up bar, no consistent gym',
    motivation: 'Feel better during long shifts and reduce back tightness',
    barrier: 'Late meals and shift fatigue',
    nutrition: 'Needs closing-shift meal strategy',
    mindset: 'Feels discouraged by irregular schedule',
    exercise: 'Needs short sessions and back-friendly warm-ups',
    communication: 'Likes practical swaps more than long explanations',
    flag: 'Back tightness increases after double shifts.',
    missing: ['Ask pain pattern and any red-flag symptoms'],
    tags: ['late-shift', 'bodyweight', 'back-tightness']
  },
  {
    name: 'Matt O Connor',
    pronouns: 'he/him',
    location: 'Boston, MA',
    role: 'Finance director',
    family: 'Married, three kids',
    curriculumType: 'GGS Coaching',
    programType: 'Muscle Gain',
    cohort: 'April',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Strength Gain',
    contraindications: [],
    equipment: 'Home rack, bike, adjustable dumbbells',
    motivation: 'Add muscle while keeping family schedule sane',
    barrier: 'Morning training interruptions',
    nutrition: 'Breakfast is reliable, afternoon snacks too light',
    mindset: 'Likes numbers and trend review',
    exercise: 'Consistent with compound lifts',
    communication: 'Prefers concise data summaries',
    flag: '',
    missing: ['Ask whether weekend long sessions are realistic'],
    tags: ['muscle-gain', 'home-rack', 'family-schedule']
  },
  {
    name: 'Chris Bennett',
    pronouns: 'he/him',
    location: 'Sacramento, CA',
    role: 'Paramedic',
    family: 'Partner, trail-running friends',
    curriculumType: 'GGS Coaching',
    programType: 'Cardio',
    cohort: 'January',
    programFormat: 'Coach Assigned',
    primaryTrainingGoal: 'Longevity',
    contraindications: ['Sleep Disorder'],
    equipment: 'Road bike, gym access, bands',
    motivation: 'Improve cardio base without burnout',
    barrier: 'Rotating shifts and stress spikes',
    nutrition: 'Needs fueling plan before long rides',
    mindset: 'Can chase intensity when tired',
    exercise: 'Needs zone 2 discipline and recovery guardrails',
    communication: 'Likes objective readiness rules',
    flag: 'High-intensity sessions cluster after poor sleep.',
    missing: ['Ask average resting heart rate trend'],
    tags: ['cardio-base', 'shift-work', 'recovery']
  },
  {
    name: 'Leo Hart',
    pronouns: 'he/him',
    location: 'Salt Lake City, UT',
    role: 'Architect',
    family: 'Spouse, climbing partner',
    curriculumType: 'GGS Coaching',
    programType: 'Mobility',
    cohort: 'July',
    programFormat: 'Workout Collections',
    primaryTrainingGoal: 'Muscle Maintenance',
    contraindications: [],
    equipment: 'Climbing gym, rings, bands',
    motivation: 'Keep climbing shoulders healthy and reduce desk stiffness',
    barrier: 'Long design deadlines and missed mobility',
    nutrition: 'Consistent meals, hydration and pre-climb snacks need work',
    mindset: 'Responds to movement-quality goals',
    exercise: 'Needs shoulder care and hip mobility',
    communication: 'Prefers concise technique prompts',
    flag: 'Left shoulder feels pinchy after high-volume climbing.',
    missing: ['Ask which climbing grades and weekly session volume'],
    tags: ['climbing', 'mobility', 'shoulder-care']
  }
];

const TASK_PATTERNS = [
  [
    ['Send focused check-in', 'Ask for the single biggest friction point before the next lesson.', 'high', 'active', -3],
    ['Review food-log trend', 'Tie protein and meal timing to the current schedule constraints.', 'medium', 'recommended', 0],
    ['Plan next progression', 'Queue the next training progression if symptoms and recovery stay stable.', 'low', 'future', 10]
  ],
  [
    ['Clarify readiness blocker', 'Name what is blocking progress and offer two lower-friction choices.', 'high', 'blocked', -5],
    ['Update weekly target', 'Reset the client-facing target to match current capacity.', 'medium', 'active', 2],
    ['Close old resource follow-up', 'Resource was sent and acknowledged in the last note.', 'low', 'completed', -7]
  ],
  [
    ['Needs review before message', 'Review sensitive context before sending the next client message.', 'high', 'needs-review', 0],
    ['Recommend next experiment', 'Suggest one measurable experiment for the upcoming week.', 'medium', 'recommended', 5],
    ['Hold future topic', 'Revisit after the next two check-ins.', 'low', 'future', 21],
    ['Retire stale prompt', 'Older prompt no longer matches the current plan.', 'none', 'outdated', -12]
  ],
  [
    ['Follow up on missed check-in', 'Send a low-pressure prompt and ask what would make reply easier.', 'high', 'active', -1],
    ['Prepare substitution menu', 'Have one low, medium, and full-session option ready.', 'medium', 'active', 1],
    ['Drop duplicate task', 'This task is covered by the updated plan.', 'low', 'abandoned', -9]
  ],
  [
    ['Send next-step summary', 'Summarize the agreed plan in plain language.', 'medium', 'recommended', 3],
    ['Schedule future review', 'Review this again after the current block.', 'low', 'future', 14]
  ],
  [
    ['Escalate high-priority follow-up', 'Client needs a decision or safety-sensitive modification before progressing.', 'high', 'active', -8],
    ['Unblock missing context', 'Ask the missing question that determines the next plan edit.', 'high', 'blocked', -2],
    ['Document completed adjustment', 'Log the adjustment that was already made.', 'low', 'completed', -1],
    ['Review today', 'Make a same-day call on whether to progress, repeat, or regress.', 'medium', 'needs-review', 0]
  ],
  [
    ['Keep routine alive', 'Send a simple minimum plan that protects consistency.', 'none', 'active', null],
    ['Recommend resource', 'Share one resource that matches the current barrier.', 'high', 'recommended', 4],
    ['Future block setup', 'Queue next block setup after current adherence improves.', 'low', 'future', 28]
  ]
];

const UPDATE_OFFSETS = [0, -1, -2, -3, -5, -7, -9, -11, -14, -18, -21, -27, -31, -36, -42];
const SOURCE_TYPES = ['everfit', 'check-in', 'message', 'transcript', 'notes', 'pdf', 'manual'];

function usage() {
  return `CoachNotes local demo-data seeder

Usage:
  node scripts/seed-coach-home-demo-data.js [options]

Options:
  --db <path>             SQLite DB path. Defaults to:
                          ${DEFAULT_DB_PATH}
  --anchor-date <date>    YYYY-MM-DD used for deterministic due dates. Defaults to local today.
  --dry-run               Validate schema and report what would be replaced without writing.
  --help                  Show this help.

The script replaces only clients whose hidden client key starts with "${DEMO_NAME_PREFIX}".
It never calls the CoachNotes proxy or any OpenAI API.`;
}

function fail(message) {
  console.error(`\nSeed failed: ${message}\n`);
  console.error(`Run with --help for usage.\n`);
  process.exit(1);
}

function expandHome(value) {
  const raw = String(value || '').trim();
  if (raw === '~') {
    return os.homedir();
  }
  if (raw.startsWith('~/')) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return raw;
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function parseDateKey(value, label) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    fail(`${label} must be in YYYY-MM-DD format.`);
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1])
    || date.getMonth() !== Number(match[2]) - 1
    || date.getDate() !== Number(match[3])
  ) {
    fail(`${label} is not a valid calendar date.`);
  }
  return raw;
}

function parseArgs(argv) {
  const options = {
    dbPath: process.env.COACHNOTES_DB || DEFAULT_DB_PATH,
    anchorDate: localDateKey(),
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--db') {
      const value = argv[index + 1];
      if (!value) {
        fail('--db requires a path.');
      }
      options.dbPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--db=')) {
      options.dbPath = arg.slice('--db='.length);
      continue;
    }
    if (arg === '--anchor-date') {
      const value = argv[index + 1];
      if (!value) {
        fail('--anchor-date requires a YYYY-MM-DD value.');
      }
      options.anchorDate = parseDateKey(value, '--anchor-date');
      index += 1;
      continue;
    }
    if (arg.startsWith('--anchor-date=')) {
      options.anchorDate = parseDateKey(arg.slice('--anchor-date='.length), '--anchor-date');
      continue;
    }
    fail(`Unknown option: ${arg}`);
  }

  options.dbPath = path.resolve(expandHome(options.dbPath));
  options.anchorDate = parseDateKey(options.anchorDate, '--anchor-date');
  return options;
}

function addDays(dateKey, dayOffset) {
  if (dayOffset == null) {
    return '';
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(dayOffset));
  return localDateKey(date);
}

function isoAtOffset(dateKey, dayOffset, hour = 12, minute = 0) {
  const [year, month, day] = addDays(dateKey, dayOffset).split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function validateDbPath(dbPath) {
  if (!fs.existsSync(dbPath)) {
    fail(`Database does not exist at ${dbPath}. Open CoachNotes Dev once so it initializes the local SQLite schema, or pass --db <path>.`);
  }
  const stat = fs.statSync(dbPath);
  if (!stat.isFile()) {
    fail(`Database path is not a file: ${dbPath}`);
  }
}

function ensureSqliteAvailable() {
  const result = spawnSync(SQLITE_BIN, ['-version'], { encoding: 'utf8' });
  if (result.error) {
    fail(`Could not run ${SQLITE_BIN}. Install sqlite3 or set SQLITE3_BIN to the sqlite3 executable path.`);
  }
  if (result.status !== 0) {
    fail(`${SQLITE_BIN} -version failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

function runSqlite(dbPath, input, options = {}) {
  const args = ['-batch'];
  if (options.json) {
    args.push('-json');
  }
  args.push(dbPath);
  const result = spawnSync(SQLITE_BIN, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.error) {
    fail(`Could not run ${SQLITE_BIN}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const context = options.context ? ` while ${options.context}` : '';
    fail(`${SQLITE_BIN} failed${context}: ${result.stderr || result.stdout || 'unknown error'}`);
  }
  return result.stdout.trim();
}

function queryJson(dbPath, sql, context) {
  const output = runSqlite(dbPath, sql, { json: true, context });
  if (!output) {
    return [];
  }
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`Could not parse sqlite3 JSON output${context ? ` for ${context}` : ''}: ${error.message}`);
  }
}

function executeSql(dbPath, sql, context) {
  runSqlite(dbPath, sql, { context });
}

function sqlValue(value) {
  if (value == null) {
    return 'NULL';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    fail(`Internal script error: invalid integer value ${value}.`);
  }
  return String(number);
}

function getTableColumns(dbPath, tableName) {
  return new Set(queryJson(dbPath, `PRAGMA table_info(${tableName});`, `inspecting ${tableName}`).map((row) => row.name));
}

function validateSchema(dbPath) {
  const tableRows = queryJson(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table';", 'listing tables');
  const tables = new Set(tableRows.map((row) => row.name));
  const missingTables = Object.keys(REQUIRED_SCHEMA).filter((tableName) => !tables.has(tableName));
  if (missingTables.length) {
    fail([
      'This does not look like the current CoachNotes desktop database schema.',
      `Missing table(s): ${missingTables.join(', ')}.`,
      'Expected tables from apps/desktop/src/main.js: clients, intake_sources, client_baselines, client_section_undo, settings.'
    ].join(' '));
  }

  const missingColumns = [];
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    const columns = getTableColumns(dbPath, tableName);
    for (const columnName of requiredColumns) {
      if (!columns.has(columnName)) {
        missingColumns.push(`${tableName}.${columnName}`);
      }
    }
  }
  if (missingColumns.length) {
    fail([
      'This CoachNotes database is missing expected column(s):',
      `${missingColumns.join(', ')}.`,
      'Run the current desktop app once to migrate the DB, then rerun this seeder.'
    ].join(' '));
  }
}

function item(title, details, evidenceIds = [], extra = {}) {
  return {
    title,
    details,
    evidenceIds,
    ...extra
  };
}

function planningItem(title, details, priority, planningStatus, dueDate, evidenceIds = []) {
  return item(title, details, evidenceIds, {
    priority,
    planningStatus,
    ...(dueDate ? { dueDate } : {})
  });
}

function buildSourceRows(spec, index, anchorDate) {
  const slug = slugify(spec.name);
  const count = 2 + (index % 3);
  const rows = [
    {
      title: 'Initial Intake',
      sourceType: 'everfit',
      sourceDate: addDays(anchorDate, -84 + (index % 10)),
      annotation: 'Demo initial intake source generated locally.',
      rawText: [
        `${spec.name} (${spec.pronouns}) is based in ${spec.location} and works as a ${spec.role}.`,
        `Primary motivation: ${spec.motivation}. Main barrier: ${spec.barrier}.`,
        `Equipment access: ${spec.equipment}. Communication preference: ${spec.communication}.`,
        `Current nutrition context: ${spec.nutrition}. Current mindset context: ${spec.mindset}.`
      ].join('\n\n')
    },
    {
      title: 'Recent Check-In',
      sourceType: SOURCE_TYPES[(index + 1) % SOURCE_TYPES.length],
      sourceDate: addDays(anchorDate, -21 + (index % 9)),
      annotation: 'Demo check-in source for Mission Control testing.',
      rawText: [
        `${spec.name} reported that the current focus is ${spec.primaryTrainingGoal.toLowerCase()} while managing ${spec.barrier.toLowerCase()}.`,
        `Training note: ${spec.exercise}. Nutrition note: ${spec.nutrition}.`,
        spec.flag ? `Coach watch-out: ${spec.flag}` : 'No urgent coach watch-out was raised in this check-in.',
        `Suggested next step is to keep the plan specific and match the next ask to ${spec.communication.toLowerCase()}.`
      ].join('\n\n')
    },
    {
      title: 'Message Thread',
      sourceType: SOURCE_TYPES[(index + 2) % SOURCE_TYPES.length],
      sourceDate: addDays(anchorDate, -8 + (index % 6)),
      annotation: 'Demo message-thread source with current follow-up context.',
      rawText: [
        `${spec.name} asked for a clearer next step because ${spec.barrier.toLowerCase()}.`,
        `Coach should connect the answer to motivation: ${spec.motivation}.`,
        `Missing or uncertain detail: ${(spec.missing[0] || 'confirm the next preferred check-in cadence')}.`
      ].join('\n\n')
    },
    {
      title: 'Session Transcript',
      sourceType: SOURCE_TYPES[(index + 3) % SOURCE_TYPES.length],
      sourceDate: addDays(anchorDate, -3 - (index % 5)),
      annotation: 'Demo transcript excerpt for archive filtering.',
      rawText: [
        `Transcript excerpt for ${spec.name}: client described the week as mixed but workable.`,
        `Coach reflected back the plan, including ${spec.exercise.toLowerCase()} and ${spec.nutrition.toLowerCase()}.`,
        `Action items should stay small enough to fit around ${spec.barrier.toLowerCase()}.`
      ].join('\n\n')
    }
  ];

  return rows.slice(0, count).map((row, sourceIndex) => ({
    ...row,
    originalPath: `demo://${SEED_KEY}/${slug}/${sourceIndex + 1}`,
    vaultPath: '',
    createdAt: isoAtOffset(anchorDate, -30 + sourceIndex * 4 - (index % 6), 10 + sourceIndex, index % 60),
    metadataJson: JSON.stringify({
      seedKey: SEED_KEY,
      clientSlug: slug,
      sourceIndex,
      generatedBy: 'scripts/seed-coach-home-demo-data.js'
    })
  }));
}

function buildCoachTasks(spec, index, anchorDate, evidenceIds) {
  const pattern = TASK_PATTERNS[index % TASK_PATTERNS.length];
  const count = 2 + (index % 3);
  return pattern.slice(0, count).map(([title, details, priority, status, dueOffset], taskIndex) => planningItem(
    title,
    `${details} Client context: ${spec.focus || spec.motivation}`,
    priority,
    status,
    dueOffset == null ? '' : addDays(anchorDate, dueOffset),
    [evidenceIds[taskIndex % evidenceIds.length]]
  ));
}

function buildGoals(spec, index, anchorDate, evidenceIds) {
  return [
    planningItem(
      spec.primaryTrainingGoal,
      spec.motivation,
      index % 4 === 0 ? 'high' : 'medium',
      index % 5 === 0 ? 'needs-review' : 'active',
      addDays(anchorDate, 7 + (index % 4) * 7),
      [evidenceIds[0]]
    ),
    planningItem(
      'Consistency floor',
      `Keep a minimum plan available when ${spec.barrier.toLowerCase()}.`,
      index % 3 === 0 ? 'high' : 'low',
      index % 6 === 0 ? 'blocked' : 'recommended',
      addDays(anchorDate, -1 + (index % 8)),
      [evidenceIds[Math.min(1, evidenceIds.length - 1)]]
    )
  ];
}

function buildFlags(spec, index, evidenceIds) {
  const flags = [];
  if (spec.flag) {
    flags.push(item('Coach watch-out', spec.flag, [evidenceIds[0]]));
  }
  if (index % 7 === 0) {
    flags.push(item('Engagement risk', `Reply cadence drops when ${spec.barrier.toLowerCase()}.`, [evidenceIds[Math.min(1, evidenceIds.length - 1)]]));
  }
  if (index % 11 === 0) {
    flags.push(item('Recovery guardrail', 'Avoid stacking intensity during low-sleep or high-stress weeks.', [evidenceIds[evidenceIds.length - 1]]));
  }
  return flags;
}

function buildMissingInfo(spec, index, evidenceIds) {
  const missing = [...spec.missing];
  if (index % 5 === 0) {
    missing.push('Confirm preferred check-in day and response format');
  }
  return missing.slice(0, 3).map((entry, missingIndex) => item(
    entry,
    'Needed before the next dashboard update is treated as fully current.',
    [evidenceIds[missingIndex % evidenceIds.length]]
  ));
}

function buildStructuredBaseline(spec, index, anchorDate, sourceIds) {
  const evidenceIds = sourceIds.map((id) => `intake_source_${id}`);
  const curriculumStartOffset = index % 9 === 0 ? 7 : -(14 + (index % 14) * 7);
  const programStartOffset = index % 8 === 0 ? 3 : -(7 + (index % 10) * 7);

  return {
    schemaVersion: 'coachnotes.localDemo.v1',
    seedKey: SEED_KEY,
    clientProfile: {
      pronouns: spec.pronouns,
      location: spec.location,
      role: spec.role,
      familyLife: spec.family,
      equipmentAccess: spec.equipment,
      communicationPreference: spec.communication,
      trainingExperience: spec.exercise,
      nutritionContext: spec.nutrition,
      mindsetContext: spec.mindset,
      curriculumType: spec.curriculumType,
      programType: spec.programType,
      cohort: spec.cohort,
      programFormat: spec.programFormat,
      primaryTrainingGoal: spec.primaryTrainingGoal,
      contraindications: spec.contraindications,
      curriculumStartDate: addDays(anchorDate, curriculumStartOffset),
      programStartDate: addDays(anchorDate, programStartOffset)
    },
    overview: `${spec.name} is focused on ${spec.primaryTrainingGoal.toLowerCase()} while working around ${spec.barrier.toLowerCase()}. The next coaching touch should protect momentum, keep the ask specific, and match the communication style: ${spec.communication.toLowerCase()}.`,
    coachTasks: buildCoachTasks(spec, index, anchorDate, evidenceIds),
    flags: buildFlags(spec, index, evidenceIds),
    goalsValues: buildGoals(spec, index, anchorDate, evidenceIds),
    clientValues: [
      item('Why this matters', spec.motivation, [evidenceIds[0]]),
      item('Preferred support', spec.communication, [evidenceIds[Math.min(1, evidenceIds.length - 1)]])
    ],
    coachingPlanApproach: [
      item('Current coaching stance', `Use specific weekly decisions and reduce friction around ${spec.barrier.toLowerCase()}.`, [evidenceIds[0]]),
      item('Message tone', spec.communication, [evidenceIds[Math.min(1, evidenceIds.length - 1)]])
    ],
    programChanges: [
      item('Current modification focus', spec.exercise, [evidenceIds[Math.min(1, evidenceIds.length - 1)]])
    ],
    progressTracking: [
      item('Momentum signal', `Track whether ${spec.name.split(' ')[0]} completes the agreed minimum plan before adding complexity.`, [evidenceIds[evidenceIds.length - 1]]),
      item('Behavior marker', `Watch consistency around ${spec.barrier.toLowerCase()}.`, [evidenceIds[Math.min(1, evidenceIds.length - 1)]])
    ],
    engagementNotes: [
      item('Response pattern', spec.communication, [evidenceIds[Math.min(1, evidenceIds.length - 1)]]),
      item('Risk pattern', `Engagement is most vulnerable when ${spec.barrier.toLowerCase()}.`, [evidenceIds[evidenceIds.length - 1]])
    ],
    nutritionThreads: [
      item('Nutrition focus', spec.nutrition, [evidenceIds[0]]),
      item('Next nutrition check', 'Ask for the smallest change that would make the next week easier to execute.', [evidenceIds[Math.min(1, evidenceIds.length - 1)]])
    ],
    mindsetThreads: [
      item('Mindset pattern', spec.mindset, [evidenceIds[0]]),
      item('Coach framing', `Reinforce progress that supports ${spec.motivation.toLowerCase()}.`, [evidenceIds[evidenceIds.length - 1]])
    ],
    exerciseThreads: [
      item('Training focus', spec.exercise, [evidenceIds[Math.min(1, evidenceIds.length - 1)]]),
      item('Equipment reality', spec.equipment, [evidenceIds[0]])
    ],
    resourcesShared: [
      item('Relevant resource', resourceFor(spec), [evidenceIds[evidenceIds.length - 1]])
    ],
    suggestedTags: spec.tags,
    timeline: [
      {
        date: addDays(anchorDate, -84 + (index % 10)),
        title: 'Initial intake accepted',
        details: `${spec.curriculumType} context and ${spec.programType} program details captured.`,
        evidenceIds: [evidenceIds[0]]
      },
      {
        date: addDays(anchorDate, -21 + (index % 9)),
        title: 'Recent coaching update',
        details: `Plan narrowed around ${spec.barrier.toLowerCase()}.`,
        evidenceIds: [evidenceIds[Math.min(1, evidenceIds.length - 1)]]
      },
      {
        date: addDays(anchorDate, -3 - (index % 5)),
        title: 'Mission Control refresh point',
        details: 'Current tasks and follow-up needs seeded for local demo testing.',
        evidenceIds: [evidenceIds[evidenceIds.length - 1]]
      }
    ],
    missingInfo: buildMissingInfo(spec, index, evidenceIds),
    confidenceNotes: [
      item('Strong evidence', 'Program context, current barrier, and preferred communication style are supported by demo source records.', [evidenceIds[0]]),
      item('Needs confirmation', 'Some medical, provider, or schedule details are intentionally left as missing info for workflow testing.', [evidenceIds[evidenceIds.length - 1]])
    ]
  };
}

function resourceFor(spec) {
  if (spec.curriculumType === 'GLP-1') {
    return 'GLP-1 small-meal protein checklist';
  }
  if (spec.programType === 'Travel') {
    return 'Travel-week minimums and hotel-gym substitutions';
  }
  if (spec.programType === 'Prenatal' || spec.programType === 'Postnatal') {
    return 'Symptom-aware training modification checklist';
  }
  if (spec.contraindications.includes('Osteopenia')) {
    return 'Bone-density strength and impact progression notes';
  }
  if (spec.programType === 'Cardio') {
    return 'Cardio base and recovery guardrails';
  }
  return 'Weekly planning and friction-reduction checklist';
}

function assertClientCount() {
  if (CLIENT_SPECS.length !== CLIENT_COUNT) {
    fail(`Internal script error: expected ${CLIENT_COUNT} client specs but found ${CLIENT_SPECS.length}.`);
  }
}

function existingDemoClients(dbPath) {
  return queryJson(
    dbPath,
    `SELECT id, display_name AS displayName FROM clients WHERE name LIKE ${sqlValue(`${DEMO_NAME_PREFIX}%`)} ORDER BY id ASC;`,
    'finding existing demo clients'
  );
}

function nextIdStart(dbPath, tableName) {
  const maxRows = queryJson(dbPath, `SELECT COALESCE(MAX(id), 0) AS maxId FROM ${tableName};`, `reading max id for ${tableName}`);
  const seqRows = queryJson(dbPath, `SELECT seq FROM sqlite_sequence WHERE name = ${sqlValue(tableName)};`, `reading sqlite sequence for ${tableName}`);
  return Math.max(Number(maxRows[0]?.maxId || 0), Number(seqRows[0]?.seq || 0)) + 1;
}

function insertSourceSql(clientId, sourceId, source) {
  return `INSERT INTO intake_sources
    (id, client_id, title, source_type, source_date, annotation, original_path, vault_path, raw_text, created_at, metadata_json)
   VALUES (
    ${sqlInteger(sourceId)},
    ${sqlInteger(clientId)},
    ${sqlValue(source.title)},
    ${sqlValue(source.sourceType)},
    ${sqlValue(source.sourceDate)},
    ${sqlValue(source.annotation)},
    ${sqlValue(source.originalPath)},
    ${sqlValue(source.vaultPath)},
    ${sqlValue(source.rawText)},
    ${sqlValue(source.createdAt)},
    ${sqlValue(source.metadataJson)}
  );`;
}

function seed(options) {
  const existing = existingDemoClients(options.dbPath);
  if (options.dryRun) {
    return {
      deleted: existing.length,
      inserted: CLIENT_SPECS.length,
      sources: CLIENT_SPECS.reduce((total, _spec, index) => total + 2 + (index % 3), 0),
      dryRun: true
    };
  }

  let nextClientId = nextIdStart(options.dbPath, 'clients');
  let nextSourceId = nextIdStart(options.dbPath, 'intake_sources');
  let nextBaselineId = nextIdStart(options.dbPath, 'client_baselines');
  let sourceCount = 0;
  const statements = [
    '.bail on',
    'PRAGMA foreign_keys = ON;',
    'BEGIN IMMEDIATE;',
    `DELETE FROM clients WHERE name LIKE ${sqlValue(`${DEMO_NAME_PREFIX}%`)};`
  ];

  for (const [index, spec] of CLIENT_SPECS.entries()) {
    const slug = slugify(spec.name);
    const hiddenName = `${DEMO_NAME_PREFIX}${slug}`;
    const displayName = `${DEMO_DISPLAY_PREFIX}${spec.name}`;
    const clientId = nextClientId;
    nextClientId += 1;

    statements.push(`INSERT INTO clients (id, name, display_name, archived, archived_at)
      VALUES (${sqlInteger(clientId)}, ${sqlValue(hiddenName)}, ${sqlValue(displayName)}, 0, NULL);`);

    const sourceIds = [];
    for (const source of buildSourceRows(spec, index, options.anchorDate)) {
      const sourceId = nextSourceId;
      nextSourceId += 1;
      sourceIds.push(sourceId);
      sourceCount += 1;
      statements.push(insertSourceSql(clientId, sourceId, source));
    }

    const baselineId = nextBaselineId;
    nextBaselineId += 1;
    const acceptedOffset = -(45 + ((index * 3) % 50));
    const updatedOffset = UPDATE_OFFSETS[index % UPDATE_OFFSETS.length];
    const createdAt = isoAtOffset(options.anchorDate, acceptedOffset - 1, 9 + (index % 5), index % 60);
    const acceptedAt = isoAtOffset(options.anchorDate, acceptedOffset, 10 + (index % 6), (index * 3) % 60);
    const updatedAt = isoAtOffset(options.anchorDate, updatedOffset, 14 + (index % 6), (index * 7) % 60);
    const structured = buildStructuredBaseline(spec, index, options.anchorDate, sourceIds);

    statements.push(`INSERT INTO client_baselines
      (id, client_id, status, structured_json, source_ids_json, model, raw_output, created_at, accepted_at, updated_at)
     VALUES (
      ${sqlInteger(baselineId)},
      ${sqlInteger(clientId)},
      'accepted',
      ${sqlValue(JSON.stringify(structured, null, 2))},
      ${sqlValue(JSON.stringify(sourceIds))},
      ${sqlValue(DEMO_MODEL)},
      ${sqlValue(`Generated locally by scripts/seed-coach-home-demo-data.js for ${SEED_KEY}. No proxy or OpenAI API calls were made.`)},
      ${sqlValue(createdAt)},
      ${sqlValue(acceptedAt)},
      ${sqlValue(updatedAt)}
    );`);
  }

  statements.push('COMMIT;');
  executeSql(options.dbPath, `${statements.join('\n')}\n`, 'seeding demo data');

  return {
    deleted: existing.length,
    inserted: CLIENT_SPECS.length,
    sources: sourceCount,
    dryRun: false
  };
}

function main() {
  assertClientCount();
  const options = parseArgs(process.argv.slice(2));
  ensureSqliteAvailable();
  validateDbPath(options.dbPath);
  validateSchema(options.dbPath);
  const result = seed(options);
  const action = result.dryRun ? 'would replace' : 'replaced';
  const writeMode = result.dryRun ? 'DRY RUN' : 'DONE';
  console.log(`${writeMode}: ${action} ${result.deleted} existing demo clients and insert ${result.inserted} demo clients with ${result.sources} sources.`);
  console.log(`Database: ${options.dbPath}`);
  console.log(`Anchor date: ${options.anchorDate}`);
  console.log(`Demo client display prefix: ${DEMO_DISPLAY_PREFIX}`);
  console.log('Restart CoachNotes Dev, or reload app state, to see the seeded clients if the app is already open.');
}

main();
