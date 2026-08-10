import fs from 'fs';
import iconv from 'iconv-lite';

export type AllegroTextEncoding = 'utf8' | 'gbk';

export interface DecodedAllegroText {
  text: string;
  detectedEncoding: AllegroTextEncoding;
}

/**
 * Allegro 17.2 及更早版本的 Windows SKILL 启动文件按系统 ANSI
 * 代码页（中文系统为 CP936/GBK）读取；17.4 使用 UTF-8。
 * 未知版本保持现有 UTF-8 行为，避免无依据地转码。
 */
export function getAllegroTextEncoding(allegroVersion?: string | null): AllegroTextEncoding {
  const match = allegroVersion?.match(/(\d+)(?:\.(\d+))?/);
  if (!match) return 'utf8';

  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  return major < 17 || (major === 17 && minor <= 2) ? 'gbk' : 'utf8';
}

/**
 * 读取历史文件时先识别实际字节编码。这样 17.2 环境中遗留的 UTF-8
 * 文件也能被正确读出，再由 Apply Plan 安全转换为 GBK。
 */
export function decodeAllegroText(
  input: Buffer,
  preferredEncoding: AllegroTextEncoding = 'utf8',
): DecodedAllegroText {
  const hasUtf8Bom = input.length >= 3
    && input[0] === 0xef
    && input[1] === 0xbb
    && input[2] === 0xbf;
  const bytes = hasUtf8Bom ? input.subarray(3) : input;
  const utf8Text = bytes.toString('utf8');
  const isValidUtf8 = Buffer.from(utf8Text, 'utf8').equals(bytes);

  if (hasUtf8Bom || isValidUtf8) {
    const containsNonAscii = bytes.some(byte => byte >= 0x80);
    return {
      text: utf8Text,
      detectedEncoding: hasUtf8Bom || containsNonAscii ? 'utf8' : preferredEncoding,
    };
  }

  return {
    text: iconv.decode(bytes, 'gbk'),
    detectedEncoding: 'gbk',
  };
}

export function encodeAllegroText(text: string, encoding: AllegroTextEncoding): Buffer {
  return encoding === 'gbk' ? iconv.encode(text, 'gbk') : Buffer.from(text, 'utf8');
}

export function readAllegroTextFile(
  filePath: string,
  preferredEncoding: AllegroTextEncoding = 'utf8',
): DecodedAllegroText {
  return decodeAllegroText(fs.readFileSync(filePath), preferredEncoding);
}

export function writeAllegroTextFile(
  filePath: string,
  text: string,
  encoding: AllegroTextEncoding,
): void {
  fs.writeFileSync(filePath, encodeAllegroText(text, encoding));
}
