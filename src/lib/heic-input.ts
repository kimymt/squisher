/** Bounded HEIF admission, not an image decoder.
 * Supports hvc1, one-level grids and a bounded non-primary tone-map item.
 * Structure: https://nokiatech.github.io/heif/technical.html
 */
export interface HeicDimensions { width: number; height: number }
const fail = (): never => { throw new Error('このHEICの構造・寸法を安全に確認できません。JPEGに変換して選択してください。'); };
const ensure = (condition: unknown): void => { if (!condition) fail(); };
const MAX_META = 1024 * 1024;
const MAX_ITEMS = 512;
const bound = (width: number, height: number): HeicDimensions => {
  if (!width || !height || width > 16384 || height > 16384 || width * height > 50_000_000)
    throw new Error('画像が大きすぎます。5000万画素以下・各辺16384px以下の画像を選択してください。');
  return { width, height };
};
class Reader {
  p = 0;
  constructor(readonly b: Uint8Array) {}
  get left() { return this.b.length - this.p; }
  take(n: number): Uint8Array {
    ensure(n >= 0 && n <= this.left);
    const data = this.b.subarray(this.p, this.p + n); this.p += n; return data;
  }
  uint(n: number): number {
    ensure(n >= 0 && n <= 8);
    let value = 0;
    for (const byte of this.take(n)) value = value * 256 + byte;
    ensure(Number.isSafeInteger(value)); return value;
  }
  text(n: number) { return String.fromCharCode(...this.take(n)); }
  full(versions: number[], flagMask = 0) {
    const version = this.uint(1), flags = this.uint(3);
    ensure(versions.includes(version) && (flags & ~flagMask) === 0);
    return { version, flags };
  }
  done() { ensure(this.left === 0); }
}
interface Box { type: string; data: Uint8Array }
function boxes(bytes: Uint8Array): Box[] {
  const r = new Reader(bytes), result: Box[] = [];
  while (r.left) {
    ensure(result.length < 2048);
    let size = r.uint(4); const type = r.text(4);
    let header = 8;
    if (size === 1) { size = r.uint(8); header = 16; }
    ensure(size >= header); // zero-sized nested boxes are not supported
    result.push({ type, data: r.take(size - header) });
  }
  return result;
}
function one(list: Box[], type: string): Reader {
  const found = list.filter(b => b.type === type);
  ensure(found.length === 1); return new Reader(found[0].data);
}
const same = (a: HeicDimensions, b: HeicDimensions) => a.width === b.width && a.height === b.height;

/** Read only HEVC SPS geometry; reject excessive/ambiguous configurations.
 * SPS syntax: ITU-T H.265, 7.3.2.2.1 and profile_tier_level 7.3.3.
 * The native codec still validates all remaining bitstream syntax.
 */
