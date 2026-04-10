#!/usr/bin/env node

'use strict';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite is an experimental feature/.test(warning.message)) {
    return;
  }
  console.warn(warning.stack || String(warning));
});

const { assertSupportedNode } = require('../src/lib/runtime-requirements');
const { run } = require('../src/cli');

assertSupportedNode('wiki');
run(process.argv.slice(2));
