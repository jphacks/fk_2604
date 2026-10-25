/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile the real server modules with explicit external service doubles. No
// credentials, running Next instance or shared database is used by these tests.
exports.loader = function loader(mocks = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const record = { exports: {} };
    cache.set(filename, record);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    function localRequire(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/')) return load(path.join('src', id.slice(2)) + '.ts');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id) + (id.endsWith('.ts') ? '' : '.ts'));
      return require(id);
    }
    new Function('require', 'module', 'exports', code)(localRequire, record, record.exports);
    return record.exports;
  }
  return load;
};
