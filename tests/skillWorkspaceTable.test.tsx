import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SkillWorkspaceTable from '../src/components/SkillWorkspaceTable';
import type { SkillFileItem } from '../src/types/skill';

afterEach(cleanup);

const userSkill: SkillFileItem = {
  id: 'skill-1',
  name: 'route_helper.il',
  path: 'C:\\pcbenv\\skill\\route_helper.il',
  dirPath: 'C:\\pcbenv\\skill',
  sourceType: 'user_skill',
  tier: 'user',
  readonly: false,
  writable: true,
  enabled: true,
  loadStatus: 'loaded_configured',
  parseStatus: 'ok',
  packageType: 'single_file',
  hasPackageJson: false,
  dependencies: [],
  totalFunctionCount: 3,
  entryCommands: [{
    id: 'cmd-1',
    name: 'route_helper',
    sourceSkillId: 'skill-1',
    sourceFile: 'C:\\pcbenv\\skill\\route_helper.il',
    sourceSkillName: 'route_helper.il',
    commandKind: 'axl_registered',
    isEntry: true,
    confidence: 'high',
    hotkeys: [],
    menuPaths: [],
    loadStatus: 'loaded_configured',
    conflictStatus: 'normal',
    tier: 'user',
    skillEnabled: true,
  }],
  internalFunctions: [],
  hotkeyRefs: [],
  menuRefs: [],
  functions: [],
};

describe('SkillWorkspaceTable', () => {
  it('renders a dense status row and opens details from the row', () => {
    const onSelect = vi.fn();

    render(
      <SkillWorkspaceTable
        skills={[userSkill]}
        metaMap={{
          'skill-1': {
            skillId: 'skill-1',
            filePath: userSkill.path,
            originalName: userSkill.name,
            userName: '布线辅助',
          },
        }}
        usageStatuses={{}}
        issueCountMap={new Map([['skill-1', 2]])}
        pendingSkills={{}}
        displayMode="bilingual"
        onSelect={onSelect}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText('route_helper.il')).toBeInTheDocument();
    expect(screen.getByText('布线辅助')).toBeInTheDocument();
    expect(screen.getByText('已配置加载')).toBeInTheDocument();
    expect(screen.getByText('2')).toHaveClass('has-issues');

    fireEvent.click(screen.getByRole('row', { name: '查看 route_helper.il 详情' }));
    expect(onSelect).toHaveBeenCalledWith(userSkill);
  });

  it('stops row selection when the enable state action is clicked', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();

    render(
      <SkillWorkspaceTable
        skills={[userSkill]}
        metaMap={{}}
        usageStatuses={{}}
        issueCountMap={new Map()}
        pendingSkills={{}}
        displayMode="original"
        onSelect={onSelect}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '禁用' }));
    expect(onToggle).toHaveBeenCalledWith(userSkill.path, false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
