import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ASSETS_DIR = path.join(ROOT, 'assets');
export const RAW_DIR = path.join(ASSETS_DIR, 'raw');
export const CACHE_DIR = path.join(ASSETS_DIR, 'cache');
export const SCENARIOS_DIR = path.join(ROOT, 'data', 'scenarios');
export const OUT_DIR = path.join(ROOT, 'public', 'maps');
