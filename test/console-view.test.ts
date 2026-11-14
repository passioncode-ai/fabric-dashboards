// FD-239: the console's coding agents in one row, the chosen one pressed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeRow } from '../src/core/console-view';

const rt = (...ids: string[]) => ids.map((id) => ({ id }));

test('FD-239: Claude Code and Codex are buttons; the rest goes to More', () => {
  const r = runtimeRow(rt('gemini-cli', 'codex', 'claude-code', 'goose'), 'claude-code');
  assert.deepEqual(r.inline.map((x) => x.id), ['claude-code', 'codex']);
  assert.deepEqual(r.more.map((x) => x.id), ['gemini-cli', 'goose']);
});

test('FD-239: a chosen agent outside the two is a button too, so the pressed one is always visible', () => {
  const r = runtimeRow(rt('claude-code', 'codex', 'gemini-cli', 'goose'), 'goose');
  assert.deepEqual(r.inline.map((x) => x.id), ['claude-code', 'codex', 'goose']);
  assert.deepEqual(r.more.map((x) => x.id), ['gemini-cli']);
});

test('FD-239: without Claude Code or Codex the first installed ones fill the row; nothing is lost', () => {
  const r = runtimeRow(rt('gemini-cli', 'goose', 'opencode'), null);
  assert.deepEqual(r.inline.map((x) => x.id), ['gemini-cli', 'goose']);
  assert.deepEqual(r.more.map((x) => x.id), ['opencode']);
  assert.deepEqual(runtimeRow([], null), { inline: [], more: [] });
});
