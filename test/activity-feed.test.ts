// FD-129 (UX-15): the app's own Activity rows open their agent; on that agent's own tab they have nowhere to go.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Feed } from '../src/renderer/components/Activity';
import type { ActivityItem } from '../src/core/types';

(globalThis as { React?: unknown }).React = React; // the renderer's JSX reads React from the scope

const row = (source: 'service' | 'app', serviceKey: string, id: string): ActivityItem =>
  ({ id, at: '2026-10-27T10:00:00Z', level: 'warning', text: `${source} ${id}`, serviceKey, serviceName: serviceKey, source }) as ActivityItem;
const items = [row('app', 'relay.default', 'a1'), row('service', 'relay.default', 's1'), row('app', 'ads.default', 'a2')];
const buttons = (html: string) => (html.match(/<button class="feed-row"/g) ?? []).length;

test('FD-129 (UX-15): on the Activity page every row opens, the app\'s own included', () => {
  assert.equal(buttons(renderToStaticMarkup(React.createElement(Feed, { items, openAt: () => undefined }))), 3);
});

test('FD-129 (UX-15): on an agent\'s own tab its service rows and other agents\' app rows open; its own app rows do not', () => {
  assert.equal(buttons(renderToStaticMarkup(React.createElement(Feed, { items, openAt: () => undefined, self: 'relay.default' }))), 2);
});

test('with nothing to open them, rows stay plain', () => {
  assert.equal(buttons(renderToStaticMarkup(React.createElement(Feed, { items }))), 0);
});
