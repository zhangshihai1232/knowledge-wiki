'use strict';

const path = require('path');
const { assertSupportedNode } = require('./lib/runtime-requirements');
const {
  DEFAULT_CONFIG_PATH,
  ensureConfigFile,
  lookupNamespacePath,
  setDefaultNamespace,
  setNamespace,
} = require('./lib/config');
const { listNamespaces, printNamespaceStatus, scaffoldRepo } = require('./lib/bootstrap');

const COMMAND_NAME = process.env.BOOTSTRAP_COMMAND_NAME || path.basename(process.argv[1] || 'bootstrap-wiki-repo.sh');

assertSupportedNode(COMMAND_NAME);

function die(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  ${COMMAND_NAME} TARGET_DIR [--name REPO_NAME] [--namespace NAME] [--config PATH] [--force]
  ${COMMAND_NAME} --setup NAME BASE_PATH [--config PATH]
  ${COMMAND_NAME} --set-namespace NAME BASE_PATH [--config PATH]
  ${COMMAND_NAME} --set-default-namespace NAME [--config PATH]
  ${COMMAND_NAME} --status [--config PATH]
  ${COMMAND_NAME} --list-namespaces [--config PATH]
  ${COMMAND_NAME} --show-config [--config PATH]
  ${COMMAND_NAME} --guide [--config PATH]`);
}

function printGuide(configPath) {
  console.log(`Minimal mental model:
  1. Remember one command: ${COMMAND_NAME}
  2. Run one setup command once
  3. After that, daily usage is just one command + one repo name

Recommended flow:
  ${COMMAND_NAME} --setup work /data/wiki/work
  ${COMMAND_NAME} my-new-repo --name "My New Wiki"

Useful checks:
  ${COMMAND_NAME} --status
  ${COMMAND_NAME} --list-namespaces
  ${COMMAND_NAME} --show-config

After the repo is created, the main knowledge distillation flow is inside the repo:
  /wiki 请吸收这段资料
  /wiki 帮我整理这批知识并补缺口
  /wiki 这个结论的依据是什么？请展开细节

Config file:
  ${configPath}`);
}

function run(argv = process.argv.slice(2)) {
  let configPath = DEFAULT_CONFIG_PATH;
  const args = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--config') {
      if (index + 1 >= argv.length) {
        die('--config requires a value');
      }
      configPath = argv[index + 1];
      index += 1;
      continue;
    }
    args.push(argv[index]);
  }

  ensureConfigFile(configPath);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    usage();
    return;
  }

  const repoRoot = path.resolve(__dirname, '..');
  const first = args[0];

  try {
    if (first === '--show-config') {
      console.log(configPath);
      return;
    }
    if (first === '--guide') {
      printGuide(configPath);
      return;
    }
    if (first === '--status') {
      console.log(printNamespaceStatus(configPath));
      return;
    }
    if (first === '--list-namespaces') {
      console.log(listNamespaces(configPath));
      return;
    }
    if (first === '--setup') {
      if (!args[1] || !args[2]) {
        die('--setup requires NAME and BASE_PATH');
      }
      setNamespace(configPath, args[1], args[2]);
      setDefaultNamespace(configPath, args[1]);
      console.log(`Setup complete: ${args[1]}=${lookupNamespacePath(configPath, args[1])}`);
      console.log(`Default namespace: ${args[1]}`);
      console.log(`Config file: ${configPath}`);
      return;
    }
    if (first === '--set-namespace') {
      if (!args[1] || !args[2]) {
        die('--set-namespace requires NAME and BASE_PATH');
      }
      setNamespace(configPath, args[1], args[2]);
      console.log(`Configured namespace: ${args[1]}=${lookupNamespacePath(configPath, args[1])}`);
      console.log(`Config file: ${configPath}`);
      return;
    }
    if (first === '--set-default-namespace') {
      if (!args[1]) {
        die('--set-default-namespace requires NAME');
      }
      setDefaultNamespace(configPath, args[1]);
      console.log(`Configured default namespace: ${args[1]}`);
      console.log(`Config file: ${configPath}`);
      return;
    }

    const targetDir = first;
    let repoName = '';
    let namespace = '';
    let force = false;
    for (let index = 1; index < args.length; index += 1) {
      const token = args[index];
      switch (token) {
        case '--name':
          repoName = args[index + 1] || '';
          index += 1;
          break;
        case '--namespace':
          namespace = args[index + 1] || '';
          index += 1;
          break;
        case '--force':
          force = true;
          break;
        default:
          die(`unknown option: ${token}`);
      }
    }

    const result = scaffoldRepo({ repoRoot, configPath, targetDir, repoName, namespace, force });
    console.log(`Scaffolded new wiki repository at: ${result.targetDir}`);
    console.log('Default entry: /wiki');
    console.log('Repo lifecycle command after global install: wiki');
    console.log('Global install helper: tools/install-global.sh');
    console.log(`Namespace config: ${configPath}`);
  } catch (error) {
    die(error.message);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
