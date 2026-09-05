import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GEMINI_MODEL,
  normalizeGeminiModel,
  validateGeminiApiKey
} from '../src/utils/gemini.js';

test('removed Gemini models migrate to the supported default', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.6-flash');
  assert.equal(normalizeGeminiModel('gemini-1.5-flash'), 'gemini-3.6-flash');
  assert.equal(normalizeGeminiModel('gemini-2.0-flash'), 'gemini-3.6-flash');
});

test('API key validation reports a successful Gemini connection', async () => {
  const fetchImpl = async (url, options) => {
    assert.match(url, /models\/gemini-3\.6-flash:generateContent/);
    assert.equal(options.method, 'POST');
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'OK' }] } }]
      })
    };
  };

  const result = await validateGeminiApiKey({
    apiKey: 'test-key',
    model: 'gemini-3.6-flash',
    fetchImpl
  });

  assert.deepEqual(result, { ok: true, message: 'API Key 連線成功' });
});

test('API key validation translates a removed-model response', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    json: async () => ({
      error: { message: 'This model is no longer available.' }
    })
  });

  const result = await validateGeminiApiKey({
    apiKey: 'test-key',
    model: 'gemini-2.0-flash',
    fetchImpl
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /模型已停用/);
});
