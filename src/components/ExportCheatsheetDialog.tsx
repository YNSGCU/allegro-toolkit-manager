import React, { useMemo, useState } from 'react';
import type { ExportOptions, HotkeyBinding } from '../types/hotkey';
import BusinessDialog from '../shared/ui/overlays/BusinessDialog';

interface ExportCheatsheetDialogProps {
  bindings: HotkeyBinding[];
  favorites: string[];
  activeProfileId?: string;
  profileName?: string;
  onClose: () => void;
  onExport: (content: string, filename: string) => void;
}

const GROUP_OPTIONS: Array<{ value: ExportOptions['groupBy']; label: string }> = [
  { value: 'category', label: '按命令分类' },
  { value: 'source', label: '按来源分组' },
  { value: 'none', label: '不分组' },
];

const FILTER_OPTIONS: Array<{ value: ExportOptions['filterMode']; label: string }> = [
  { value: 'all', label: '导出全部' },
  { value: 'favorites', label: '只导出常用' },
  { value: 'profile', label: '只导出当前方案' },
  { value: 'source', label: '按来源导出' },
];

export const ExportCheatsheetDialog: React.FC<ExportCheatsheetDialogProps> = ({
  bindings,
  favorites,
  activeProfileId,
  profileName,
  onClose,
  onExport,
}) => {
  const [format, setFormat] = useState<ExportOptions['format']>('markdown');
  const [groupBy, setGroupBy] = useState<ExportOptions['groupBy']>('category');
  const [filterMode, setFilterMode] = useState<ExportOptions['filterMode']>('all');
  const [includeCommand, setIncludeCommand] = useState(true);
  const [includeSource, setIncludeSource] = useState(false);
  const [includeLineNumber, setIncludeLineNumber] = useState(false);
  const [title, setTitle] = useState('Allegro 快捷键速查表');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredBindings = useMemo(() => {
    switch (filterMode) {
      case 'favorites':
        return bindings.filter((binding) => favorites.includes(binding.id));
      case 'profile':
        return bindings.filter((binding) => binding.profileId === activeProfileId);
      case 'source':
        return bindings.filter(
          (binding) =>
            binding.bindingSource === 'active_profile'
            || binding.bindingSource === 'atm_managed_block',
        );
      default:
        return bindings;
    }
  }, [activeProfileId, bindings, favorites, filterMode]);

  const getDefaultFilename = () => {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = format === 'markdown' ? '.md' : '.html';
    let name = `ATM_Allegro_快捷键速查表_${date}`;

    if (filterMode === 'favorites') {
      name += '_常用';
    }

    if (filterMode === 'profile' && profileName) {
      name += `_${profileName}`;
    }

    return `${name}${suffix}`;
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const options: ExportOptions = {
        includeCommand,
        includeSource,
        includeLineNumber,
        groupBy,
        filterMode,
        filterValue: filterMode === 'profile' ? activeProfileId : undefined,
        title,
        date: new Date().toISOString().slice(0, 10),
        format,
      };

      const result = await window.atm.exportCheatsheet(
        JSON.stringify(filteredBindings),
        options,
      );

      if (!result.success || !result.data) {
        setError(result.error || '导出失败');
        return;
      }

      const content = format === 'markdown' ? result.data.markdown : result.data.html;
      onExport(content, getDefaultFilename());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出异常');
    } finally {
      setExporting(false);
    }
  };

  return (
    <BusinessDialog
      title="导出快捷键速查表"
      description="选择导出范围、分组和文件格式。"
      onClose={onClose}
      size="lg"
      dismissDisabled={exporting}
      className="export-dialog export-dialog--compact"
      bodyClassName="export-dialog-body"
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose} disabled={exporting}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting || filteredBindings.length === 0}
          >
            {exporting ? '导出中...' : '导出并保存'}
          </button>
        </>
      )}
    >
          <div className="export-options">
            <div className="export-section">
              <h4>导出格式</h4>
              <div className="export-format-options">
                <label
                  className={`export-format-option ${
                    format === 'markdown' ? 'active' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'markdown'}
                    onChange={() => setFormat('markdown')}
                  />
                  <span className="format-icon" aria-hidden="true">TXT</span>
                  <span>Markdown (.md)</span>
                </label>
                <label
                  className={`export-format-option ${
                    format === 'html' ? 'active' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'html'}
                    onChange={() => setFormat('html')}
                  />
                  <span className="format-icon" aria-hidden="true">HTML</span>
                  <span>HTML (.html)</span>
                </label>
              </div>
            </div>

            <div className="export-section">
              <h4>筛选范围</h4>
              <div className="export-select-row">
                {FILTER_OPTIONS.map((option) => (
                  <label key={option.value} className="export-radio-label">
                    <input
                      type="radio"
                      name="filterMode"
                      checked={filterMode === option.value}
                      onChange={() => setFilterMode(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="export-count">
                将导出 <strong>{filteredBindings.length}</strong> 条快捷键
              </div>
            </div>

            <div className="export-section">
              <h4>分组方式</h4>
              <div className="export-select-row">
                {GROUP_OPTIONS.map((option) => (
                  <label key={option.value} className="export-radio-label">
                    <input
                      type="radio"
                      name="groupBy"
                      checked={groupBy === option.value}
                      onChange={() => setGroupBy(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="export-section">
              <h4>包含内容</h4>
              <label className="export-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeCommand}
                  onChange={() => setIncludeCommand((value) => !value)}
                />
                <span>显示原始命令</span>
              </label>
              <label className="export-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeSource}
                  onChange={() => setIncludeSource((value) => !value)}
                />
                <span>显示来源信息</span>
              </label>
              <label className="export-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeLineNumber}
                  onChange={() => setIncludeLineNumber((value) => !value)}
                />
                <span>显示行号</span>
              </label>
            </div>

            <div className="export-section">
              <h4>标题</h4>
              <input
                type="text"
                className="atm-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </div>

          {error ? <div className="error-message">{error}</div> : null}
    </BusinessDialog>
  );
};

export default ExportCheatsheetDialog;
