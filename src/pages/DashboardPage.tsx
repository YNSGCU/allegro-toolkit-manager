/** ATM - 系统概览 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Keyboard,
  Menu as MenuIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { EnvironmentInfo, HealthScore } from '../types/environment';
import FileStatusCard from '../components/FileStatusCard';
import VersionInfoPanel from '../components/common/VersionInfoPanel';
import { formatUserError, PageState, StatusStrip, WorkspaceHeader, WorkspacePage } from '../shared/ui';

const workspaceEntries = [
  {
    to: '/hotkeys',
    title: '快捷键',
    description: '检查键盘占用、编辑映射并处理冲突。',
    icon: Keyboard,
  },
  {
    to: '/skills',
    title: 'Skill',
    description: '维护能力加载、命令注册与引用关系。',
    icon: Sparkles,
  },
  {
    to: '/menu',
    title: '菜单',
    description: '编辑 ATM 菜单覆盖层并预览生成结果。',
    icon: MenuIcon,
  },
] as const;

function getScoreLevelText(level: HealthScore['level']) {
  switch (level) {
    case 'safe': return '运行状态安全';
    case 'warning': return '存在需要关注的项目';
    case 'danger': return '存在阻断性风险';
  }
}

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEnvironment = async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window.atm === 'undefined') {
        throw new Error('未连接到 Electron 主进程，请在 ATM 桌面应用中打开。');
      }
      const result = await window.atm.getHealthScore();
      if (result.success && result.data) {
        setEnvInfo(result.data.environment);
        setHealth(result.data.health);
      } else {
        setError(formatUserError(result.error, '加载环境信息失败'));
        const envResult = await window.atm.locateEnvironment();
        if (envResult.success && envResult.data) setEnvInfo(envResult.data);
      }
    } catch (loadError) {
      setError(formatUserError(loadError, '加载环境信息失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEnvironment();
  }, []);

  if (loading && !envInfo) {
    return (
      <WorkspacePage className="overview-page">
        <WorkspaceHeader eyebrow="系统状态" title="概览" description="正在检查 Allegro 配置与 ATM 运行状态。" />
        <PageState kind="loading" title="正在检测工作区" description="正在读取路径、权限和运行健康度。" />
      </WorkspacePage>
    );
  }

  if (error && !envInfo) {
    return (
      <WorkspacePage className="overview-page">
        <WorkspaceHeader eyebrow="系统状态" title="概览" description="集中确认环境健康度并进入核心工作区。" />
        <PageState
          kind="error"
          title="无法读取系统状态"
          description={error}
          action={<button className="btn btn-primary" onClick={() => void loadEnvironment()}>重新检测</button>}
        />
      </WorkspacePage>
    );
  }

  const issueCount = (health?.details.length ?? 0) + (envInfo?.warnings.length ?? 0);

  return (
    <WorkspacePage className="overview-page">
      <WorkspaceHeader
        eyebrow="系统状态"
        title="概览"
        description="集中确认环境健康度、关键文件和三个核心工作区的入口。"
        actions={(
          <>
            <Link className="btn" to="/environment">环境详情</Link>
            <button className="btn btn-primary" onClick={() => void loadEnvironment()} disabled={loading}>
              <RefreshCw aria-hidden="true" />
              {loading ? '检测中…' : '重新检测'}
            </button>
          </>
        )}
      />

      <StatusStrip
        label="系统状态摘要"
        items={[
          {
            label: '健康度',
            value: health ? `${health.score} / 100` : '未评分',
            tone: health?.level === 'danger' ? 'error' : health?.level === 'warning' ? 'warning' : health ? 'ok' : 'muted',
          },
          { label: 'pcbenv', value: envInfo?.pcbenvPath ? '已定位' : '未定位', tone: envInfo?.pcbenvPath ? 'ok' : 'error' },
          { label: 'env', value: envInfo?.envExists ? '可用' : '缺失', tone: envInfo?.envExists ? 'ok' : 'error' },
          { label: '待关注', value: `${issueCount} 项`, tone: issueCount > 0 ? 'warning' : 'ok' },
        ]}
      />

      {error ? <div className="message message-warning overview-inline-warning">{error}</div> : null}

      <div className="overview-primary-grid">
        <section className="ui-panel overview-health-panel" aria-label="环境健康度">
          <div className="ui-panel-header">
            <div>
              <p className="ui-panel-eyebrow">环境健康</p>
              <h2>{health ? getScoreLevelText(health.level) : '尚未获得健康评分'}</h2>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          <div className={`overview-score overview-score--${health?.level ?? 'unknown'}`}>
            <strong>{health?.score ?? '—'}</strong>
            <span>/ 100</span>
          </div>
          <div className="overview-health-details">
            {health?.details.length ? health.details.slice(0, 4).map((detail, index) => (
              <div key={`${detail.category}-${index}`}>
                <span>{detail.reason}</span>
                <strong>-{detail.deduction}</strong>
              </div>
            )) : <p>当前没有健康度扣分项。</p>}
          </div>
        </section>

        <section className="ui-panel overview-workspaces" aria-label="核心工作区">
          <div className="ui-panel-header">
            <div>
              <p className="ui-panel-eyebrow">核心工作区</p>
              <h2>继续处理配置</h2>
            </div>
          </div>
          <div className="overview-workspace-list">
            {workspaceEntries.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link key={entry.to} className="overview-workspace-link" to={entry.to}>
                  <Icon aria-hidden="true" />
                  <span><strong>{entry.title}</strong><small>{entry.description}</small></span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <section className="ui-panel overview-files" aria-label="关键文件状态">
        <div className="ui-panel-header">
          <div>
            <p className="ui-panel-eyebrow">路径与权限</p>
            <h2>关键文件状态</h2>
          </div>
        </div>
        <div className="ui-file-grid">
          <FileStatusCard title="pcbenv 目录" path={envInfo?.pcbenvPath || null} exists={envInfo?.pcbenvExists || false} writable={envInfo?.pcbenvWritable} />
          <FileStatusCard title="env 文件" path={envInfo?.envFilePath || null} exists={envInfo?.envExists || false} readable={envInfo?.envReadable} writable={envInfo?.envWritable} />
          <FileStatusCard title="allegro.ilinit" path={envInfo?.ilinitFilePath || null} exists={envInfo?.ilinitExists || false} readable={envInfo?.ilinitReadable} writable={envInfo?.ilinitWritable} />
        </div>
      </section>

      {envInfo?.warnings.length ? (
        <section className="ui-panel overview-warning-list" aria-label="检测警告">
          <div className="ui-panel-header"><div><p className="ui-panel-eyebrow">需要关注</p><h2>检测警告</h2></div></div>
          {envInfo.warnings.map((warning, index) => <div key={`${warning}-${index}`} className="message message-warning">{warning}</div>)}
        </section>
      ) : null}

      <VersionInfoPanel />
    </WorkspacePage>
  );
};

export default DashboardPage;
