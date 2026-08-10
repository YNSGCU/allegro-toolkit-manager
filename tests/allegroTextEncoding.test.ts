import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import iconv from 'iconv-lite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decodeAllegroText,
  encodeAllegroText,
  getAllegroTextEncoding,
  readAllegroTextFile,
  writeAllegroTextFile,
} from '../core/environment/allegroTextEncoding';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Allegro SKILL 文本编码策略', () => {
  it('17.2 及更早版本使用 GBK，17.4 和未知版本保持 UTF-8', () => {
    expect(getAllegroTextEncoding('16.6')).toBe('gbk');
    expect(getAllegroTextEncoding('17.2')).toBe('gbk');
    expect(getAllegroTextEncoding('17.2 S083')).toBe('gbk');
    expect(getAllegroTextEncoding('17.4')).toBe('utf8');
    expect(getAllegroTextEncoding(null)).toBe('utf8');
  });

  it('能识别并读取遗留的 UTF-8 与 GBK 中文脚本', () => {
    const source = 'load("D:/Skill/01-布局/测试.il")';
    const utf8 = decodeAllegroText(Buffer.from(source, 'utf8'), 'gbk');
    const gbk = decodeAllegroText(iconv.encode(source, 'gbk'), 'utf8');

    expect(utf8).toEqual({ text: source, detectedEncoding: 'utf8' });
    expect(gbk).toEqual({ text: source, detectedEncoding: 'gbk' });
  });

  it('按目标版本编码写入，并可无损读回', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-allegro-encoding-'));
    tempDirs.push(root);
    const filePath = path.join(root, 'allegro.ilinit');
    const source = 'load("D:/Skill/01-布局/测试.il")';

    writeAllegroTextFile(filePath, source, 'gbk');
    expect(fs.readFileSync(filePath).equals(encodeAllegroText(source, 'gbk'))).toBe(true);
    expect(readAllegroTextFile(filePath, 'gbk')).toEqual({
      text: source,
      detectedEncoding: 'gbk',
    });
  });
});
