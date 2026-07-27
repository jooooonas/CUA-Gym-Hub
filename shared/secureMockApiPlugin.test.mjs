import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { secureMockApiPlugin } from './secureMockApiPlugin.mjs';

function request(plugin, url, headers = {}) {
  let middleware;
  plugin.configureServer({
    middlewares: {
      use(handler) {
        middleware = handler;
      },
    },
  });

  return new Promise((resolve, reject) => {
    let status;
    let responseHeaders;
    let nextCalled = false;
    const req = { method: 'GET', url, headers: { host: 'localhost', ...headers } };
    const res = {
      writeHead(nextStatus, nextHeaders) {
        status = nextStatus;
        responseHeaders = nextHeaders;
      },
      end(body) {
        resolve({
          status,
          headers: responseHeaders,
          body: JSON.parse(body),
          nextCalled,
        });
      },
    };
    try {
      middleware(req, res, () => {
        nextCalled = true;
        resolve({ status: null, headers: {}, body: null, nextCalled });
      });
    } catch (error) {
      reject(error);
    }
  });
}

test('hardened /state returns the legacy-compatible state envelope', async (t) => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cua-secure-state-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));

  process.env.CUA_GYM_HARDENED = '1';
  process.env.CUA_GYM_ADMIN_TOKEN = 'test-admin-token';
  fs.writeFileSync(
    path.join(stateDir, 'task-123.json'),
    JSON.stringify({ tickets: [{ id: 'T-1', status: 'open' }] }),
  );

  const response = await request(
    secureMockApiPlugin({ stateDir }),
    '/state?sid=task-123',
    { 'x-cua-admin-token': 'test-admin-token' },
  );

  assert.equal(response.status, 200);
  assert.equal(response.nextCalled, false);
  assert.deepEqual(response.body, {
    stored_state: { tickets: [{ id: 'T-1', status: 'open' }] },
    has_custom_state: true,
    sid: 'task-123',
  });
});

test('hardened /state reports an absent session without inventing state', async (t) => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cua-secure-state-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));

  process.env.CUA_GYM_HARDENED = '1';
  process.env.CUA_GYM_ADMIN_TOKEN = 'test-admin-token';

  const response = await request(
    secureMockApiPlugin({ stateDir }),
    '/state?sid=missing',
    { 'x-cua-admin-token': 'test-admin-token' },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    stored_state: null,
    has_custom_state: false,
    sid: 'missing',
  });
});
