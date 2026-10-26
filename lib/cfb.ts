/**
 * PARSE-6a — Đọc container OLE2/CFB (Compound File Binary).
 *
 * Vì sao cần: công thức MathType nằm trong `word/embeddings/oleObjectN.bin` —
 * một file CFB chứa stream tên "Equation Native". Stream nhỏ (< 4096 byte) được
 * lưu trong **mini-stream** với chuỗi mini-sector KHÔNG liền nhau, nên quét thô
 * buffer sẽ đọc lẫn sang tên stream khác (đó là lý do decoder cũ ra ký tự rác
 * như "焀"). Ở đây đọc đúng theo FAT/miniFAT.
 *
 * Tham chiếu: [MS-CFB] Compound File Binary File Format.
 */

const MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const MAXREGSECT = 0xfffffffa;

const u16 = (b: Buffer, o: number) => b.readUInt16LE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32LE(o);

type DirEntry = {
  name: string;
  type: number;
  start: number;
  size: number;
};

function readChain(fat: number[], start: number, max: number): number[] {
  const out: number[] = [];
  let s = start;
  let guard = 0;
  while (s !== ENDOFCHAIN && s !== FREESECT && s <= MAXREGSECT && guard++ < max) {
    out.push(s);
    s = fat[s] ?? ENDOFCHAIN;
  }
  return out;
}

function sectorData(buf: Buffer, id: number, sectorShift: number): Buffer {
  const off = (id + 1) << sectorShift;
  const size = 1 << sectorShift;
  return buf.subarray(off, Math.min(off + size, buf.length));
}

/** Đọc mọi stream trong file CFB. Trả về Map<tên, Buffer>. */
export function readCfbStreams(buf: Buffer): Map<string, Buffer> {
  const streams = new Map<string, Buffer>();
  if (buf.length < 512 || !buf.subarray(0, 8).equals(MAGIC)) return streams;

  const sectorShift = u16(buf, 0x1e);
  const miniSectorShift = u16(buf, 0x20);
  const numFatSectors = u32(buf, 0x2c);
  const firstDirSector = u32(buf, 0x30);
  const miniCutoff = u32(buf, 0x38);
  const firstMiniFatSector = u32(buf, 0x3c);
  const firstDifatSector = u32(buf, 0x44);
  const numDifatSectors = u32(buf, 0x48);
  if (sectorShift < 7 || sectorShift > 16) return streams;

  // --- DIFAT: 109 entry trong header + chuỗi sector DIFAT tiếp theo ---
  const fatSectorIds: number[] = [];
  for (let i = 0; i < 109; i++) {
    const id = u32(buf, 0x4c + i * 4);
    if (id <= MAXREGSECT) fatSectorIds.push(id);
  }
  let difat = firstDifatSector;
  const perSector = (1 << sectorShift) / 4 - 1;
  for (let n = 0; n < numDifatSectors && difat <= MAXREGSECT; n++) {
    const sec = sectorData(buf, difat, sectorShift);
    for (let i = 0; i < perSector; i++) {
      const id = u32(sec, i * 4);
      if (id <= MAXREGSECT) fatSectorIds.push(id);
    }
    difat = u32(sec, perSector * 4);
  }
  void numFatSectors;

  // --- FAT ---
  const fat: number[] = [];
  for (const id of fatSectorIds) {
    const sec = sectorData(buf, id, sectorShift);
    for (let o = 0; o + 4 <= sec.length; o += 4) fat.push(u32(sec, o));
  }
  if (fat.length === 0) return streams;

  // --- Directory ---
  const dirSectorIds = readChain(fat, firstDirSector, 10_000);
  const dirBuf = Buffer.concat(dirSectorIds.map((id) => sectorData(buf, id, sectorShift)));
  const entries: DirEntry[] = [];
  for (let o = 0; o + 128 <= dirBuf.length; o += 128) {
    const nameLen = u16(dirBuf, o + 0x40);
    const type = dirBuf[o + 0x42];
    const start = u32(dirBuf, o + 0x74);
    const size = Number(dirBuf.readBigUInt64LE(o + 0x78));
    let name = "";
    if (nameLen > 2 && nameLen <= 64) {
      name = dirBuf.subarray(o, o + nameLen - 2).toString("utf16le");
    }
    entries.push({ name, type, start, size });
  }
  const root = entries.find((e) => e.type === 5);
  if (!root) return streams;

  // --- Mini FAT ---
  const miniFatSectorIds = readChain(fat, firstMiniFatSector, 10_000);
  const miniFat: number[] = [];
  for (const id of miniFatSectorIds) {
    const sec = sectorData(buf, id, sectorShift);
    for (let o = 0; o + 4 <= sec.length; o += 4) miniFat.push(u32(sec, o));
  }

  // --- Root mini-stream (chứa dữ liệu các stream nhỏ) ---
  const rootChain = readChain(fat, root.start, 100_000);
  const miniStream = Buffer.concat(rootChain.map((id) => sectorData(buf, id, sectorShift)));

  const readMini = (start: number, size: number): Buffer => {
    const chain = readChain(miniFat, start, 100_000);
    const parts = chain.map((id) => {
      const off = id << miniSectorShift;
      return miniStream.subarray(off, off + (1 << miniSectorShift));
    });
    return Buffer.concat(parts).subarray(0, size);
  };

  for (const e of entries) {
    if (e.type !== 2 || !e.name) continue;
    if (e.size <= 0) {
      streams.set(e.name, Buffer.alloc(0));
      continue;
    }
    if (e.size < miniCutoff) {
      streams.set(e.name, readMini(e.start, e.size));
    } else {
      const chain = readChain(fat, e.start, 100_000);
      const data = Buffer.concat(chain.map((id) => sectorData(buf, id, sectorShift)));
      streams.set(e.name, data.subarray(0, e.size));
    }
  }
  return streams;
}
