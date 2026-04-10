'use strict';

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 5;
const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0`;

function parseNodeVersion(version = process.versions.node) {
  const [major = '0', minor = '0', patch = '0'] = String(version || '0.0.0').split('.');
  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}

function supportsRequiredNode(version = process.versions.node) {
  const parsed = parseNodeVersion(version);
  if (parsed.major > MIN_NODE_MAJOR) {
    return true;
  }
  if (parsed.major < MIN_NODE_MAJOR) {
    return false;
  }
  return parsed.minor >= MIN_NODE_MINOR;
}

function assertSupportedNode(commandName = 'wiki') {
  if (supportsRequiredNode()) {
    return;
  }
  throw new Error(`${commandName} requires Node >= ${MIN_NODE_VERSION} because the runtime index uses node:sqlite.`);
}

module.exports = {
  MIN_NODE_VERSION,
  assertSupportedNode,
  parseNodeVersion,
  supportsRequiredNode,
};
