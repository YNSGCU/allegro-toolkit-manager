/**
 * ATM - SKILL LISP 字面量解析器单元测试
 */
import { describe, it, expect } from 'vitest';
import { parseSkillLisp } from '../core/color/parseSkillLisp';

describe('parseSkillLisp', () => {
  it('解析空列表', () => {
    expect(parseSkillLisp('()')).toEqual([]);
  });

  it('解析数字与布尔', () => {
    expect(parseSkillLisp('(1 2.5 -3 t nil)')).toEqual([1, 2.5, -3, true, null]);
  });

  it('解析嵌套列表', () => {
    const input = '(palette ((255 255 255) (0 0 0)) background (1 2 3) layers (("ETCH" "TOP" 7 t) ("ETCH" "BOTTOM" 8 nil)))';
    expect(parseSkillLisp(input)).toEqual([
      'palette',
      [
        [255, 255, 255],
        [0, 0, 0],
      ],
      'background',
      [1, 2, 3],
      'layers',
      [
        ['ETCH', 'TOP', 7, true],
        ['ETCH', 'BOTTOM', 8, null],
      ],
    ]);
  });

  it('解析字符串中的空格与转义', () => {
    expect(parseSkillLisp('("BOARD GEOMETRY" "a\\"b")')).toEqual(['BOARD GEOMETRY', 'a"b']);
  });

  it('解析带前导 SUCCESS 标记的内容', () => {
    expect(parseSkillLisp('(1 2)')).toEqual([1, 2]);
  });

  it('解析单个符号为字符串', () => {
    expect(parseSkillLisp('abc')).toBe('abc');
  });

  it('括号不匹配时抛出错误', () => {
    expect(() => parseSkillLisp('(1 2')).toThrow();
    expect(() => parseSkillLisp('1 2)')).toThrow();
  });
});
