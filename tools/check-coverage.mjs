import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';

const METRICS = ['lines', 'functions', 'branches', 'statements'];
const SUMMARY_PATH = './coverage/coverage-summary.json';
const THRESHOLDS_PATH = './coverage-thresholds.json';

if (!existsSync(SUMMARY_PATH)) {
  console.error(`ERROR: ${SUMMARY_PATH} not found.`);
  console.error('Run tests with coverage first: npx vscode-test --coverage');
  const coverageDir = './coverage';
  if (existsSync(coverageDir)) {
    console.error(`Files in ${coverageDir}:`, readdirSync(coverageDir));
  }
  process.exit(1);
}

if (!existsSync(THRESHOLDS_PATH)) {
  console.error(`ERROR: ${THRESHOLDS_PATH} not found.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
const thresholds = JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8'));
const total = summary.total;
let failed = false;
let bumped = false;

for (const metric of METRICS) {
  const pct = total[metric].pct;
  const threshold = thresholds[metric];

  if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
    console.error(`FAIL: ${metric} threshold missing or invalid in ${THRESHOLDS_PATH}`);
    failed = true;
    continue;
  }

  if (typeof pct !== 'number' || Number.isNaN(pct)) {
    console.error(`FAIL: ${metric} coverage is ${pct} — not a valid number. Coverage calculation is broken.`);
    failed = true;
  } else if (pct < threshold) {
    const diff = (threshold - pct).toFixed(2);
    console.error(`FAIL: ${metric} ${pct}% < ${threshold}% (short by ${diff}%)`);
    failed = true;
  } else if (pct > threshold) {
    console.log(`BUMP: ${metric} ${threshold}% -> ${pct}%`);
    thresholds[metric] = pct;
    bumped = true;
  } else {
    console.log(`OK: ${metric} ${pct}% == ${threshold}%`);
  }
}

if (bumped && !failed) {
  writeFileSync(THRESHOLDS_PATH, JSON.stringify(thresholds, null, 2) + '\n');
  console.log(`Updated ${THRESHOLDS_PATH}`);
}

if (failed) {
  process.exit(1);
}
