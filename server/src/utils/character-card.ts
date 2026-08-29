// ─── Character Card V2/V3 Import/Export ───
// ساخت و خواندن کارت کاراکتر با فرمت استاندارد جامعه (chara_card_v2 / chara_card_v3)
// شامل جاسازی/استخراج JSON داخل PNG از طریق تکسچر tEXt — بدون وابستگی خارجی.

import zlib from 'zlib';

// ─── ثابت‌های PNG ───

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}

function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

// اعتبارسنجی بیرونی — ساختار chunkها تا IEND قابل پیمایش باشد
export function isValidPng(buf: Buffer): boolean {
  if (!isPng(buf)) return false;
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IEND') return true;
    offset += 12 + len;
  }
  return false;
}

// یک chunk کامل PNG بساز (type + data + crc)
function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// ─── استخراج کارت از PNG ───

// پیمایش chunkها و برگرداندن مقدار tEXt برای keyword مشخص
function findPngText(buf: Buffer, keyword: string): string | null {
  if (!isPng(buf)) return null;
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IEND') break;
    if (type === 'tEXt') {
      const data = buf.subarray(offset + 8, offset + 8 + len);
      const nullIdx = data.indexOf(0);
      if (nullIdx > 0) {
        const key = data.toString('latin1', 0, nullIdx);
        if (key === keyword) {
          return data.toString('latin1', nullIdx + 1);
        }
      }
    }
    offset += 12 + len; // len(4) + type(4) + data(len) + crc(4)
  }
  return null;
}

