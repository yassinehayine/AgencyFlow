// Metro configuration for the AgencyFlow monorepo (ADR-0007).
//
// Metro's defaults assume an application at the root of its own repository.
// Two of those assumptions are wrong here, and each produces a failure that
// points somewhere other than its cause.
//
//   1. Metro watches only the project directory. `@agencyflow/contracts` is a
//      SYMLINK into ../../packages, outside that directory, so editing it
//      would either be ignored or crash the bundler on a path it does not
//      believe exists.
//
//   2. Metro resolves modules from the project's own `node_modules`. npm
//      workspaces hoist almost everything to the repository root instead, so
//      `react-native` itself would come back "not found" from a directory
//      where it genuinely is not.
//
// Both are fixed by telling Metro the truth about where the code lives.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// (1) Watch the whole workspace, so a change in `packages/contracts` triggers
// a rebuild here rather than being silently missed.
config.watchFolders = [workspaceRoot];

// (2) Look in the app's own node_modules first, then the hoisted root. Order
// matters: a package installed at both levels must resolve to the app's copy,
// which is what lets mobile pin a version the web does not share.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Do NOT walk up the directory tree looking for more node_modules. With the
// two paths above already declared, hierarchical lookup only adds ways to
// resolve the same package twice — and two copies of React is a runtime error
// about hooks that says nothing about module resolution.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
