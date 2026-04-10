#!/usr/bin/env node

'use strict';

process.removeAllListeners('warning');
process.on('warning', () => {});

const { run } = require('../src/cli');

run(process.argv.slice(2));
