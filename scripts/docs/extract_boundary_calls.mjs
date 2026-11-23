#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;
const args = process.argv.slice(2);
let root, output;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i]);
  else if (args[i] === '--output' && args[i + 1]) output = path.resolve(args[++i]);
  else throw new Error('Usage: node scripts/docs/extract_boundary_calls.mjs --root PATH [--output PATH]');
}
if (!root) throw new Error('--root is required');

const tracked = execFileSync('/usr/bin/git', ['-C', root, 'ls-files', '-z'], {
  encoding: 'utf8',
}).split('\0').filter(Boolean).sort();
const workspaces = tracked.filter(p => p.endsWith('/package.json') && /^(?:packages|services|ui-shells)\//.test(p)).map(p => {
  try { return { dir: path.posix.dirname(p), name: JSON.parse(readFileSync(path.join(root, p), 'utf8')).name }; }
  catch { return null; }
}).filter(p => p?.name).sort((a, b) => b.dir.length - a.dir.length || a.dir.localeCompare(b.dir));
const packages = new Map(workspaces.map(w => [w.name, w]));
const files = new Map();
const gaps = [];
const calls = [];
const exposes = [];
const uses = [];
const loc = (file, node) => ({ path: file, line: node?.loc?.start.line ?? 1 });
const gap = (file, node, reason) => gaps.push({ source: loc(file, node), reason });
const excludedDir = /(^|\/)(?:node_modules|dist|build|coverage|generated|__generated__|__tests__|test|tests|pacts|fixtures|storybook-static)(?:\/|$)/i;
const excludedName = /(^|[./_-])(?:test|spec|stories|generated|fixture|fixtures)(?:[./_-]|$)/i;
const excludedDeclaration = /\.d\.ts$/i;
const isExcluded = p => excludedDir.test(p) || excludedName.test(p) || excludedDeclaration.test(p);
const owns = (w, p) => p.startsWith(`${w.dir}/`);
const sourceFiles = tracked.filter(p => /\.(?:[cm]?[jt]sx?)$/.test(p) && !isExcluded(p) && workspaces.some(w => owns(w, p)));

function addConstructorParameterFields(member, fields) {
  for (const param of member.get('params')) {
    if (!param.isTSParameterProperty()) continue;
    const value = param.get('parameter');
    if (value.isIdentifier()) fields.set(value.node.name, value);
  }
}

function collectClassFields(p) {
  const fields = new Map();
  for (const member of p.get('body.body')) {
    if (member.isClassProperty() && member.node.key.type === 'Identifier') fields.set(member.node.key.name, member);
    if (member.isClassMethod({ kind: 'constructor' })) addConstructorParameterFields(member, fields);
  }
  return fields;
}

for (const file of sourceFiles) {
  const component = workspaces.find(w => owns(w, file)).name;
  try {
    const ast = parse(readFileSync(path.join(root, file), 'utf8'), {
      sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });
    const data = { file, component, ast, imports: new Map(), exports: new Map(), stars: [], bindings: new Map(), classes: new Map() };
    traverse(ast, {
      Program(p) {
        for (const [name, binding] of Object.entries(p.scope.bindings)) data.bindings.set(name, binding.path);
      },
      ImportDeclaration(p) {
        for (const s of p.node.specifiers) {
          let imported;
          if (s.type === 'ImportDefaultSpecifier') imported = 'default';
          else if (s.type === 'ImportNamespaceSpecifier') imported = '*';
          else imported = s.imported.name ?? s.imported.value;
          data.imports.set(s.local.name, {
            source: p.node.source.value,
            imported,
          });
        }
      },
      ExportNamedDeclaration(p) {
        const n = p.node;
        if (n.declaration) {
          if (n.declaration.id) data.exports.set(n.declaration.id.name, { local: n.declaration.id.name });
          for (const d of n.declaration.declarations ?? []) if (d.id.type === 'Identifier') data.exports.set(d.id.name, { local: d.id.name });
        }
        for (const s of n.specifiers) data.exports.set(s.exported.name ?? s.exported.value, n.source
          ? { source: n.source.value, imported: s.local.name ?? s.local.value }
          : { local: s.local.name ?? s.local.value });
      },
      ExportAllDeclaration(p) { data.stars.push(p.node.source.value); },
      ExportDefaultDeclaration(p) {
        if (p.node.declaration.type === 'Identifier') data.exports.set('default', { local: p.node.declaration.name });
      },
      Class(p) {
        data.classes.set(p.node, collectClassFields(p));
      },
    });
    files.set(file, data);
  } catch {
    gap(file, null, 'Source could not be parsed');
  }
}

