import { afterEach, describe, expect, it } from 'vitest';
import { createApplyPlan } from '../core/apply/applyPlanEngine';
import {
  clearTrustedApplyPlans,
  consumeTrustedApplyPlan,
  registerTrustedApplyPlan,
} from '../electron/ipc/trustedApplyPlan';

afterEach(() => clearTrustedApplyPlans());

function makePlan() {
  return createApplyPlan({
    module: 'menu',
    title: '菜单计划',
    steps: [
      {
        type: 'write_file',
        title: '写入菜单',
        targetFile: 'C:/pcbenv/atm_generated/generated_menu.il',
        after: 'menu',
      },
    ],
  });
}

describe('trustedApplyPlan', () => {
  it('仅允许同一作用域执行主进程生成的原始计划一次', () => {
    const plan = registerTrustedApplyPlan(makePlan(), 'menu');
    expect(consumeTrustedApplyPlan(JSON.stringify(plan), 'menu', 'menu').id).toBe(plan.id);
    expect(() => consumeTrustedApplyPlan(JSON.stringify(plan), 'menu', 'menu')).toThrow('失效');
  });

  it('拒绝 Renderer 篡改目标路径', () => {
    const plan = registerTrustedApplyPlan(makePlan(), 'menu');
    plan.steps[0].targetFile = 'C:/Windows/System32/unsafe.txt';
    expect(() => consumeTrustedApplyPlan(JSON.stringify(plan), 'menu', 'menu')).toThrow('内容已被修改');
  });

  it('拒绝跨 IPC 作用域复用计划', () => {
    const plan = registerTrustedApplyPlan(makePlan(), 'menu');
    expect(() => consumeTrustedApplyPlan(JSON.stringify(plan), 'skill-profile', 'menu')).toThrow('失效');
  });
});
