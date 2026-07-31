import path from 'path';
import { describe, expect, it } from 'vitest';
import { extractProcedureDefun, isSkillFile, parseSkillFile } from '../core/parser/parseSkillMeta';

describe('isSkillFile', () => {
  it('识别 .il 文件', () => {
    expect(isSkillFile('test.il')).toBe(true);
    expect(isSkillFile('test.IL')).toBe(true);
  });

  it('识别 .ile 文件', () => {
    expect(isSkillFile('test.ile')).toBe(true);
    expect(isSkillFile('test.ILE')).toBe(true);
  });

  it('识别 .cls 文件', () => {
    expect(isSkillFile('test.cls')).toBe(true);
    expect(isSkillFile('test.CLS')).toBe(true);
  });

  it('拒绝非 Skill 文件', () => {
    expect(isSkillFile('test.txt')).toBe(false);
    expect(isSkillFile('test.js')).toBe(false);
    expect(isSkillFile('test')).toBe(false);
    expect(isSkillFile('')).toBe(false);
  });
});

describe('extractProcedureDefun', () => {
  it('提取 procedure() 格式函数', () => {
    const content = `
      procedure(myFunc(
        let((x)
          printf("hello")
        )
      ))
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('myFunc');
    expect(funcs[0].type).toBe('procedure');
    expect(funcs[0].lineNumber).toBe(2);
  });

  it('提取 defun() 格式函数', () => {
    const content = `
      defun(myFunc(
        printf("hello")
      ))
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('myFunc');
    expect(funcs[0].type).toBe('defun');
  });

  it('提取 defunValue() 格式函数', () => {
    const content = `
      defunValue(myValue(
        42
      ))
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('myValue');
    expect(funcs[0].type).toBe('defunValue');
  });

  it('提取 Lisp 风格 procedure', () => {
    const content = `
      (procedure legacyFunc
        (printf "hello")
      )
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('legacyFunc');
    expect(funcs[0].type).toBe('procedure');
  });

  it('提取 Lisp 风格 defun', () => {
    const content = `
      (defun legacyDefun
        (printf "hello")
      )
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('legacyDefun');
  });

  it('跳过注释行', () => {
    const content = `
      ; procedure(commentedOut(
      ;; defun(alsoCommented(
      procedure(realFunc(
        printf("real")
      ))
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('realFunc');
  });

  it('处理空内容', () => {
    expect(extractProcedureDefun('')).toHaveLength(0);
    expect(extractProcedureDefun('\n\n\n')).toHaveLength(0);
    expect(extractProcedureDefun(';; only comments')).toHaveLength(0);
  });

  it('提取多个函数', () => {
    const content = `
      procedure(funcA(
        printf("A")
      ))
      defun(funcB(
        printf("B")
      ))
      defunValue(funcC(
        123
      ))
    `;

    const funcs = extractProcedureDefun(content);
    expect(funcs).toHaveLength(3);
    expect(funcs.map((f) => f.name)).toEqual(['funcA', 'funcB', 'funcC']);
  });

  it('解析真实 Skill 文件', () => {
    const fixturePath = path.join(__dirname, '..', 'test-fixtures', 'skill-sample', 'sample_utils.il');
    const result = parseSkillFile(fixturePath);

    expect(result.error).toBeUndefined();
    expect(result.functions.length).toBeGreaterThanOrEqual(5);

    const names = result.functions.map((f) => f.name);
    expect(names).toContain('myAutoFanout');
    expect(names).toContain('highlightNet');
    expect(names).toContain('testFunc');
    expect(names).toContain('legacyFunc');
    expect(names).toContain('myValueFunc');
    expect(names).not.toContain('shouldNotMatch');
    expect(names).not.toContain('commentedOut');
  });

  it('处理不存在的文件', () => {
    const result = parseSkillFile('/path/to/nonexistent.il');
    expect(result.functions).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });
});
