/**
 * ATM - 测试环境配置
 */
import { beforeAll } from 'vitest';

beforeAll(() => {
  // 设置测试环境变量
  process.env.HOME = 'C:\\Users\\testuser';
  process.env.USERPROFILE = 'C:\\Users\\testuser';
  process.env.HOMEDRIVE = 'C:';
  process.env.HOMEPATH = '\\Users\\testuser';
});
