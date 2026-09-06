import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { OcrScannerModal } from '../src/components/OcrScannerModal.jsx';

function textContent(node) {
  if (typeof node === 'string') return node;
  if (!node?.children) return '';
  return node.children.map(textContent).join('');
}

test('price scanner starts with separate live scan and photo choices', () => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
      />
    );
  });

  const buttonLabels = renderer.root.findAllByType('button').map(textContent);
  assert.ok(buttonLabels.some((label) => label.includes('立即掃描')));
  assert.ok(buttonLabels.some((label) => label.includes('拍照辨識')));
});

test('choosing live scan requests the rear camera and stops it when closed', async () => {
  let requestedConstraints;
  let stopped = false;
  let scannerTerminated = false;
  const stream = {
    getTracks: () => [{ stop: () => { stopped = true; } }]
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints) => {
          requestedConstraints = constraints;
          return stream;
        }
      }
    }
  });

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        createLiveScanner={async () => ({
          scan: async () => ({ rawText: '', detectedPrices: [] }),
          terminate: async () => { scannerTerminated = true; }
        })}
      />,
      {
        createNodeMock: (element) => {
          if (element.type === 'video') {
            return { srcObject: null, readyState: 0, play: async () => {} };
          }
          if (element.type === 'canvas') {
            return { getContext: () => null };
          }
          return {};
        }
      }
    );
  });

  const liveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('立即掃描'));
  await act(async () => {
    liveButton.props.onClick();
  });

  assert.deepEqual(requestedConstraints, {
    audio: false,
    video: { facingMode: { ideal: 'environment' } }
  });

  await act(async () => {
    renderer.unmount();
  });
  assert.equal(stopped, true);
  assert.equal(scannerTerminated, true);
});

test('a live OCR startup failure releases the camera and offers photo mode', async () => {
  let stopped = false;
  const stream = { getTracks: () => [{ stop: () => { stopped = true; } }] };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } }
  });

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        createLiveScanner={async () => { throw new Error('OCR unavailable'); }}
      />,
      {
        createNodeMock: (element) => element.type === 'video'
          ? { srcObject: null, readyState: 0, play: async () => {} }
          : {}
      }
    );
  });

  const liveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('立即掃描'));
  await act(async () => {
    liveButton.props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(stopped, true);
  assert.ok(renderer.root.findAllByType('button')
    .some((button) => textContent(button).includes('改用拍照辨識')));
  renderer.unmount();
});

test('one live detection cannot be selected before the price is stable', async () => {
  const stream = { getTracks: () => [{ stop: () => {} }] };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } }
  });
  let scanCalls = 0;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        createLiveScanner={async () => ({
          scan: async () => {
            scanCalls += 1;
            if (scanCalls === 1) return { rawText: '¥980', detectedPrices: [{ amount: 980 }] };
            return new Promise(() => {});
          },
          terminate: async () => {}
        })}
      />,
      {
        createNodeMock: (element) => {
          if (element.type === 'video') return { srcObject: null, readyState: 2, videoWidth: 100, videoHeight: 100, play: async () => {} };
          if (element.type === 'canvas') return { getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'frame' };
          return {};
        }
      }
    );
  });

  const liveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('立即掃描'));
  await act(async () => {
    liveButton.props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  const labels = renderer.root.findAllByType('button').map(textContent);
  assert.equal(labels.some((label) => label.includes('NT$ 211')), false);
  assert.equal(labels.some((label) => label.includes('加入帳本')), false);
  assert.equal(renderer.root.findAllByProps({ type: 'number' }).length, 0);
  renderer.unmount();
});

test('closing photo mode terminates an in-progress OCR scan', async () => {
  let scannerTerminated = false;
  globalThis.FileReader = class {
    readAsDataURL() {
      this.onload({ target: { result: 'data:image/jpeg;base64,test' } });
    }
  };

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        createPhotoScanner={async () => ({
          scan: async () => new Promise(() => {}),
          terminate: async () => { scannerTerminated = true; }
        })}
      />
    );
  });

  const photoButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('拍照辨識'));
  await act(async () => photoButton.props.onClick());

  const fileInput = renderer.root.findByProps({ type: 'file' });
  await act(async () => {
    fileInput.props.onChange({ target: { files: [{ name: 'price.jpg' }] } });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const closeButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button) === '關閉');
  await act(async () => closeButton.props.onClick());
  assert.equal(scannerTerminated, true);
  renderer.unmount();
});

test('a changed live price clears the previously accepted amount', async () => {
  const stream = { getTracks: () => [{ stop: () => {} }] };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } }
  });
  let scanCalls = 0;
  let resolveThirdScan;
  const thirdScanSeen = new Promise((resolve) => { resolveThirdScan = resolve; });
  const results = [
    { rawText: '¥980', detectedPrices: [{ amount: 980 }] },
    { rawText: '¥980', detectedPrices: [{ amount: 980 }] },
    { rawText: '¥1,280', detectedPrices: [{ amount: 1280 }] }
  ];

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        liveScanIntervalMs={1}
        createLiveScanner={async () => ({
          scan: async () => {
            scanCalls += 1;
            if (scanCalls === 3) resolveThirdScan();
            return results[scanCalls - 1] || new Promise(() => {});
          },
          terminate: async () => {}
        })}
      />,
      {
        createNodeMock: (element) => {
          if (element.type === 'video') return { srcObject: null, readyState: 2, videoWidth: 100, videoHeight: 100, play: async () => {} };
          if (element.type === 'canvas') return { getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'frame' };
          return {};
        }
      }
    );
  });

  const liveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('立即掃描'));
  await act(async () => {
    liveButton.props.onClick();
    await thirdScanSeen;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const labels = renderer.root.findAllByType('button').map(textContent);
  assert.equal(labels.some((label) => label.includes('加入帳本')), false);
  renderer.unmount();
});

