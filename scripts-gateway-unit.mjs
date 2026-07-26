import assert from 'node:assert/strict';
import { onRequest } from './gateway/functions/[[path]].js';

const original = new Request('https://publisher.ein-8.com/api/session?x=1', {
  method: 'POST',
  headers: {
    origin: 'https://publisher.ein-8.com',
    cookie: 'a=b',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ test: true })
});
let received;
const response = await onRequest({
  request: original,
  env: {
    PUBLISHER: {
      async fetch(request) {
        received = request;
        return new Response('proxied', {
          status: 201,
          headers: { 'set-cookie': 'x=y; Secure', 'x-test': 'ok' }
        });
      }
    }
  }
});
assert.equal(received, original, 'gateway must forward the original Request object');
assert.equal(new URL(received.url).hostname, 'publisher.ein-8.com');
assert.equal(received.method, 'POST');
assert.equal(received.headers.get('origin'), 'https://publisher.ein-8.com');
assert.equal(response.status, 201);
assert.equal(response.headers.get('x-test'), 'ok');
assert.equal(await response.text(), 'proxied');
console.log('PASS gateway forwards URL, host, method, headers, body stream and response');
