import test from 'node:test';
import assert from 'node:assert/strict';

import { getDetailModalState } from './detailModalState.js';

test('getDetailModalState returns error state when API returns a business error payload', () => {
  const state = getDetailModalState({
    success: true,
    data: {
      error: 'Failed after max retries'
    }
  });

  assert.deepEqual(state, {
    status: 'error',
    message: 'Failed after max retries'
  });
});

test('getDetailModalState returns empty state when API succeeds without any detail sections', () => {
  const state = getDetailModalState({
    success: true,
    data: {}
  });

  assert.deepEqual(state, {
    status: 'empty',
    message: '暂无可展示的设备详情'
  });
});
