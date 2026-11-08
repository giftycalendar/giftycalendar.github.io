// Lettore minimo di plist binari (bplist00), il formato dei regali di Gifty.
// Restituisce oggetti, array, stringhe, numeri, booleani e Uint8Array per i dati.
function parseBplist(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...bytes.slice(0, 8));
  if (!magic.startsWith('bplist0')) throw new Error('Formato del regalo non riconosciuto');

  const t = bytes.length - 32;
  const offsetSize = bytes[t + 6];
  const refSize = bytes[t + 7];
  const numObjects = Number(view.getBigUint64(t + 8));
  const topObject = Number(view.getBigUint64(t + 16));
  const tableOffset = Number(view.getBigUint64(t + 24));

  const readUInt = (pos, size) => {
    let v = 0;
    for (let i = 0; i < size; i++) v = v * 256 + bytes[pos + i];
    return v;
  };
  const offsets = [];
  for (let i = 0; i < numObjects; i++) offsets.push(readUInt(tableOffset + i * offsetSize, offsetSize));

  const lengthAt = (pos, info) => {
    if (info !== 0xF) return { len: info, start: pos + 1 };
    const intSize = 1 << (bytes[pos + 1] & 0xF);
    return { len: readUInt(pos + 2, intSize), start: pos + 2 + intSize };
  };

  const parse = (index) => {
    const pos = offsets[index];
    const marker = bytes[pos];
    const type = marker >> 4;
    const info = marker & 0xF;
    switch (type) {
      case 0x0:
        return info === 0x8 ? false : info === 0x9 ? true : null;
      case 0x1: {
        const size = 1 << info;
        if (size === 8) return Number(view.getBigInt64(pos + 1));
        return readUInt(pos + 1, size);
      }
      case 0x2:
        return info === 2 ? view.getFloat32(pos + 1) : view.getFloat64(pos + 1);
      case 0x3:
        return new Date((view.getFloat64(pos + 1) + 978307200) * 1000);
      case 0x4: {
        const { len, start } = lengthAt(pos, info);
        return bytes.slice(start, start + len);
      }
      case 0x5: {
        const { len, start } = lengthAt(pos, info);
        return new TextDecoder('latin1').decode(bytes.slice(start, start + len));
      }
      case 0x6: {
        const { len, start } = lengthAt(pos, info);
        let s = '';
        for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint16(start + i * 2));
        return s;
      }
      case 0x8:
        return readUInt(pos + 1, info + 1);
      case 0xA: {
        const { len, start } = lengthAt(pos, info);
        const out = [];
        for (let i = 0; i < len; i++) out.push(parse(readUInt(start + i * refSize, refSize)));
        return out;
      }
      case 0xD: {
        const { len, start } = lengthAt(pos, info);
        const out = {};
        for (let i = 0; i < len; i++) {
          const key = parse(readUInt(start + i * refSize, refSize));
          out[key] = parse(readUInt(start + (len + i) * refSize, refSize));
        }
        return out;
      }
      default:
        throw new Error('Tipo di dato non supportato: ' + type);
    }
  };
  return parse(topObject);
}
