'use strict';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite is an experimental feature/.test(warning.message)) {
    return;
  }
  console.warn(warning.stack || String(warning));
});

const assert = require('node:assert/strict');
const test = require('node:test');

const { runBenchmark } = require('../evaluation/benchmark/adversarial-high-scale-benchmark');

test('adversarial high-scale benchmark smoke tier passes', () => {
  const report = runBenchmark({ tier: 'smoke' });

  assert.equal(report.verdict.pass, true);
  assert.equal(report.metrics.page_id_collision_rate, 0);
  assert.equal(report.metrics.structural_signal_coverage_rate, 1);
  assert.equal(report.metrics.workflow_atomic_recovery_rate, 1);
  assert.equal(report.metrics.repo_boundary_rejection_rate, 1);
});
