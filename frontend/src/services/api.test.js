import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('releaseMobileDevice uses PUT to match backend mobile release route', () => {
  const content = readFileSync(new URL('./api.js', import.meta.url), 'utf8');

  assert.match(
    content,
    /export const releaseMobileDevice = async \(deviceId\) => \{[\s\S]*authAxios\.put\(`\/mobile\/devices\/\$\{deviceId\}\/release`\)/,
  );
});
