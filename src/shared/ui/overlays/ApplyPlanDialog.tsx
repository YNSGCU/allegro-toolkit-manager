import { useId } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileClock,
  FileCog,
  FilePlus2,
  FileText,
  FolderPlus,
  HardDriveDownload,
  History,
  Info,
  ListChecks,
  Menu,
  MoveRight,
  PencilLine,
  Rocket,
  Settings2,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { getStepTypeChinese } from '../../../types/applyPlan';
import useDialogFocus from './useDialogFocus';

interface ApplyPlanStepView {
  id?: string;
  type: string;
  title?: string;
  description?: string;
  target?: string;
  targetFile?: string;
}

interface ApplyPlanRiskView {
  id?: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description?: string;
  suggestedAction?: string;
}

interface ApplyPlanWarningView {
  level: 'info' | 'warning' | 'danger';
  message: string;
}

interface ApplyPlanBackupView {
  sourceFile: string;
  backupFile: string;
  required: boolean;
}

export interface ApplyPlanViewModel {
  id: string;
  title?: string;
  summary?: string;
  description?: string;
  steps: ApplyPlanStepView[];
  risks?: ApplyPlanRiskView[];
  warnings?: ApplyPlanWarningView[];
  backups?: ApplyPlanBackupView[];
  targetFiles?: string[];
  requiresRestart?: boolean;
}

interface ApplyPlanDialogProps {
  open: boolean;
  plan: ApplyPlanViewModel | null;
  applying: boolean;
  title?: string;
  intro?: string;
  confirmLabel?: string;
  restartNote?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const stepIcons: Record<string, typeof FileCog> = {
  backup_file: HardDriveDownload,
  backup: HardDriveDownload,
  modify_line: PencilLine,
  append_line: FilePlus2,
  comment_line: FileText,
  write_file: FileCog,
  create_file: FilePlus2,
  delete_file: Trash2,
  archive_file: Archive,
  update_json: Settings2,
  generate_loader: Wrench,
  generate_menu: Menu,
  ensure_bootstrap: Rocket,
  record_history: History,
  create_directory: FolderPlus,
  move_file: MoveRight,
  write_skill_loader: Wrench,
  write_bootstrap: Rocket,
  modify_ilinit: FileCog,
};

const riskIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

export default function ApplyPlanDialog({
  open,
  plan,
  applying,
  title = '确认应用配置',
  intro = '以下是即将执行的配置变更。确认前不会写入任何文件。',
  confirmLabel = '确认写入并应用',
  restartNote,
  onConfirm,
  onCancel,
}: ApplyPlanDialogProps) {
  const titleId = useId();
  const { dialogRef, handleDialogKeyDown } = useDialogFocus<HTMLDivElement>({
    open,
    onClose: onCancel,
    dismissDisabled: applying,
  });

  if (!open) return null;

  const risks: ApplyPlanRiskView[] = [
    ...(plan?.risks || []),
    ...(plan?.warnings || []).map((warning, index) => ({
      id: `legacy-warning-${index}`,
      severity: warning.level === 'danger' ? 'error' as const : warning.level,
      title: warning.message,
    })),
  ];
  const targetCount = new Set(plan?.targetFiles || []).size;
  const backupCount = plan?.backups?.filter((backup) => backup.required).length || 0;

  return (
    <div
      className="ui-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !applying) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="ui-dialog ui-apply-plan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="ui-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>{plan?.title || plan?.summary || '配置变更计划'}</p>
          </div>
          <button
            type="button"
            className="ui-icon-button"
            aria-label="关闭"
            onClick={onCancel}
            disabled={applying}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="ui-dialog-body">
          <div className="ui-apply-plan-intro">
            <Info aria-hidden="true" />
            <span>{intro}</span>
          </div>

          <section className="ui-apply-plan-summary" aria-label="变更摘要">
            <div>
              <ListChecks aria-hidden="true" />
              <span>执行步骤</span>
              <strong>{plan?.steps.length || 0}</strong>
            </div>
            <div>
              <FileCog aria-hidden="true" />
              <span>目标文件</span>
              <strong>{targetCount}</strong>
            </div>
            <div>
              <HardDriveDownload aria-hidden="true" />
              <span>必要备份</span>
              <strong>{backupCount}</strong>
            </div>
            <div>
              {plan?.requiresRestart
                ? <AlertTriangle aria-hidden="true" />
                : <CheckCircle2 aria-hidden="true" />}
              <span>应用后</span>
              <strong>{plan?.requiresRestart ? '需要重启' : '无需重启'}</strong>
            </div>
          </section>

          {plan?.description ? <p className="ui-apply-plan-description">{plan.description}</p> : null}

          {plan?.steps.length ? (
            <section className="ui-apply-plan-section" aria-labelledby={`${titleId}-steps`}>
              <h3 id={`${titleId}-steps`}>执行步骤</h3>
              <ol className="ui-apply-plan-steps">
                {plan.steps.map((step, index) => {
                  const StepIcon = stepIcons[step.type] || FileClock;
                  return (
                    <li key={step.id || `${step.type}-${index}`}>
                      <span className="ui-apply-plan-step-index">{index + 1}</span>
                      <StepIcon aria-hidden="true" />
                      <div>
                        <strong>{step.title || getStepTypeChinese(step.type)}</strong>
                        {step.description ? <p>{step.description}</p> : null}
                        {step.targetFile || step.target ? (
                          <code>{step.targetFile || step.target}</code>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {risks.length ? (
            <section className="ui-apply-plan-section" aria-labelledby={`${titleId}-risks`}>
              <h3 id={`${titleId}-risks`}>风险与注意事项</h3>
              <div className="ui-apply-plan-risks">
                {risks.map((risk, index) => {
                  const RiskIcon = riskIcons[risk.severity];
                  return (
                    <div
                      key={risk.id || `${risk.title}-${index}`}
                      className={`ui-apply-plan-risk ui-apply-plan-risk--${risk.severity}`}
                    >
                      <RiskIcon aria-hidden="true" />
                      <div>
                        <strong>{risk.title}</strong>
                        {risk.description ? <p>{risk.description}</p> : null}
                        {risk.suggestedAction ? <p>建议：{risk.suggestedAction}</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {plan?.requiresRestart ? (
            <div className="ui-apply-plan-restart" role="note">
              <AlertTriangle aria-hidden="true" />
              <span>{restartNote || '配置写入后需要重启 Allegro 才能完全生效。'}</span>
            </div>
          ) : null}
        </div>

        <footer className="ui-dialog-footer">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={applying}
            data-dialog-initial-focus
          >
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={applying}>
            {applying ? '正在安全写入…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