function spsDimensions(nal: Uint8Array): HeicDimensions {
  ensure(nal.length >= 3 && ((nal[0] >> 1) & 63) === 33);
  const rbsp: number[] = [];
  for (let i = 2; i < nal.length; i++) {
    if (i >= 4 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue;
    rbsp.push(nal[i]);
  }
  let p = 0;
  const bits = (n: number) => {
    ensure(p + n <= rbsp.length * 8);
    let value = 0;
    for (let i = 0; i < n; i++, p++) value = value * 2 + ((rbsp[p >> 3] >> (7 - (p & 7))) & 1);
    return value;
  };
  const skip = (n: number) => { ensure(p + n <= rbsp.length * 8); p += n; };
  const ue = () => {
    let zeros = 0;
    while (!bits(1)) { zeros++; ensure(zeros <= 24); }
    return 2 ** zeros - 1 + bits(zeros);
  };
  skip(4); const layers = bits(3); skip(1); ensure(layers <= 6);
  skip(96);
  const profiles: number[] = [], levels: number[] = [];
  for (let i = 0; i < layers; i++) { profiles.push(bits(1)); levels.push(bits(1)); }
  if (layers) skip((8 - layers) * 2);
  for (let i = 0; i < layers; i++) { if (profiles[i]) skip(88); if (levels[i]) skip(8); }
  ue(); const chroma = ue(); ensure(chroma <= 3);
  const separate = chroma === 3 ? bits(1) : 0;
  const width = ue(), height = ue(); bound(width, height);
  let croppedWidth = width, croppedHeight = height;
  if (bits(1)) {
    const left = ue(), right = ue(), top = ue(), bottom = ue();
    const subWidth = !separate && (chroma === 1 || chroma === 2) ? 2 : 1;
    const subHeight = !separate && chroma === 1 ? 2 : 1;
    croppedWidth -= (left + right) * subWidth;
    croppedHeight -= (top + bottom) * subHeight;
  }
  ensure(ue() <= 2 && ue() <= 2); // 8/9/10-bit only
  ensure(croppedWidth > 0 && croppedHeight > 0);
  return bound(croppedWidth, croppedHeight);
}
function codecDimensions(bytes: Uint8Array): HeicDimensions {
  const r = new Reader(bytes); ensure(r.uint(1) === 1); r.take(21);
  const arrays = r.uint(1); ensure(arrays <= 16);
  let dims: HeicDimensions | undefined;
  for (let i = 0; i < arrays; i++) {
    const type = r.uint(1) & 63, count = r.uint(2); ensure(count <= 32);
    for (let j = 0; j < count; j++) {
      const nal = r.take(r.uint(2));
      if (type === 33) {
        const next = spsDimensions(nal);
        ensure(!dims || same(dims, next)); dims = next;
      }
    }
  }
  r.done(); ensure(dims); return dims!;
}

interface Location { method: number; start: number; length: number }
export async function readHeicDimensions(file: File): Promise<HeicDimensions> {
  const read = async (start: number, length: number) => {
    ensure(Number.isSafeInteger(start) && start >= 0 && length >= 0 && start + length <= file.size);
    const data = new Uint8Array(await file.slice(start, start + length).arrayBuffer());
    ensure(data.length === length); return data;
  };
  let offset = 0, meta: Uint8Array | undefined;
  const media: { start: number; end: number }[] = [];
  let count = 0, brandSeen = false;
  while (offset < file.size) {
    ensure(++count <= 128 && file.size - offset >= 8);
    const r = new Reader(await read(offset, Math.min(16, file.size - offset)));
    let size = r.uint(4); const type = r.text(4); let header = 8;
    if (size === 1) { size = r.uint(8); header = 16; }
    if (size === 0) { ensure(type === 'mdat'); size = file.size - offset; }
    ensure(size >= header && size <= file.size - offset);
    if (offset === 0) ensure(type === 'ftyp');
    if (type === 'ftyp') {
      ensure(!brandSeen && size <= 256);
      const f = new Reader(await read(offset + header, size - header));
      const brands = [f.text(4)]; f.take(4);
      while (f.left) brands.push(f.text(4));
      ensure(brands.some(b => b === 'heic' || b === 'heix'));
      ensure(!brands.some(b => ['msf1', 'hevc', 'hevx', 'avis'].includes(b)));
      brandSeen = true;
    } else if (type === 'meta') {
      ensure(!meta && size - header <= MAX_META);
      meta = await read(offset + header, size - header);
    } else if (type === 'mdat') media.push({ start: offset + header, end: offset + size });
    else ensure(['free', 'skip', 'wide'].includes(type));
    offset += size;
  }
  ensure(meta && brandSeen);
  const root = new Reader(meta!); root.full([0]);
  const children = boxes(root.take(root.left));
  const hdlr = one(children, 'hdlr'); hdlr.full([0]); hdlr.take(4); ensure(hdlr.text(4) === 'pict');
  const pitm = one(children, 'pitm'); const pv = pitm.full([0, 1]);
  const primary = pitm.uint(pv.version ? 4 : 2); pitm.done();
  const iinf = one(children, 'iinf'); const iv = iinf.full([0, 1]);
  const itemCount = iinf.uint(iv.version ? 4 : 2); ensure(itemCount > 0 && itemCount <= MAX_ITEMS);
  const infos = boxes(iinf.take(iinf.left)); ensure(infos.length === itemCount);
  const items = new Map<number, string>();
  for (const box of infos) {
    ensure(box.type === 'infe'); const r = new Reader(box.data), v = r.full([2, 3], 1);
    const id = r.uint(v.version === 3 ? 4 : 2); ensure(!items.has(id));
    ensure(r.uint(2) === 0); const type = r.text(4);
    ensure(['hvc1', 'grid', 'Exif', 'mime', 'uri ', 'tmap'].includes(type));
    // URI identifies embedded metadata; iloc must still reference local data.
    if (type === 'uri ') ensure(v.flags === 1);
    ensure(r.take(r.left).includes(0)); items.set(id, type);
  }
  ensure(['hvc1', 'grid'].includes(items.get(primary) ?? ''));
  const iprp = one(children, 'iprp'), props = boxes(iprp.take(iprp.left));
  const ipco = one(props, 'ipco'), properties = boxes(ipco.take(ipco.left));
  const associations = new Map<number, number[]>();
  const ipma = one(props, 'ipma'), av = ipma.full([0, 1], 1);
  const entries = ipma.uint(4); ensure(entries <= MAX_ITEMS);
  for (let i = 0; i < entries; i++) {
    const id = ipma.uint(av.version ? 4 : 2); ensure(items.has(id) && !associations.has(id));
    const indices: number[] = [], n = ipma.uint(1);
    for (let j = 0; j < n; j++) {
      const value = ipma.uint(av.flags & 1 ? 2 : 1);
      const index = value & (av.flags & 1 ? 0x7fff : 0x7f);
      ensure(index > 0 && index <= properties.length && !indices.includes(index)); indices.push(index);
    }
    associations.set(id, indices);
  }
  ipma.done();
  const dimensions = new Map<number, HeicDimensions>(), rotations = new Map<number, number>();
  for (const [id, type] of items) {
    if (!['hvc1', 'grid', 'tmap'].includes(type)) continue;
    const attached = (associations.get(id) ?? []).map(i => properties[i - 1]);
    const ispe = one(attached, 'ispe'); ispe.full([0]);
    const dims = bound(ispe.uint(4), ispe.uint(4)); ispe.done();
    dimensions.set(id, dims);
    // Unknown transformative properties must not bypass the geometry check.
    ensure(attached.every(p => ['ispe', 'hvcC', 'irot', 'imir', 'pixi', 'colr', 'auxC', 'clli', 'mdcv'].includes(p.type)));
    const rotation = attached.filter(p => p.type === 'irot'); ensure(rotation.length <= 1);
    if (rotation.length) { const r = new Reader(rotation[0].data); const angle = r.uint(1); r.done(); ensure(angle < 4); rotations.set(id, angle); }
    const mirrors = attached.filter(p => p.type === 'imir'); ensure(mirrors.length <= 1);
    if (mirrors.length) { const r = new Reader(mirrors[0].data); ensure(r.uint(1) < 2); r.done(); }
    if (type === 'hvc1') {
      const hvcc = one(attached, 'hvcC'); ensure(same(dims, codecDimensions(hvcc.take(hvcc.left))));
    }
  }
  const refs = new Map<number, number[]>();
  const irefs = children.filter(b => b.type === 'iref'); ensure(irefs.length <= 1);
  if (irefs.length) {
    const r = new Reader(irefs[0].data), v = r.full([0, 1]);
    for (const box of boxes(r.take(r.left))) {
      ensure(['dimg', 'thmb', 'auxl', 'cdsc'].includes(box.type));
      const ref = new Reader(box.data), from = ref.uint(v.version ? 4 : 2), n = ref.uint(2);
      ensure(items.has(from) && n > 0 && n <= MAX_ITEMS);
      const targets = Array.from({ length: n }, () => ref.uint(v.version ? 4 : 2)); ref.done();
      ensure(targets.every(id => items.has(id) && id !== from));
      if (box.type === 'dimg') { ensure(!refs.has(from)); refs.set(from, targets); }
    }
  }
  const iloc = one(children, 'iloc'), lv = iloc.full([0, 1, 2]);
  const sizes = iloc.uint(1), rest = iloc.uint(1);
  const offsetSize = sizes >> 4, lengthSize = sizes & 15, baseSize = rest >> 4, indexSize = rest & 15;
  ensure([offsetSize, lengthSize, baseSize].every(n => [0, 4, 8].includes(n)) && indexSize === 0);
  const locations = new Map<number, Location>();
  const locationsCount = iloc.uint(lv.version === 2 ? 4 : 2); ensure(locationsCount === items.size);
  for (let i = 0; i < locationsCount; i++) {
    const id = iloc.uint(lv.version === 2 ? 4 : 2);
    ensure(items.has(id) && !locations.has(id));
    const method = lv.version ? iloc.uint(2) : 0; ensure(method === 0 || method === 1);
    ensure(iloc.uint(2) === 0); // external data references are not allowed
    const base = iloc.uint(baseSize); ensure(iloc.uint(2) === 1); // one extent per item
    const start = base + iloc.uint(offsetSize), length = iloc.uint(lengthSize);
    ensure(Number.isSafeInteger(start) && length > 0);
    locations.set(id, { method, start, length });
  }
  iloc.done();
  const idats = children.filter(b => b.type === 'idat'); ensure(idats.length <= 1);
  for (const loc of locations.values()) {
    if (loc.method === 1) ensure(idats.length === 1 && loc.start + loc.length <= idats[0].data.length);
    else ensure(media.some(m => loc.start >= m.start && loc.start + loc.length <= m.end));
  }
  const displayed = (id: number): HeicDimensions => {
    const dims = dimensions.get(id); ensure(dims);
    return (rotations.get(id) ?? 0) % 2 ? { width: dims!.height, height: dims!.width } : dims!;
  };
  for (const [id, type] of items) {
    if (type === 'tmap') {
      // Only the observed topology: primary base + a non-derived gain map.
      // Both inputs are independently checked, including every grid tile.
      const targets = refs.get(id) ?? [];
      ensure(id !== primary && targets.length === 2 && targets[0] === primary && targets[1] !== primary);
      ensure(['hvc1', 'grid'].includes(items.get(targets[1]) ?? ''));
      const base = displayed(primary), gain = displayed(targets[1]);
      ensure(same(displayed(id), base));
      ensure(gain.width <= base.width && gain.height <= base.height);
      ensure(gain.width * base.height === gain.height * base.width);
      // Tone-map parameters are not dimensions; the native codec validates
      // their syntax. Bound their data separately from encoded image data.
      ensure(locations.get(id)!.length <= 4096);
      continue;
    }
    if (type !== 'grid') { ensure(!refs.has(id)); continue; }
    const loc = locations.get(id)!; ensure(loc.length === 8 || loc.length === 12);
    const bytes = loc.method === 1 ? idats[0].data.subarray(loc.start, loc.start + loc.length) : await read(loc.start, loc.length);
    const r = new Reader(bytes); ensure(r.uint(1) === 0);
    const flags = r.uint(1); ensure(flags <= 1);
    const rows = r.uint(1) + 1, columns = r.uint(1) + 1;
    const dims = bound(r.uint(flags ? 4 : 2), r.uint(flags ? 4 : 2)); r.done();
    ensure(same(dims, dimensions.get(id)!));
    const tiles = refs.get(id) ?? []; ensure(tiles.length === rows * columns && new Set(tiles).size === tiles.length);
    ensure(tiles.every(t => items.get(t) === 'hvc1' && !rotations.get(t)));
    const tile = dimensions.get(tiles[0])!; ensure(tile && tiles.every(t => same(tile, dimensions.get(t)!)));
    // Include padded tile area in the allocation budget.
    bound(columns * tile.width, rows * tile.height);
    ensure(dims.width <= columns * tile.width && dims.width > (columns - 1) * tile.width);
    ensure(dims.height <= rows * tile.height && dims.height > (rows - 1) * tile.height);
  }
  const dims = dimensions.get(primary)!;
  return (rotations.get(primary) ?? 0) % 2 ? { width: dims.height, height: dims.width } : dims;
}