// کارت را از PNG استخراج می‌کند (ccv3 اولویت دارد بعد chara)
export function extractCardFromPng(pngBuffer: Buffer): any | null {
  try {
    const v3 = findPngText(pngBuffer, 'ccv3');
    if (v3) {
      const parsed = JSON.parse(Buffer.from(v3, 'base64').toString('utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
    const v2 = findPngText(pngBuffer, 'chara');
    if (v2) {
      const parsed = JSON.parse(Buffer.from(v2, 'base64').toString('utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // کارت خراب — null برمی‌گردانیم
  }
  return null;
}

// ─── جاسازی کارت در PNG ───

// کارت JSON را به‌صورت chunk تEXt (keyword=chara) قبل از IEND درج می‌کند
export function embedCardInPng(pngBuffer: Buffer, cardJson: any): Buffer | null {
  if (!isPng(pngBuffer)) return null;

  const textValue = Buffer.from(JSON.stringify(cardJson), 'utf8').toString('base64');
  const keyword = Buffer.from('chara', 'latin1');
  const textData = Buffer.concat([keyword, Buffer.from([0]), Buffer.from(textValue, 'latin1')]);
  const cardChunk = makeChunk('tEXt', textData);

  // جایگاه IEND را پیدا کن
  let offset = 8;
  while (offset + 8 <= pngBuffer.length) {
    const len = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IEND') {
      return Buffer.concat([
        pngBuffer.subarray(0, offset),
        cardChunk,
        pngBuffer.subarray(offset),
      ]);
    }
    offset += 12 + len;
  }
  return null;
}

// ─── PNG جایگزین (وقتی آواتار نداریم) ───

// یک PNG ساده تک‌رنگ می‌سازد تا کارت داخلش جاسازی شود
export function makePlaceholderPng(width = 256, height = 256, rgb: [number, number, number] = [42, 45, 66]): Buffer {
  // ردیف‌های خام: هر ردیف = فیلتر(0) + width*3 بایت
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ساخت کارت V2 از رکورد دیتابیس ───

export function buildCardJson(character: any, lorebook?: any): any {
  const tags = typeof character.tags === 'string' ? safeParseArray(character.tags) : character.tags || [];
  const altGreetings = typeof character.alternate_greetings === 'string'
    ? safeParseArray(character.alternate_greetings)
    : Array.isArray(character.alternate_greetings) ? character.alternate_greetings : [];
  const groupOnlyGreetings = typeof character.group_only_greetings === 'string'
    ? safeParseArray(character.group_only_greetings)
    : Array.isArray(character.group_only_greetings) ? character.group_only_greetings : [];

  // بازسازی extensions.depth_prompt از فیلدهای ذخیره‌شده
  // depth_prompt در character ذخیره نمی‌شود ولی در import باید خروجی داده شود
  // اگر post_history_instructions وجود داشته باشد، آن را به‌عنوان depth_prompt خروجی می‌دهیم
  const extensions: any = {};
  if (character.post_history_instructions) {
    extensions.depth_prompt = {
      prompt: character.post_history_instructions,
      depth: 4,
      role: 'system',
    };
  }

  const data: any = {
    name: character.name || '',
    nickname: character.nickname || '',
    description: character.description || '',
    personality: character.personality || '',
    scenario: character.scenario || '',
    first_mes: character.first_mes || '',
    mes_example: character.mes_example || '',
    alternate_greetings: altGreetings,
    group_only_greetings: groupOnlyGreetings,
    system_prompt: character.system_prompt || '',
    post_history_instructions: character.post_history_instructions || '',
    creator_notes: character.creator_notes || '',
    tags,
    creator: character.creator || '',
    character_version: character.character_version || '',
    extensions,
  };

  // لوربوک لینک‌شده به‌صورت character_book استاندارد V2
  if (lorebook?.entries?.length) {
    data.character_book = {
      name: lorebook.name || `${character.name} Lorebook`,
      description: '',
      scan_depth: lorebook.scan_depth ?? 50,
      token_budget: lorebook.token_budget ?? 500,
      extension: {},
      entries: lorebook.entries.map((e: any) => ({
        keys: typeof e.keys === 'string' ? safeParseArray(e.keys) : e.key || e.keys || [],
        secondary_keys: typeof e.keys_secondary === 'string' ? safeParseArray(e.keys_secondary) : e.keysecondary || e.keys_secondary || [],
        content: e.content || '',
        comment: e.comment || '',
        constant: !!(e.constant ?? false),
        selective: !!(e.selective ?? false),
        insertion_order: e.insertion_order ?? 100,
        enabled: !(e.disable ?? false),
        position: e.position === 'after_main' ? 'after_char' : 'before_char',
        use_regex: !!(e.use_regex ?? false),
        case_sensitive: !!(e.case_sensitive ?? false),
        extensions: {
          probability: typeof e.probability === 'number' ? e.probability : 100,
        },
      })),
    };
  }

  return { spec: 'chara_card_v3', spec_version: '3.0', data };
}

// ─── خواندن کارت (V1 flat / V2 / V3) ───

export interface ParsedCardFields {
  name: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  group_only_greetings: string[];
  creator: string;
  character_version: string;
  tags: string[];
  // V3 extensions.depth_prompt — به‌عنوان post_history_instructions اضافه می‌شود
  depth_prompt?: { prompt: string; depth: number; role: string };
}

// هر سه فرمت را قبول می‌کند و فیلدهای نرمال‌شده برمی‌گرداند؛ نامعتبر → null
export function parseCardFields(cardJson: any): ParsedCardFields | null {
  if (!cardJson || typeof cardJson !== 'object') return null;

  // V2/V3: داده‌ها داخل data هستند؛ V1 قدیمی flat بود
  const src = cardJson.data && typeof cardJson.data === 'object' ? cardJson.data : cardJson;

  const name = String(src.name ?? '').trim();
  if (!name) return null;

  const altGreetings = Array.isArray(src.alternate_greetings)
    ? src.alternate_greetings.map((g: any) => String(g ?? '')).filter(Boolean)
    : [];

  const groupOnlyGreetings = Array.isArray(src.group_only_greetings)
    ? src.group_only_greetings.map((g: any) => String(g ?? '')).filter(Boolean)
    : [];

  // استخراج depth_prompt از extensions (SillyTavern V3)
  let depthPrompt: ParsedCardFields['depth_prompt'] | undefined;
  try {
    const extensions = src.extensions || cardJson.extensions || {};
    const dp = extensions.depth_prompt;
    if (dp && typeof dp === 'object' && dp.prompt) {
      depthPrompt = {
        prompt: String(dp.prompt ?? ''),
        depth: typeof dp.depth === 'number' ? dp.depth : 4,
        role: String(dp.role ?? 'system'),
      };
    }
  } catch {}

  // اگر post_history_instructions خالی باشد اما depth_prompt وجود داشته باشد، از آن استفاده کن
  const finalPostHistory = String(src.post_history_instructions ?? '');

  return {
    name,
    nickname: String(src.nickname ?? ''),
    description: String(src.description ?? ''),
    personality: String(src.personality ?? ''),
    scenario: String(src.scenario ?? ''),
    first_mes: String(src.first_mes ?? ''),
    mes_example: String(src.mes_example ?? ''),
    creator_notes: String(src.creator_notes ?? src.creatorcomment ?? ''),
    system_prompt: String(src.system_prompt ?? ''),
    post_history_instructions: finalPostHistory,
    alternate_greetings: altGreetings,
    group_only_greetings: groupOnlyGreetings,
    creator: String(src.creator ?? ''),
    character_version: String(src.character_version ?? ''),
    tags: Array.isArray(src.tags) ? src.tags.map((t: any) => String(t)).filter(Boolean) : [],
    depth_prompt: depthPrompt,
  };
}

// character_book کارت را به entries قابل ذخیره تبدیل می‌کند
export interface ParsedBookEntry {
  key: string[];
  keysecondary: string[];
  content: string;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  position: string;
  disable: boolean;
  comment: string;
  use_regex: boolean;
  case_sensitive: boolean;
  probability: number;
}

export function parseCardBook(cardJson: any): ParsedBookEntry[] {
  const src = cardJson?.data && typeof cardJson.data === 'object' ? cardJson.data : cardJson;
  const book = src?.character_book;
  if (!book || !Array.isArray(book.entries)) return [];

  return book.entries.map((e: any) => {
    // extensions خارجی entry (SillyTavern V3)
    const ext = e.extensions || {};
    return {
      key: Array.isArray(e.keys) ? e.keys.map(String) : [],
      keysecondary: Array.isArray(e.secondary_keys) ? e.secondary_keys.map(String) : [],
      content: String(e.content ?? ''),
      constant: !!e.constant,
      selective: !!e.selective,
      insertion_order: typeof e.insertion_order === 'number' ? e.insertion_order : 100,
      position: e.position === 'after_char' ? 'after_main' : 'before_main',
      disable: e.enabled === false,
      comment: String(e.comment ?? ''),
      use_regex: !!(e.use_regex ?? false),
      case_sensitive: !!(e.case_sensitive ?? false),
      probability: typeof (e.probability ?? ext.probability) === 'number'
        ? Math.min(100, Math.max(0, e.probability ?? ext.probability ?? 100))
        : 100,
    };
  });
}

// ─── کمکی‌ها ───

function safeParseArray(json: string): any[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
