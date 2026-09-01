const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { seedWeeklyReviewFixture } = require('./weekly-review-fixture');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

app.whenReady().then(() => {
  const dbPath = optionValue('--db') || path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'CoachNotes Dev',
    'coachnotes',
    'coachnotes.sqlite'
  );
  const referenceDate = optionValue('--date') || new Date().toISOString().slice(0, 10);
  const db = new Database(dbPath);
  try {
    const scenarios = seedWeeklyReviewFixture(db, referenceDate);
    process.stdout.write(`Seeded ${scenarios.length} weekly-review clients in ${dbPath}\n`);
  } finally {
    db.close();
    app.quit();
  }
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  app.exit(1);
});
