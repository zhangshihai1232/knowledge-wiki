'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? path.join(process.env.XDG_CONFIG_HOME, 'knowledge-wiki-toolkit')
  : path.join(os.homedir(), '.config', 'knowledge-wiki-toolkit');

const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, 'namespaces.conf');
const CONTEXT_FILE_NAME = 'context.conf';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureConfigDir(configPath = DEFAULT_CONFIG_PATH) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

function ensureConfigFile(configPath = DEFAULT_CONFIG_PATH) {
  ensureConfigDir(configPath);
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      '# LLM Wiki namespace config\n# format: namespace=/absolute/path\n# special key: default_namespace=work\n',
      'utf8'
    );
  }
}

function getContextPath(configPath = DEFAULT_CONFIG_PATH) {
  return path.join(path.dirname(configPath), CONTEXT_FILE_NAME);
}

function ensureContextFile(configPath = DEFAULT_CONFIG_PATH) {
  ensureConfigDir(configPath);
  const contextPath = getContextPath(configPath);
  if (!fs.existsSync(contextPath)) {
    fs.writeFileSync(contextPath, '# LLM Wiki current context\n# format: current_repo=/absolute/path\n', 'utf8');
  }
  return contextPath;
}

function validateNamespace(namespace) {
  if (!namespace || /[^A-Za-z0-9._-]/.test(namespace)) {
    throw new Error(`invalid namespace: ${namespace} (allowed: letters, digits, dot, underscore, dash)`);
  }
}

function normalizeNamespacePath(value) {
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`namespace path must be absolute: ${value}`);
  }
  return value;
}

function readNamespaceConfig(configPath = DEFAULT_CONFIG_PATH) {
  const namespaces = [];
  let defaultNamespace = '';

  ensureConfigFile(configPath);
  if (fs.existsSync(configPath)) {
    const lines = readText(configPath).split('\n');
    for (const line of lines) {
      if (!line || line.startsWith('#')) {
        continue;
      }
      if (line.startsWith('default_namespace=')) {
        defaultNamespace = line.slice('default_namespace='.length);
        continue;
      }
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }
      namespaces.push({
        name: line.slice(0, separatorIndex),
        path: line.slice(separatorIndex + 1),
      });
    }
  }

  return {
    configPath,
    defaultNamespace,
    namespaces,
  };
}

function readCurrentRepo(configPath = DEFAULT_CONFIG_PATH) {
  const contextPath = getContextPath(configPath);
  if (!fs.existsSync(contextPath)) {
    return '';
  }

  const lines = readText(contextPath).split('\n');
  for (const line of lines) {
    if (line.startsWith('current_repo=')) {
      return line.slice('current_repo='.length);
    }
  }
  return '';
}

function setCurrentRepo(configPath = DEFAULT_CONFIG_PATH, repoPath) {
  const contextPath = ensureContextFile(configPath);
  const lines = fs
    .readFileSync(contextPath, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('current_repo='));
  lines.push(`current_repo=${repoPath}`);
  fs.writeFileSync(contextPath, `${lines.join('\n')}\n`, 'utf8');
}

function lookupNamespacePath(configPath = DEFAULT_CONFIG_PATH, namespace) {
  validateNamespace(namespace);
  const config = readNamespaceConfig(configPath);
  const entry = config.namespaces.find((item) => item.name === namespace);
  return entry ? entry.path : '';
}

function setNamespace(configPath = DEFAULT_CONFIG_PATH, namespace, basePath) {
  validateNamespace(namespace);
  const normalizedPath = normalizeNamespacePath(basePath);
  ensureConfigFile(configPath);
  const lines = fs
    .readFileSync(configPath, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith(`${namespace}=`));
  lines.push(`${namespace}=${normalizedPath}`);
  fs.writeFileSync(configPath, `${lines.join('\n')}\n`, 'utf8');
  return normalizedPath;
}

function setDefaultNamespace(configPath = DEFAULT_CONFIG_PATH, namespace) {
  validateNamespace(namespace);
  if (!lookupNamespacePath(configPath, namespace)) {
    throw new Error(`namespace '${namespace}' is not configured`);
  }
  ensureConfigFile(configPath);
  const lines = fs
    .readFileSync(configPath, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('default_namespace='));
  lines.push(`default_namespace=${namespace}`);
  fs.writeFileSync(configPath, `${lines.join('\n')}\n`, 'utf8');
}

function resolveRepoPath(configPath = DEFAULT_CONFIG_PATH, repoRef, namespace = '') {
  if (path.isAbsolute(repoRef)) {
    return repoRef;
  }

  if (namespace) {
    const basePath = lookupNamespacePath(configPath, namespace);
    if (!basePath) {
      throw new Error(`namespace '${namespace}' is not configured. Config file: ${configPath}`);
    }
    return path.join(basePath, repoRef);
  }

  if (repoRef.includes('/')) {
    const [candidateNamespace, ...rest] = repoRef.split('/');
    const basePath = lookupNamespacePath(configPath, candidateNamespace);
    if (basePath) {
      return path.join(basePath, rest.join('/'));
    }
  }

  const config = readNamespaceConfig(configPath);
  if (!config.defaultNamespace) {
    throw new Error(`no namespace selected. Run 'wiki setup work /data/wiki/work' first.`);
  }
  const basePath = lookupNamespacePath(configPath, config.defaultNamespace);
  if (!basePath) {
    throw new Error(`default namespace '${config.defaultNamespace}' is not configured. Config file: ${configPath}`);
  }
  return path.join(basePath, repoRef);
}

function findRepoRoot(startDir) {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(currentDir, '.wiki'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return '';
    }
    currentDir = parentDir;
  }
}

function ensureRepoRoot(candidate) {
  if (!candidate) {
    return '';
  }
  const resolved = path.resolve(candidate);
  if (!fs.existsSync(path.join(resolved, '.wiki'))) {
    throw new Error(`not a wiki repository: ${resolved}`);
  }
  return resolved;
}

function resolveRepoRoot(configPath = DEFAULT_CONFIG_PATH, repoOverride = '') {
  if (repoOverride) {
    return ensureRepoRoot(repoOverride);
  }

  const fromCwd = findRepoRoot(process.cwd());
  if (fromCwd) {
    return fromCwd;
  }

  const currentRepo = readCurrentRepo(configPath);
  if (currentRepo && fs.existsSync(path.join(currentRepo, '.wiki'))) {
    return currentRepo;
  }

  return '';
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  ensureConfigFile,
  ensureContextFile,
  getContextPath,
  readNamespaceConfig,
  readCurrentRepo,
  setCurrentRepo,
  lookupNamespacePath,
  setNamespace,
  setDefaultNamespace,
  resolveRepoPath,
  normalizeNamespacePath,
  findRepoRoot,
  ensureRepoRoot,
  resolveRepoRoot,
};
