import test from 'node:test';
import assert from 'node:assert/strict';

import * as ocr from '../src/utils/ocr.js';

test('live scanning waits for the same price twice before accepting it', () => {
  assert.equal(typeof ocr.updatePriceStability, 'function');

  const first = ocr.updatePriceStability(undefined, [{ amount: 1280 }]);
  assert.deepEqual(first, {
    candidateAmount: 1280,
    consecutiveMatches: 1,
    stableAmount: null
  });

  const second = ocr.updatePriceStability(first, [{ amount: 1280 }]);
  assert.deepEqual(second, {
    candidateAmount: 1280,
    consecutiveMatches: 2,
    stableAmount: 1280
  });
});

test('live scanning resets stability when the detected price changes or disappears', () => {
  assert.equal(typeof ocr.updatePriceStability, 'function');

  const previous = {
    candidateAmount: 1280,
    consecutiveMatches: 1,
    stableAmount: null
  };
  const changed = ocr.updatePriceStability(previous, [{ amount: 980 }]);
  assert.deepEqual(changed, {
    candidateAmount: 980,
    consecutiveMatches: 1,
    stableAmount: null
  });

  assert.deepEqual(ocr.updatePriceStability(changed, []), {
    candidateAmount: null,
    consecutiveMatches: 0,
    stableAmount: null
  });
});

test('live scanning stabilizes every detected price independently', () => {
  assert.equal(typeof ocr.updatePriceCandidatesStability, 'function');

  const first = ocr.updatePriceCandidatesStability([], [
    { amount: 980, label: '¥980' },
    { amount: 500, label: '¥500' }
  ]);
  assert.deepEqual(first, [
    { amount: 980, label: '¥980', consecutiveMatches: 1, isStable: false },
    { amount: 500, label: '¥500', consecutiveMatches: 1, isStable: false }
  ]);

  const second = ocr.updatePriceCandidatesStability(first, [
    { amount: 980, label: '¥980' },
    { amount: 500, label: '¥500' }
  ]);
  assert.deepEqual(second, [
    { amount: 980, label: '¥980', consecutiveMatches: 2, isStable: true },
    { amount: 500, label: '¥500', consecutiveMatches: 2, isStable: true }
  ]);
});

test('a newly appearing price stays pending while previously repeated prices remain stable', () => {
  assert.equal(typeof ocr.updatePriceCandidatesStability, 'function');

  const previous = [
    { amount: 980, consecutiveMatches: 2, isStable: true }
  ];
  const next = ocr.updatePriceCandidatesStability(previous, [
    { amount: 980 },
    { amount: 1280 }
  ]);
  assert.deepEqual(next, [
    { amount: 980, consecutiveMatches: 3, isStable: true },
    { amount: 1280, consecutiveMatches: 1, isStable: false }
  ]);
});

test('live scanning reuses one OCR worker across multiple camera frames', async () => {
  assert.equal(typeof ocr.createPriceScanner, 'function');

  let workerCreations = 0;
  let terminated = false;
  const fakeWorker = {
    recognize: async (source) => ({
      data: { text: source === 'first-frame' ? '¥980' : '¥1,280' }
    }),
    terminate: async () => { terminated = true; }
  };
  const scanner = await ocr.createPriceScanner({
    createWorkerImpl: async () => {
      workerCreations += 1;
      return fakeWorker;
    }
  });

  assert.deepEqual((await scanner.scan('first-frame')).detectedPrices.map((item) => item.amount), [980]);
  assert.deepEqual((await scanner.scan('second-frame')).detectedPrices.map((item) => item.amount), [1280]);
  assert.equal(workerCreations, 1);

  await scanner.terminate();
  assert.equal(terminated, true);
});
