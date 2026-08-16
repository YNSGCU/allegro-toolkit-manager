import { describe, expect, it } from 'vitest';
import { buildBoardDiagnosticSkill, parseBoardDiagnosticOutput } from '../core/diagnostic/boardDiagnostic';

describe('buildBoardDiagnosticSkill', () => {
  it('只读红线：不包含写 API', () => {
    const skill = buildBoardDiagnosticSkill();
    expect(skill).not.toMatch(/axlColorSet|axlDBAddProp|axlDBChangeProp|axlDBDelete|outfile|write\(/i);
  });

  it('包含关键只读查询', () => {
    const skill = buildBoardDiagnosticSkill();
    expect(skill).toContain('axlCurrentDesign');
    expect(skill).toContain('axlDBGetDesignUnits');
    expect(skill).toContain('paramLayerGroup:ETCH');
    expect(skill).toContain('axlDBGetDesign()->nets');
    expect(skill).toContain('axlDBGetDesign()->components');
    expect(skill).toContain('axlDBGetDesign()->drcs');
  });
});

describe('parseBoardDiagnosticOutput', () => {
  it('解析完整输出', () => {
    const snap = parseBoardDiagnosticOutput('("my_board" "mils" 4 123 45 3 ("TOP" "BOTTOM" "VCC" "GND"))');
    expect(snap.connected).toBe(true);
    expect(snap.designName).toBe('my_board');
    expect(snap.designUnits).toBe('mils');
    expect(snap.layerCount).toBe(4);
    expect(snap.netCount).toBe(123);
    expect(snap.componentCount).toBe(45);
    expect(snap.drcCount).toBe(3);
    expect(snap.layerNames).toEqual(['TOP', 'BOTTOM', 'VCC', 'GND']);
  });

  it('无叠层时 layerNames 为空', () => {
    const snap = parseBoardDiagnosticOutput('("board" "mils" 0 0 0 0 nil)');
    expect(snap.connected).toBe(true);
    expect(snap.layerNames).toEqual([]);
    expect(snap.layerCount).toBe(0);
  });

  it('解析失败返回未连接', () => {
    expect(parseBoardDiagnosticOutput('garbage').connected).toBe(false);
  });

  it('字段不完整返回未连接', () => {
    expect(parseBoardDiagnosticOutput('("board")').connected).toBe(false);
  });
});
