import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AiKeyModal } from '../src/components/AiAssistant/AiKeyModal.jsx';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function textContent(node) {
  if (typeof node === 'string') return node;
  if (!node?.children) return '';
  return node.children.map(textContent).join('');
}

test('an invalid API key stays unsaved and shows the validation error', async () => {
  globalThis.localStorage = new MemoryStorage();
  let saved = false;
  let closed = false;
  let renderer;

  await act(async () => {
    renderer = TestRenderer.create(
      <AiKeyModal
        isOpen
        onClose={() => { closed = true; }}
        onKeySaved={() => { saved = true; }}
        validateKey={async () => ({ ok: false, message: 'API Key 無效，請重新確認。' })}
      />
    );
  });

  const keyInput = renderer.root.findByProps({ type: 'password' });
  await act(async () => {
    keyInput.props.onChange({ target: { value: 'invalid-key' } });
  });

  const saveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('儲存並啟用'));
  await act(async () => {
    await saveButton.props.onClick();
  });

  assert.equal(saved, false);
  assert.equal(closed, false);
  assert.equal(localStorage.getItem('japan_trip_gemini_key'), null);
  assert.ok(renderer.root.findAll((node) => textContent(node) === 'API Key 無效，請重新確認。').length > 0);
});

test('a valid API key is tested with the supported model before it is saved', async () => {
  globalThis.localStorage = new MemoryStorage();
  let validated;
  let saved = false;
  let renderer;

  await act(async () => {
    renderer = TestRenderer.create(
      <AiKeyModal
        isOpen
        onClose={() => {}}
        onKeySaved={() => { saved = true; }}
        validateKey={async (input) => {
          validated = input;
          return { ok: true, message: 'API Key 連線成功' };
        }}
      />
    );
  });

  const keyInput = renderer.root.findByProps({ type: 'password' });
  await act(async () => {
    keyInput.props.onChange({ target: { value: '  valid-key  ' } });
  });

  const saveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('儲存並啟用'));
  await act(async () => {
    await saveButton.props.onClick();
  });

  assert.equal(validated.apiKey, 'valid-key');
  assert.equal(validated.model, 'gemini-3.6-flash');
  assert.equal(localStorage.getItem('japan_trip_gemini_key'), 'valid-key');
  assert.equal(saved, true);
});