function resolveFile(from, spec) {
  let base;
  if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else {
    const w = [...packages.values()].find(x => spec === x.name || spec.startsWith(`${x.name}/`));
    if (!w) return null;
    base = spec === w.name ? `${w.dir}/src/index` : `${w.dir}/src/${spec.slice(w.name.length + 1)}`;
  }
  const bare = base.replace(/\.(?:mjs|cjs|js|jsx)$/, '');
  return [base, ...['.ts', '.tsx', '.js', '.jsx', '.mjs'].map(x => bare + x), ...['/index.ts', '/index.tsx', '/index.js'].map(x => bare + x)].find(x => files.has(x)) ?? null;
}
function exported(file, name, seen = new Set()) {
  const key = `${file}:${name}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const d = files.get(file);
  if (!d) return null;
  const e = d.exports.get(name);
  if (e?.source) return exported(resolveFile(file, e.source), e.imported, seen);
  if (e?.local) {
    const imp = d.imports.get(e.local);
    if (imp) return exported(resolveFile(file, imp.source), imp.imported, seen);
    const p = d.bindings.get(e.local);
    if (p) return { file, path: p };
  }
  for (const s of d.stars) {
    const result = exported(resolveFile(file, s), name, seen);
    if (result) return result;
  }
  return null;
}
const propName = n => {
  if (!n) return null;
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'StringLiteral') return n.value;
  return null;
};
function unwrap(p) {
  while (p?.node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TypeCastExpression', 'ParenthesizedExpression'].includes(p.node.type)) p = p.get('expression');
  return p;
}
function resolveIdentifierPath(p, file, seen) {
  const binding = p.scope.getBinding(p.node.name);
  if (!binding?.constant || seen.has(binding.path.node)) return null;
  seen.add(binding.path.node);

  const imp = files.get(file).imports.get(p.node.name);
  if (imp) {
    const exportedBinding = exported(resolveFile(file, imp.source), imp.imported);
    if (!exportedBinding) return null;
    const path = exportedBinding.path.isVariableDeclarator()
      ? exportedBinding.path.get('init')
      : exportedBinding.path;
    return { file: exportedBinding.file, path };
  }

  if (!binding.path.isVariableDeclarator()) return null;
  return { file, path: binding.path.get('init') };
}

function identifierBindingValue(p, file, seen) {
  const resolved = resolveIdentifierPath(p, file, seen);
  return resolved ? bindingValue(resolved.path, resolved.file, seen) : null;
}

function memberBindingValue(p, file, seen) {
  let obj = unwrap(p.get('object'));

  while (obj?.isIdentifier()) {
    const resolved = resolveIdentifierPath(obj, file, seen);
    if (!resolved) return null;
    file = resolved.file;
    obj = unwrap(resolved.path);
  }

  if (!obj?.isObjectExpression()) return null;
  const name = propName(p.node.property);
  const property = obj.get('properties').find(x =>
    x.isObjectProperty() && propName(x.node.key) === name
  );
  return property ? bindingValue(property.get('value'), file, seen) : null;
}

function bindingValue(p, file, seen = new Set()) {
  p = unwrap(p);
  if (!p?.node) return null;
  if (p.isStringLiteral()) return p.node.value;
  if (p.isTemplateLiteral() && p.node.expressions.length === 0) return p.node.quasis[0].value.cooked;
  if (p.isIdentifier()) return identifierBindingValue(p, file, seen);
  if (p.isMemberExpression() && !p.node.computed) return memberBindingValue(p, file, seen);
  return null;
}
function importInfo(p, file) {
  if (!p?.isIdentifier()) return null;
  const binding = p.scope.getBinding(p.node.name);
  if (!binding || !binding.path.isImportSpecifier() && !binding.path.isImportDefaultSpecifier() && !binding.path.isImportNamespaceSpecifier()) return null;
  return files.get(file).imports.get(p.node.name) ?? null;
}
function typeKind(p, file) {
  if (!p?.node) return null;
  let found = null;
  const check = q => {
    if (!q.isIdentifier()) return;
    const imp = importInfo(q, file);
    if (!imp) return;
    if (imp.source === '@shared/messaging' && imp.imported === 'EventBroker' || imp.source.startsWith('@nats-io/')) found = 'nats';
    else if (['pg', 'mongodb', 'neo4j-driver'].includes(imp.source)) found = 'database';
    else if (imp.source === '@aws-sdk/client-s3' || imp.source === '@shared/filestore') found = 'object-storage';
  };
  check(p);
  p.traverse({ Identifier: check });
  return found;
}
function directImportedKind(imp) {
  if (imp.source === 'axios' && ['default', '*'].includes(imp.imported)) return 'http-client';
  if (['node-fetch', 'cross-fetch'].includes(imp.source) && imp.imported === 'default') return 'http-client';
  if (['http', 'https', 'node:http', 'node:https'].includes(imp.source)) return 'http-client';
  if (imp.source === '@ts-rest/core' && imp.imported === 'initClient') return 'http-factory';
  if (imp.source === '@shared/mf-runtime' && imp.imported === 'lazyRemote') return 'federation';
  if (imp.source === '@module-federation/enhanced/runtime' && imp.imported === 'loadRemote') return 'federation';
  if (imp.source === '@aws-sdk/s3-request-presigner' && imp.imported === 'getSignedUrl') return 'object-storage';
  return null;
}

function importedKindOf(p, file, imp, seen) {
  const directKind = directImportedKind(imp);
  if (directKind) return directKind;
  const e = exported(resolveFile(file, imp.source), imp.imported);
  return e ? kindOf(e.path, e.file, seen) : typeKind(p, file);
}

function memberKindOf(p, file, seen) {
  const object = p.get('object');
  if (!object.isThisExpression() || p.node.computed) return kindOf(object, file, seen);
  const cls = p.findParent(q => q.isClass());
  const field = cls && files.get(file).classes.get(cls.node)?.get(propName(p.node.property));
  return field ? kindOf(field, file, seen) : kindOf(object, file, seen);
}

function identifierKindOf(p, file, seen) {
  const annotation = p.get('typeAnnotation');
  if (annotation?.node) {
    const annotated = typeKind(annotation, file);
    if (annotated) return annotated;
  }
  const binding = p.scope.getBinding(p.node.name);
  if (!binding) return null;
  const fn = binding.path.findParent(q => q.isFunction());
  if (fn?.get('params').some(param => param.node === binding.path.node)) {
    const parent = fn.parentPath;
    if (parent?.isCallExpression() && parent.get('callee').isMemberExpression()
      && ['executeRead', 'executeWrite', 'readTransaction', 'writeTransaction'].includes(propName(parent.node.callee.property))
      && kindOf(parent.get('callee.object'), file, seen) === 'database') return 'database';
  }
  const imp = importInfo(p, file);
  if (imp) return importedKindOf(p, file, imp, seen);
  if (binding.path.node !== p.node) return kindOf(binding.path, file, seen);
  return annotation?.node ? typeKind(annotation, file) : null;
}

function declarationKindOf(p, file, seen) {
  const declarator = p.isVariableDeclarator();
  const annotation = declarator ? p.get('id.typeAnnotation') : p.get('typeAnnotation');
  const init = declarator ? p.get('init') : p.get('value');
  const annotatedKind = annotation?.node && typeKind(annotation, file);
  return annotatedKind || kindOf(init, file, seen);
}

function callKindOf(p, file, seen) {
  const k = kindOf(p.get('callee'), file, seen);
  if (k === 'http-factory') return 'http';
  if (k === 'http-client' && p.get('callee').isMemberExpression() && propName(p.node.callee.property) === 'create') return 'http-client';
  if (k === 'database') return 'database';
  return null;
}

function kindOf(p, file, seen = new Set()) {
  p = unwrap(p);
  if (!p?.node || seen.has(p.node) || p.isThisExpression()) return null;
  seen.add(p.node);
  if (p.isMemberExpression()) return memberKindOf(p, file, seen);
  if (p.isIdentifier()) return identifierKindOf(p, file, seen);
  if (p.isTSParameterProperty()) return kindOf(p.get('parameter'), file, seen);
  if (p.isVariableDeclarator() || p.isClassProperty()) return declarationKindOf(p, file, seen);
  if (p.isNewExpression()) return typeKind(p.get('callee'), file) || kindOf(p.get('callee'), file, seen);
  if (p.isCallExpression()) return callKindOf(p, file, seen);
  if (p.isAwaitExpression()) return kindOf(p.get('argument'), file, seen);
  return null;
}
function declaredFunctionName(q) {
  if (q.node.id?.name) return q.node.id.name;
  if (q.isClassMethod() || q.isObjectMethod()) return propName(q.node.key);
  if (q.parentPath?.isVariableDeclarator()) return propName(q.parentPath.node.id);
  if (q.parentPath?.isObjectProperty()) return propName(q.parentPath.node.key);
  return null;
}

function hookDetails(callee) {
  let binding, hook;
  if (callee.isIdentifier()) {
    binding = callee.scope.getBinding(callee.node.name);
    if (binding?.path.isImportSpecifier()) hook = propName(binding.path.node.imported);
  } else if (callee.isMemberExpression() && !callee.node.computed && callee.get('object').isIdentifier()) {
    const object = callee.get('object');
    binding = object.scope.getBinding(object.node.name);
    if (binding?.path.isImportDefaultSpecifier() || binding?.path.isImportNamespaceSpecifier()) {
      hook = propName(callee.node.property);
    }
  }
  return { binding, hook };
}

function reactHookVariableName(q) {
  const call = q.parentPath;
  if (!call?.isCallExpression() || q.listKey !== 'arguments' || q.key !== 0) return null;
  const { binding, hook } = hookDetails(call.get('callee'));
  if (!['useCallback', 'useMemo'].includes(hook) || binding?.path.parentPath.node.source.value !== 'react') return null;
  const declaration = call.parentPath;
  if (!declaration.isVariableDeclarator() || !declaration.get('id').isIdentifier()) return null;
  return declaration.node.id.name;
}

function pathFunctionName(q) {
  return declaredFunctionName(q) || reactHookVariableName(q) || `callback@${q.node.loc.start.line}`;
}

function qualifiedFunctionName(q, name) {
  const cls = q.findParent(x => x.isClass());
  if ((q.isClassMethod() || q.parentPath?.isClassProperty()) && cls?.node.id?.name) {
    return `${cls.node.id.name}.${name}`;
  }
  return name;
}

function functionName(p) {
  const parts = [];
  for (let q = p; q; q = q.parentPath) {
    if (!q.isFunction()) continue;
    parts.unshift(qualifiedFunctionName(q, pathFunctionName(q)));
  }
  return parts.join(' > ') || '<module>';
}
function safeExpression(p) {
  p = unwrap(p);
  if (!p?.node) return '<dynamic>';
  if (p.isIdentifier()) return p.node.name;
  if (p.isThisExpression()) return 'this';
  if (p.isMemberExpression() && !p.node.computed) {
    const object = safeExpression(p.get('object'));
    if (object !== '<dynamic>') return `${object}.${propName(p.node.property)}`;
  }
  return p.isStringLiteral() ? '<literal>' : '<dynamic>';
}
function safeChannel(value, kind) {
  if (typeof value !== 'string' || value.length > 200) return null;
  if (/(?:password|passwd|secret|credential|api[_-]?key|access[_-]?token|signature)/i.test(value)) return null;
  if (value.split(/[./]/).some(part => part.length > 64)) return null;
  if (kind === 'http') return /^\/[a-zA-Z0-9_./:{}-]*$/.test(value) && !value.startsWith('//') ? value : null;
  return /^[a-zA-Z0-9_*>-]+(?:\.[a-zA-Z0-9_*>-]+)*$/.test(value) ? value : null;
}
function contractNames(file) {
  return [...new Set([...files.get(file).imports.values()].map(x => x.source).filter(x => packages.has(x) && (x.startsWith('@contracts/') || x.endsWith('-shared'))))].sort((a, b) => a.length - b.length || a.localeCompare(b));
}
function databaseTarget(component) {
  return null;
}
const NATS_METHOD_KINDS = new Map([
  ['request', 'nats-request'], ['respond', 'nats-responder'],
  ['publish', 'nats-publish'], ['subscribe', 'nats-subscribe'],
]);
const DATABASE_METHODS = new Set(['query', 'run', 'collection', 'command', 'connect', 'executeRead', 'executeWrite']);
const OBJECT_STORAGE_METHODS = new Set(['send', 'uploadFile', 'getFileStream', 'getSignedDownloadUrl']);

function boundaryCall(callee, member, method, receiver, kind, target, channelPath) {
  return { kind, target, channelPath, callee, member, method, receiver };
}

function classifyDirectBoundaryCall(p, callee, member, method, receiver, direct) {
  if (direct === 'http-client' && !member) {
    return boundaryCall(callee, member, method, receiver, 'http', null, p.get('arguments.0'));
  }
  if (direct === 'federation' && !member) {
    return boundaryCall(callee, member, method, receiver, 'federation', null, p.get('arguments.0'));
  }
  if (direct === 'object-storage' && !member) {
    return boundaryCall(callee, member, method, receiver, 'object-storage', null, null);
  }
  return null;
}

function classifyReceiverBoundaryCall(p, callee, member, method, receiver, receiverKind) {
  if (receiverKind === 'http-client' && ['request', 'get', 'post', 'put', 'patch', 'delete', 'head'].includes(method)) {
    return boundaryCall(callee, member, method, receiver, 'http', null, p.get('arguments.0'));
  }
  if (receiverKind === 'nats' && NATS_METHOD_KINDS.has(method)) {
    const subjectIndex = method === 'subscribe' && p.node.arguments.length >= 3 ? 3 : 0;
    return boundaryCall(callee, member, method, receiver, NATS_METHOD_KINDS.get(method), 'nats', p.get(`arguments.${subjectIndex}`));
  }
  if (receiverKind === 'http') {
    return boundaryCall(callee, member, method, receiver, 'http', null, p.get('arguments.0'));
  }
  if (receiverKind === 'database' && DATABASE_METHODS.has(method)) {
    return boundaryCall(callee, member, method, receiver, 'database', null, null);
  }
  if (receiverKind === 'object-storage' && OBJECT_STORAGE_METHODS.has(method)) {
    return boundaryCall(callee, member, method, receiver, 'object-storage', null, null);
  }
  return null;
}

function classifyBoundaryCall(p, file) {
  const callee = p.get('callee');
  const member = callee.isMemberExpression() && !callee.node.computed;
  const method = member ? propName(callee.node.property) : null;
  const receiver = member ? callee.get('object') : null;
  const direct = kindOf(callee, file);
  const receiverKind = receiver ? kindOf(receiver, file) : null;

  if (callee.isIdentifier({ name: 'fetch' }) && !callee.scope.getBinding('fetch')) {
    return boundaryCall(callee, member, method, receiver, 'http', null, p.get('arguments.0'));
  }

  const directCall = classifyDirectBoundaryCall(p, callee, member, method, receiver, direct);
  if (directCall) return directCall;

  return classifyReceiverBoundaryCall(p, callee, member, method, receiver, receiverKind);
}

function channelFor(call, kind, file) {
  if (!call.channelPath) return null;
  const value = bindingValue(call.channelPath, file);
  const channelKind = kind === 'http' ? 'http' : 'nats';
  return {
    expression: safeExpression(call.channelPath),
    value: safeChannel(value, channelKind),
  };
}

function apiClientIdentifierInfo(p, file, seen) {
  const imp = importInfo(p, file);
  if (imp) {
    const e = exported(resolveFile(file, imp.source), imp.imported);
    return e ? apiClientInfo(e.path, e.file, seen) : null;
  }
  const binding = p.scope.getBinding(p.node.name);
  return binding && binding.path.node !== p.node ? apiClientInfo(binding.path, file, seen) : null;
}

function apiClientInfo(p, file, seen = new Set()) {
  p = unwrap(p);
  if (!p?.node || seen.has(p.node)) return null;
  seen.add(p.node);
  if (p.isIdentifier()) {
    return apiClientIdentifierInfo(p, file, seen);
  }
  if (p.isVariableDeclarator()) return apiClientInfo(p.get('init'), file, seen);
  if (!p.isCallExpression() || kindOf(p.get('callee'), file) !== 'http-factory') return null;
  const imp = importInfo(p.get('arguments.0'), file);
  const options = p.get('arguments.1');
  const base = options?.isObjectExpression() && options.get('properties').find(x => x.isObjectProperty() && propName(x.node.key) === 'baseUrl');
  return { contract: imp && packages.has(imp.source) ? imp.source : null, contractFile: file, contractPath: p.get('arguments.0'), base: base ? bindingValue(base.get('value'), file) : null };
}
function apiRouteIdentifier(p, file, method, seen) {
  const resolved = resolveIdentifierPath(p, file, new Set());
  return resolved ? apiRoute(resolved.path, resolved.file, method, seen) : null;
}

function apiRouteRouterCall(p, file, method, seen) {
  const callee = p.get('callee');
  return callee.isMemberExpression() && propName(callee.node.property) === 'router'
    ? apiRoute(p.get('arguments.0'), file, method, seen)
    : null;
}

function isTsRestRouteCall(v, file) {
  if (!v.isCallExpression() || !v.get('callee').isMemberExpression()) return false;
  const callee = v.get('callee');
  if (!['query', 'mutation'].includes(propName(callee.node.property))) return false;
  const receiver = callee.get('object');
  if (!receiver.isIdentifier()) return false;
  const binding = receiver.scope.getBinding(receiver.node.name);
  const init = binding?.path.isVariableDeclarator() && binding.path.get('init');
  if (!init?.isCallExpression()) return false;
  const imp = importInfo(init.get('callee'), file);
  return imp?.source === '@ts-rest/core' && imp.imported === 'initContract';
}

function tsRestRoutePath(v, file) {
  if (!isTsRestRouteCall(v, file)) return null;
  const opts = v.get('arguments.0');
  if (!opts?.isObjectExpression()) return null;
  const route = opts.get('properties').find(x =>
    x.isObjectProperty() && propName(x.node.key) === 'path'
  );
  return route ? bindingValue(route.get('value'), file) : null;
}

function isApiRouteProperty(prop, method) {
  return prop.isObjectProperty()
    && !prop.node.computed
    && propName(prop.node.key) === method;
}

function apiRoutePropertyMatches(p, file, method, seen) {
  const matches = [];
  for (const prop of p.get('properties')) {
    if (prop.isSpreadElement()) {
      const result = apiRoute(prop.get('argument'), file, method, seen);
      if (result) matches.push(result);
    } else if (isApiRouteProperty(prop, method)) {
      const value = tsRestRoutePath(prop.get('value'), file);
      if (value) matches.push(value);
    }
  }
  return matches;
}

function apiRoute(p, file, method, seen = new Set()) {
  p = unwrap(p);
  if (!p?.node || seen.has(p.node)) return null;
  seen.add(p.node);

  if (p.isIdentifier()) return apiRouteIdentifier(p, file, method, seen);
  if (p.isCallExpression()) {
    const result = apiRouteRouterCall(p, file, method, seen);
    if (result) return result;
  }
  if (!p.isObjectExpression()) return null;

  const matches = apiRoutePropertyMatches(p, file, method, seen);
  return matches.length === 1 ? matches[0] : null;
}

function callIsUnresolved(kind, channel, value, target) {
  if (channel?.value === null) return true;
  if (kind === 'federation') return typeof value !== 'string' || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_/-]+$/.test(value);
  if (kind === 'http') return !channel || !target;
  if (kind === 'database') return !target;
  if (kind === 'object-storage') return !target;
  return false;
}

function compareContracts(a, b) {
  return a.length - b.length || a.localeCompare(b);
}

function prepareHttpBoundary(call, file, component, state) {
  if (call.kind !== 'http' || !call.receiver || kindOf(call.receiver, file) !== 'http') return;
  const api = apiClientInfo(call.receiver, file);
  if (api?.contract) state.contracts = [...new Set([...state.contracts, api.contract])].sort(compareContracts);
  const route = api && apiRoute(api.contractPath, api.contractFile, call.method);
  const full = api?.base && route && safeChannel(`${api.base}${route}`, 'http');
  state.channel = { expression: call.method, value: full || null };
}

function recordFederationBoundary(p, file, component, value) {
  if (typeof value === 'string' && /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_/-]+$/.test(value)) {
    const [remote, ...rest] = value.split('/');
    uses.push({ component, remote, module: rest.join('/'), function: functionName(p), source: loc(file, p.node) });
    return;
  }
  gap(file, p.node, 'Dynamic or unsupported federation module');
}

function reportBoundaryChannelGap(call, p, file, channel) {
  if (call.kind !== 'federation' && channel?.value === null) {
    gap(file, p.node, `Dynamic or unsafe ${call.kind} destination`);
  }
}

function createBoundaryCall(p, file, component) {
  const call = classifyBoundaryCall(p, file);
  if (!call) return null;

  const value = call.channelPath?.node ? bindingValue(call.channelPath, file) : null;
  const state = {
    target: call.target || (call.kind === 'database' ? databaseTarget(component) : null),
    channel: channelFor(call, call.kind, file),
    contracts: contractNames(file),
  };
  prepareHttpBoundary(call, file, component, state);
  if (call.kind === 'federation') {
    recordFederationBoundary(p, file, component, value);
    state.channel = null;
  }
  reportBoundaryChannelGap(call, p, file, state.channel);

  const record = {
    id: createHash('sha256').update(`${file}:${p.node.start}:${call.kind}`).digest('hex').slice(0, 20),
    component, kind: call.kind, role: 'boundary', source: loc(file, p.node), function: functionName(p),
    callee: call.member ? `${safeExpression(call.receiver)}.${call.method}` : safeExpression(call.callee),
    target: state.target, channel: state.channel, contracts: state.contracts,
    status: callIsUnresolved(call.kind, state.channel, value, state.target) ? 'unresolved' : 'verified',
    callers: [],
  };
  if (call.kind === 'http' && !state.target) gap(file, p.node, 'HTTP target cannot be proven from the call');
  if ((call.kind === 'database' || call.kind === 'object-storage') && !state.target) gap(file, p.node, `${call.kind} target cannot be proven from the call`);
  return record;
}

function isFederationConfigCall(callee, file) {
  const imp = importInfo(callee, file);
  if (!imp) return false;
  if (imp.imported === 'createRemoteConfig' && imp.source === '@shared/vite-config') return true;
  return imp.imported === 'federation' && imp.source === '@module-federation/vite';
}

function addFederationExposes(file, component, p) {
  const config = p.get('arguments.0');
  if (!config?.isObjectExpression()) {
    gap(file, p.node, 'Dynamic federation configuration');
    return;
  }

  const props = config.get('properties').filter(x => x.isObjectProperty());
  const get = name => props.find(x => propName(x.node.key) === name)?.get('value');
  const domain = get('domain') && bindingValue(get('domain'), file);
  const concern = get('concern') && bindingValue(get('concern'), file);
  const remote = (get('name') && bindingValue(get('name'), file)) || (domain && concern ? `${domain}_${concern}` : null);
  const exp = get('exposes');
  if (!exp) return;
  if (!remote || !exp.isObjectExpression()) {
    gap(file, p.node, 'Dynamic federation exposes');
    return;
  }

  for (const e of exp.get('properties')) {
    if (!e.isObjectProperty() || e.node.computed) {
      gap(file, e.node, 'Dynamic federation exposure');
      continue;
    }
    const module = propName(e.node.key)?.replace(/^\.\//, '');
    const spec = bindingValue(e.get('value'), file);
    const impl = spec?.startsWith('./') ? resolveFile(file, spec) : null;
    if (!module || !impl) {
      gap(file, e.node, 'Unresolved federation exposure implementation');
      continue;
    }
    exposes.push({ component, remote, module, implementation: impl, source: loc(file, e.node) });
  }
}

const rawCalls = [];
const wrappedCalls = [];
for (const [file, d] of files) {
  traverse(d.ast, {
    CallExpression(p) {
      const record = createBoundaryCall(p, file, d.component);
      if (record) rawCalls.push({ record, path: p, file });
    },
  });
  traverse(d.ast, {
    CallExpression(p) {
      if (isFederationConfigCall(p.get('callee'), file)) {
        addFederationExposes(file, d.component, p);
      }
    },
  });
}

// Find direct local calls to the named enclosing function/method, without inferring a runtime graph.
for (const item of rawCalls) {
  const fn = item.path.getFunctionParent();
  if (!fn) continue;
  let owner = fn;
  while (owner && !(owner.node.id?.name || owner.isClassMethod() || owner.parentPath?.isVariableDeclarator())) owner = owner.findParent(p => p.isFunction());
  if (!owner) continue;
  const name = owner.node.id?.name ?? (owner.isClassMethod() ? propName(owner.node.key) : propName(owner.parentPath.node.id));
  if (!name) continue;
  const ownerClass = owner.isClassMethod() ? owner.findParent(p => p.isClass()) : null;
  const boundary = classifyBoundaryCall(item.path, item.file);
  const subject = boundary?.channelPath;
  const parameterIndex = subject?.isIdentifier()
    ? owner.get('params').findIndex(param => param.isIdentifier({ name: subject.node.name }) && subject.scope.getBinding(subject.node.name)?.path.node === param.node)
    : -1;
  traverse(files.get(item.file).ast, {
    CallExpression(p) {
      const c = p.get('callee');
      const ownerBindingPath = owner.isFunctionDeclaration() ? owner.node : owner.parentPath.node;
      const matches = ownerClass
        ? c.isMemberExpression() && c.get('object').isThisExpression() && propName(c.node.property) === name && p.findParent(x => x.isClass())?.node === ownerClass.node
        : c.isIdentifier({ name }) && c.scope.getBinding(name)?.path.node === ownerBindingPath;
      if (!matches || p.findParent(x => x.node === owner.node)) return;
      item.record.callers.push({ function: functionName(p), source: loc(item.file, p.node) });
      if (parameterIndex < 0 || !item.record.kind.startsWith('nats-')) return;
      const arg = p.get(`arguments.${parameterIndex}`);
      const value = safeChannel(bindingValue(arg, item.file), 'nats');
      if (!value) return;
      wrappedCalls.push({
        ...item.record,
        id: createHash('sha256').update(`${item.record.id}:${p.node.start}`).digest('hex').slice(0, 20),
        role: 'wrapper', source: loc(item.file, p.node), function: functionName(p), callee: safeExpression(c),
        channel: { expression: safeExpression(arg), value }, status: 'verified', callers: [],
      });
    },
  });
}
calls.push(...rawCalls.map(x => x.record), ...wrappedCalls);
for (const call of calls.filter(c => c.kind === 'federation' && c.status === 'verified')) {
  const foundUses = uses.filter(u => u.source.path === call.source.path && u.source.line === call.source.line);
  const matched = foundUses.length === 1 ? exposes.filter(e => e.remote === foundUses[0].remote && e.module === foundUses[0].module) : [];
  if (matched.length === 1) call.target = matched[0].component;
  else {
    call.status = 'unresolved';
    gap(call.source.path, { loc: { start: { line: call.source.line } } }, 'Federation exposure target is missing or ambiguous');
  }
}
const order = (a, b) => a.source.path.localeCompare(b.source.path) || a.source.line - b.source.line || JSON.stringify(a).localeCompare(JSON.stringify(b));
for (const list of [calls, exposes, uses, gaps]) list.sort(order);
for (const call of calls) call.callers.sort(order);
const result = { version: 1, calls, federation: { exposes, uses }, gaps: gaps.filter((x, i) => !i || JSON.stringify(x) !== JSON.stringify(gaps[i - 1])) };
const json = `${JSON.stringify(result, null, 2)}\n`;
if (output) writeFileSync(output, json);
else process.stdout.write(json);
