import { describe, expect, it } from 'vitest';
import { tabPanelProps, tabProps } from './tab-panel';

describe('tabProps / tabPanelProps', () => {
  it('ties every tab to the region and names the region after the selected tab', () => {
    const list = tabProps('items-view', 'list');
    const board = tabProps('items-view', 'board');
    const panel = tabPanelProps('items-view', 'board');
    expect(panel.role).toBe('tabpanel');
    expect(list['aria-controls']).toBe(panel.id);
    expect(board['aria-controls']).toBe(panel.id);
    expect(panel['aria-labelledby']).toBe(board.id);
    expect(new Set([list.id, board.id, panel.id]).size).toBe(3);
  });
});
