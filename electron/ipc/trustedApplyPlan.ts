import type { ApplyPlan, ApplyPlanModule } from '../../src/types/applyPlan';

interface TrustedPlanEntry {
  scope: string;
  serialized: string;
  plan: ApplyPlan;
  expiresAt: number;
}

const trustedPlans = new Map<string, TrustedPlanEntry>();
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function clonePlan(plan: ApplyPlan): ApplyPlan {
  return JSON.parse(JSON.stringify(plan)) as ApplyPlan;
}

function removeExpired(now = Date.now()): void {
  for (const [id, entry] of trustedPlans) {
    if (entry.expiresAt <= now) trustedPlans.delete(id);
  }
}

/** 注册由主进程生成、允许 Renderer 预览后一次性执行的计划。 */
export function registerTrustedApplyPlan(
  plan: ApplyPlan,
  scope: string,
  ttlMs = DEFAULT_TTL_MS,
): ApplyPlan {
  removeExpired();
  const snapshot = clonePlan(plan);
  trustedPlans.set(snapshot.id, {
    scope,
    serialized: JSON.stringify(snapshot),
    plan: snapshot,
    expiresAt: Date.now() + ttlMs,
  });
  return clonePlan(snapshot);
}

/**
 * 消费可信计划。任何字段被 Renderer 修改、跨通道复用、过期或重复执行都会被拒绝。
 */
export function consumeTrustedApplyPlan(
  planJson: string,
  scope: string,
  expectedModule?: ApplyPlanModule,
): ApplyPlan {
  removeExpired();
  let candidate: ApplyPlan;
  try {
    candidate = JSON.parse(planJson) as ApplyPlan;
  } catch {
    throw new Error('Apply Plan 格式无效');
  }
  if (!candidate?.id) throw new Error('Apply Plan 缺少可信标识');
  const entry = trustedPlans.get(candidate.id);
  if (!entry || entry.scope !== scope) throw new Error('Apply Plan 未由当前主进程生成或已失效');
  if (expectedModule && entry.plan.module !== expectedModule) throw new Error(`拒绝执行非 ${expectedModule} Apply Plan`);
  if (JSON.stringify(candidate) !== entry.serialized) throw new Error('Apply Plan 内容已被修改，请重新生成');
  trustedPlans.delete(candidate.id);
  return clonePlan(entry.plan);
}

/** 仅供测试和应用关闭清理。 */
export function clearTrustedApplyPlans(): void {
  trustedPlans.clear();
}
