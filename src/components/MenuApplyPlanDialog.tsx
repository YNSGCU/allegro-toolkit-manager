import type { ApplyPlan } from '../types/applyPlan';
import { ApplyPlanDialog } from '../shared/ui';

interface MenuApplyPlanDialogProps {
  open: boolean;
  plan: ApplyPlan | null;
  applying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MenuApplyPlanDialog({
  open,
  plan,
  applying,
  onConfirm,
  onCancel,
}: MenuApplyPlanDialogProps) {
  return (
    <ApplyPlanDialog
      open={open}
      plan={plan}
      applying={applying}
      title="确认应用菜单配置"
      intro="确认后将保存菜单方案、生成 ATM 托管菜单脚本，并按计划更新启动配置。"
      confirmLabel="确认写入并应用"
      restartNote="菜单写入后可重启 Allegro，或在命令窗口执行 atmLoadMenus 重新加载。"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