test('live mode keeps a newly appearing secondary price locked', async () => {
  const stream = { getTracks: () => [{ stop: () => {} }] };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } }
  });
  let scanCalls = 0;
  let resolveSecondScan;
  const secondScanSeen = new Promise((resolve) => { resolveSecondScan = resolve; });
  const results = [
    { rawText: '¥980', detectedPrices: [{ amount: 980 }] },
    { rawText: '¥980 ¥500', detectedPrices: [{ amount: 980 }, { amount: 500 }] }
  ];

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        liveScanIntervalMs={1}
        createLiveScanner={async () => ({
          scan: async () => {
            scanCalls += 1;
            if (scanCalls === 2) resolveSecondScan();
            return results[scanCalls - 1] || new Promise(() => {});
          },
          terminate: async () => {}
        })}
      />,
      {
        createNodeMock: (element) => {
          if (element.type === 'video') return { srcObject: null, readyState: 2, videoWidth: 100, videoHeight: 100, play: async () => {} };
          if (element.type === 'canvas') return { getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'frame' };
          return {};
        }
      }
    );
  });

  const liveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('立即掃描'));
  await act(async () => {
    liveButton.props.onClick();
    await secondScanSeen;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const labels = renderer.root.findAllByType('button').map(textContent);
  assert.equal(labels.some((label) => label.includes('NT$ 108')), false);
  assert.equal(labels.some((label) => label.includes('加入帳本')), true);
  renderer.unmount();
});

test('live mode shows multiple prices after each one is independently stabilized', async () => {
  const stream = { getTracks: () => [{ stop: () => {} }] };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } }
  });
  let scanCalls = 0;
  let resolveSecondScan;
  const secondScanSeen = new Promise((resolve) => { resolveSecondScan = resolve; });
  const result = {
    rawText: '¥980 ¥500',
    detectedPrices: [{ amount: 980 }, { amount: 500 }]
  };
  let addedAmount = null;

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={(expense) => { addedAmount = expense.amount; }}
        onAskAiWithPhoto={() => {}}
        liveScanIntervalMs={1}
        createLiveScanner={async () => ({
          scan: async () => {
            scanCalls += 1;
            if (scanCalls === 2) resolveSecondScan();
            return scanCalls <= 2 ? result : new Promise(() => {});
          },
          terminate: async () => {}
        })}
      />,
      {
        createNodeMock: (element) => {
          if (element.type === 'video') return { srcObject: null, readyState: 2, videoWidth: 100, videoHeight: 100, play: async () => {} };
          if (element.type === 'canvas') return { getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'frame' };
          return {};
        }
      }
    );
  });

  const liveButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('立即掃描'));
  await act(async () => {
    liveButton.props.onClick();
    await secondScanSeen;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const labels = renderer.root.findAllByType('button').map(textContent);
  assert.equal(labels.some((label) => label.includes('NT$ 211')), true);
  assert.equal(labels.some((label) => label.includes('NT$ 108')), true);

  const fiveHundredYen = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('NT$ 108'));
  await act(async () => fiveHundredYen.props.onClick());
  const addButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('加入帳本'));
  await act(async () => addButton.props.onClick());
  assert.equal(addedAmount, 500);
  renderer.unmount();
});

test('closing photo mode prevents a late FileReader result from starting OCR', async () => {
  let pendingReader;
  let readerAborted = false;
  let scannerCreations = 0;
  globalThis.FileReader = class {
    constructor() {
      pendingReader = this;
      this.readyState = 1;
    }

    readAsDataURL() {}

    abort() {
      readerAborted = true;
      this.readyState = 2;
    }
  };

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OcrScannerModal
        isOpen
        onClose={() => {}}
        currentRate={0.215}
        onSelectPriceForExpense={() => {}}
        onAskAiWithPhoto={() => {}}
        createPhotoScanner={async () => {
          scannerCreations += 1;
          return { scan: async () => ({ rawText: '', detectedPrices: [] }), terminate: async () => {} };
        }}
      />
    );
  });

  const photoButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button).includes('拍照辨識'));
  await act(async () => photoButton.props.onClick());
  const fileInput = renderer.root.findByProps({ type: 'file' });
  await act(async () => fileInput.props.onChange({ target: { files: [{ name: 'large.jpg' }] } }));

  const closeButton = renderer.root.findAllByType('button')
    .find((button) => textContent(button) === '關閉');
  await act(async () => closeButton.props.onClick());
  await act(async () => {
    pendingReader.onload({ target: { result: 'data:image/jpeg;base64,late' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(readerAborted, true);
  assert.equal(scannerCreations, 0);
  renderer.unmount();
});
