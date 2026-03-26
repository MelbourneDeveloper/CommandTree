import { readFileSync, existsSync, readdirSync } from 'fs';

const THRESHOLD = 90;
const METRICS = ['lines', 'functions', 'branches', 'statements'];
const SUMMARY_PATH = './coverage/coverage-summary.json';

if (!existsSync(SUMMARY_PATH)) {
  console.error(`ERROR: ${SUMMARY_PATH} not found.`);
  console.error('Run tests with coverage first: npx vscode-test --coverage');
  const coverageDir = './coverage';
  if (existsSync(coverageDir)) {
    console.error(`Files in ${coverageDir}:`, readdirSync(coverageDir));
  }
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
const total = summary.total;
let failed = false;

for (const metric of METRICS) {
  const pct = total[metric].pct;
  if (pct < THRESHOLD) {
    console.error(`FAIL: ${metric} ${pct}% < ${THRESHOLD}%`);
    failed = true;
  } else {
    console.log(`OK: ${metric} ${pct}% >= ${THRESHOLD}%`);
  }
}

if (failed) {
  process.exit(1);
}
