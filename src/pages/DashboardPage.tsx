/**
 * ATM - 概览页面
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EnvironmentInfo, HealthScore } from '../types/environment';
import MinimalSurface from '../components/MinimalSurface';
import FileStatusCard from '../components/FileStatusCard';
import VersionInfoPanel from '../components/common/VersionInfoPanel';
import { getPageSurface } from '../config/pageSurfaces';

// window.atm 类型定义见 src/types/window.d.ts

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnvironment();
  }, []);

  const loadEnvironment = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.atm.getHealthScore();
      if (result.success && result.data) {
        setEnvInfo(result.data.environment);
        setHealth(result.data.health);
      } else {
        setError(result.error || '加载环境信息失败');
        // 也尝试直接加载环境
        const envResult = await window.atm.locateEnvironment();
        if (envResult.success && envResult.data) {
          setEnvInfo(envResult.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">正在检测环境...</div>;
  }

  const getScoreLevelText = (level: string) => {
    switch (level) {
      case 'safe': return '安全';
      case 'warning': return '警告';
      case 'danger': return '危险';
      default: return '未知';
    }
  };

  const overviewSurface = getPageSurface('overview');
  const overviewSummaryLine = [
    health ? `健康 ${health.score}` : '健康 --',
    envInfo?.envExists ? 'env 已检测' : 'env 缺失',
    envInfo?.pcbenvPath ? 'pcbenv 已定位' : 'pcbenv 未定位',
  ];

  return (
    <div className="workspace-page utility-page">
      <MinimalSurface
        title={overviewSurface.title}
        subtitle={overviewSurface.subtitle}
        prompt={overviewSurface.prompt}
        summaryLine={overviewSummaryLine}
        cards={overviewSurface.actions.map((action) => ({
          id: action.id,
          title: action.label,
          meta: action.meta,
        }))}
      />

      {error && (
        <div className="message message-warning">
          {error}
          <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={loadEnvironment}>
            重试
          </button>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {/* 健康评分 */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-header">环境健康</div>
          {health ? (
            <>
              <div className={`score-ring ${health.level}`}>{health.score}</div>
              <div className="stat-label">{getScoreLevelText(health.level)}</div>
            </>
          ) : (
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>—</div>
          )}
        </div>

        {/* 快捷键统计 */}
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/hotkeys')}>
          <div className="card-header">快捷键</div>
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
            {envInfo?.envExists ? '已检测' : '未检测'}
          </div>
          <div className="stat-label">点击查看详情</div>
        </div>

        {/* Skill 管理 */}
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/skills')}>
          <div className="card-header">Skill</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            已就绪
          </div>
          <div className="stat-label">点击管理 Skill</div>
        </div>

        {/* pcbenv 状态 */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-header">配置目录</div>
          <div className="stat-value" style={{
            color: envInfo?.pcbenvPath ? 'var(--accent-green)' : 'var(--accent-red)'
          }}>
            {envInfo?.pcbenvPath ? '已定位' : '未找到'}
          </div>
          <div className="stat-label">
            {envInfo?.pcbenvPath ? envInfo.pcbenvPath : '请手动选择'}
          </div>
        </div>
      </div>

      {/* 文件状态 */}
      <div className="card">
        <div className="card-header">文件状态</div>
        <div className="grid-3">
          <FileStatusCard
            title="pcbenv 目录"
            path={envInfo?.pcbenvPath || null}
            exists={envInfo?.pcbenvExists || false}
            writable={envInfo?.pcbenvWritable}
          />
          <FileStatusCard
            title="env 文件"
            path={envInfo?.envFilePath || null}
            exists={envInfo?.envExists || false}
            readable={envInfo?.envReadable}
            writable={envInfo?.envWritable}
          />
          <FileStatusCard
            title="allegro.ilinit"
            path={envInfo?.ilinitFilePath || null}
            exists={envInfo?.ilinitExists || false}
            readable={envInfo?.ilinitReadable}
            writable={envInfo?.ilinitWritable}
          />
        </div>
      </div>

      {/* 警告 */}
      {envInfo?.warnings && envInfo.warnings.length > 0 && (
        <div className="card">
          <div className="card-header">检测警告</div>
          {envInfo.warnings.map((w, i) => (
            <div key={i} className="message message-warning">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* 操作建议 */}
      <div className="card">
        <div className="card-header">快捷操作</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/environment')}>
            详细环境检测
          </button>
          <button className="btn" onClick={() => navigate('/hotkeys')}>
            打开快捷键
          </button>
          <button className="btn" onClick={() => navigate('/skills')}>
            打开 Skill
          </button>
          <button className="btn" onClick={loadEnvironment}>
            重新扫描
          </button>
        </div>
      </div>

      {/* V5.4 运行版本信息面板 */}
      <VersionInfoPanel />
    </div>
  );
};

export default DashboardPage;
