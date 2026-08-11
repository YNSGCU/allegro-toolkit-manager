import { AlertTriangle, FileJson, PackageOpen } from 'lucide-react';
import type { MenuProfileImportPreview } from '../types/menu';
import BusinessDialog from '../shared/ui/overlays/BusinessDialog';

interface MenuProfileImportDialogProps {
  preview: MenuProfileImportPreview | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function MenuProfileImportDialog({
  preview,
  busy = false,
  onClose,
  onConfirm,
}: MenuProfileImportDialogProps) {
  if (!preview) return null;

  return (
    <BusinessDialog
      open
      title="导入菜单方案"
      description="先核对来源与兼容提示；下一步仍会显示 Apply Plan，不会直接改 Allegro。"
      size="lg"
      tone={preview.compatibilityWarningCount > 0 ? 'warning' : 'default'}
      dismissDisabled={busy}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>取消</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? '正在生成…' : '审阅导入计划'}
          </button>
        </>
      )}
    >
      <div className="menu-transfer-file">
        <FileJson aria-hidden="true" />
        <div>
          <strong>{preview.fileName}</strong>
          <span>{preview.format === 'atm-menu-profile' ? 'ATM 菜单方案包' : '兼容旧 JSON 格式'}</span>
        </div>
      </div>

      <dl className="menu-transfer-summary">
        <div><dt>来源方案</dt><dd>{preview.sourceProfileName}</dd></div>
        <div><dt>导入后名称</dt><dd>{preview.proposedProfileName}</dd></div>
        <div><dt>菜单内容</dt><dd>{preview.itemCount} 项（{preview.menuCount} 个菜单，{preview.commandCount} 个命令）</dd></div>
        <div><dt>Allegro 版本</dt><dd>{preview.sourceAllegroVersion || '未记录'} → {preview.targetAllegroVersion || '当前环境'}</dd></div>
      </dl>

      {preview.commands.length > 0 && (
        <div className="menu-transfer-commands">
          <strong>引用的命令</strong>
          <span>{preview.commands.slice(0, 12).join('、')}{preview.commands.length > 12 ? ` 等 ${preview.commands.length} 个` : ''}</span>
        </div>
      )}

      {preview.warnings.length > 0 ? (
        <div className="menu-transfer-warnings" role="status">
          <div><AlertTriangle aria-hidden="true" /><strong>导入前提示</strong></div>
          <ul>{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : (
        <div className="menu-transfer-ready" role="status">
          <PackageOpen aria-hidden="true" />
          方案结构有效，将作为新草稿导入，不覆盖现有方案。
        </div>
      )}
    </BusinessDialog>
  );
}
