import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { Header } from '../src/components/Header.jsx';

function renderHeader(onCommit) {
  return TestRenderer.create(
    <Header
      tripTitle="2026 日本東京自由行 🎌"
      setTripTitle={onCommit}
      currentRate={0.215}
      rateSource="測試"
      refreshRate={async () => {}}
      onOpenOcr={() => {}}
      onOpenMembers={() => {}}
      onOpenAiKey={() => {}}
      hasApiKey={false}
      roomId="TOKYO-2026"
      syncStatus="connected"
      syncError={null}
      onlineCount={1}
      onOpenRoomShare={() => {}}
    />
  );
}

test('editing the trip title commits once after Enter instead of every keystroke', () => {
  const committed = [];
  let renderer;
  act(() => {
    renderer = renderHeader((title) => committed.push(title));
  });

  act(() => renderer.root.findByType('h1').props.onClick());
  const input = renderer.root.findByType('input');

  act(() => input.props.onChange({ target: { value: '2026 日本沖繩自由行 🌺' } }));
  assert.deepEqual(committed, []);

  act(() => input.props.onKeyDown({ key: 'Enter' }));
  assert.deepEqual(committed, ['2026 日本沖繩自由行 🌺']);
});

test('Escape cancels a trip title edit without synchronizing it', () => {
  const committed = [];
  let renderer;
  act(() => {
    renderer = renderHeader((title) => committed.push(title));
  });

  act(() => renderer.root.findByType('h1').props.onClick());
  const input = renderer.root.findByType('input');
  act(() => input.props.onChange({ target: { value: '不要儲存' } }));
  act(() => input.props.onKeyDown({ key: 'Escape' }));

  assert.deepEqual(committed, []);
  assert.equal(renderer.root.findByType('h1').children[0], '2026 日本東京自由行 🎌');
});

test('the scanner shortcut describes both live and photo scanning', () => {
  let renderer;
  act(() => {
    renderer = renderHeader(() => {});
  });

  const shortcut = renderer.root.findAllByType('button')
    .find((button) => button.props.title === '掃描日幣價格並自動換匯');
  assert.ok(shortcut);
});
