import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Wrench } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { toolStageIcons } from './tool-icons';
import {
  TOOL_STAGES,
  firstToolStage,
  groupTools,
  isToolStage,
  splitStageTags,
  toolGroupLabel,
  toolStagesOf,
  type ToolGroupKey,
} from './tools';

describe('tool stages', () => {
  it('are the slugs the backend seeds with, in the same order (backend/library/tools.py STAGES)', () => {
    const source = readFileSync(path.join(__dirname, '../../backend/library/tools.py'), 'utf8');
    const block = /^STAGES = \(([\s\S]*?)^\)/m.exec(source)?.[1] ?? '';
    expect([...block.matchAll(/"(\w+)"/g)].map((m) => m[1])).toEqual(TOOL_STAGES.map((s) => s.slug));
  });

  it('start with learning (the page sits under Phát triển), then follow the work', () => {
    expect(TOOL_STAGES.map((s) => s.slug)).toEqual([
      'explore',
      'practice',
      'plan',
      'code',
      'review',
      'test',
      'security',
      'deps',
      'git',
      'ci',
      'observe',
      'data',
      'ai',
      'docs',
    ]);
  });

  it('each have one label and their own icon; "Khác" is the wrench', () => {
    const keys: ToolGroupKey[] = [...TOOL_STAGES.map((s) => s.slug), 'other'];
    expect(new Set(keys.map((k) => toolGroupLabel(k).msgid)).size).toBe(keys.length);
    expect(toolGroupLabel('other').msgid).toBe('Khác');
    expect(toolGroupLabel('review').msgid).toBe('Review code');
    expect(Object.keys(toolStageIcons).sort()).toEqual([...keys].sort());
    expect(new Set(keys.map((k) => toolStageIcons[k])).size).toBe(keys.length);
    expect(toolStageIcons.other).toBe(Wrench);
  });
});

describe('a tool’s stages among its tags', () => {
  it('are kept in the page’s order, once each, other tags left out', () => {
    expect(toolStagesOf(['security', 'python', 'review', 'security'])).toEqual(['review', 'security']);
    expect(toolStagesOf(undefined)).toEqual([]);
    expect(firstToolStage(['git', 'explore'])).toBe('explore');
    expect(firstToolStage(['cli'])).toBeNull();
    expect(isToolStage('deps')).toBe(true);
    expect(isToolStage('Deps')).toBe(false); // tags are lowercase on the server
  });

  it('split into the picker’s stages and the other tags, both in order', () => {
    expect(splitStageTags(['python', 'security', 'cli', 'explore'])).toEqual({
      stages: ['explore', 'security'],
      rest: ['python', 'cli'],
    });
  });
});

describe('groupTools', () => {
  const tool = (title: string, tags: string[], status: 'planned' | 'active' | 'done' | 'dropped' = 'planned') => ({
    title,
    tags,
    status,
  });
  const tools = [
    tool('Semgrep', ['security', 'review'], 'active'),
    tool('ripgrep', ['code', 'explore']),
    tool('DeepWiki', ['explore', 'ai']),
    tool('httpie', ['cli']),
    tool('Ángel', []),
    tool('bandit', ['security'], 'dropped'),
  ];
  const view = (groups: ReturnType<typeof groupTools<(typeof tools)[number]>>) =>
    groups.map((g) => [g.key, g.tools.map((t) => t.title)]);

  it('shows a tool under each of its stages, groups in the page’s order, "Khác" last', () => {
    expect(view(groupTools(tools))).toEqual([
      ['explore', ['DeepWiki', 'ripgrep']],
      ['code', ['ripgrep']],
      ['review', ['Semgrep']],
      ['security', ['bandit', 'Semgrep']],
      ['ai', ['DeepWiki']],
      ['other', ['Ángel', 'httpie']],
    ]);
  });

  it('sorts by title without minding case or accents', () => {
    const group = groupTools([tool('zsh', ['code']), tool('Ánh', ['code']), tool('awk', ['code'])])[0];
    expect(group.tools.map((t) => t.title)).toEqual(['Ánh', 'awk', 'zsh']);
  });

  it('keeps one status or one group, and leaves out the groups left empty', () => {
    expect(view(groupTools(tools, { status: 'active' }))).toEqual([
      ['review', ['Semgrep']],
      ['security', ['Semgrep']],
    ]);
    expect(view(groupTools(tools, { stage: 'explore' }))).toEqual([['explore', ['DeepWiki', 'ripgrep']]]);
    expect(view(groupTools(tools, { stage: 'other', status: 'planned' }))).toEqual([['other', ['Ángel', 'httpie']]]);
    expect(groupTools(tools, { stage: 'data' })).toEqual([]);
    expect(groupTools([])).toEqual([]);
  });
});
