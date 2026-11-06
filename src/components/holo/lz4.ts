/**
 * A decoder for the LZ4 frame format (https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md),
 * which is how the 3dverse API serves asset payloads: `GET /assets/meshes/:id/payload` answers with
 * a raw LZ4 frame, not with an HTTP `Content-Encoding` the browser would undo by itself.
 *
 * Everything is decoded into one contiguous buffer, so blocks that reference earlier blocks
 * ("linked" blocks, the format's default) need nothing special. Checksums are skipped, not checked:
 * the payload comes over TLS, and the mesh description's sizes are checked by the caller.
 */

const FRAME_MAGIC = 0x184d2204;
const SKIPPABLE_MAGIC_MASK = 0xfffffff0;
const SKIPPABLE_MAGIC = 0x184d2a50;

/** Whether `bytes` starts like an LZ4 frame. */
export function isLz4Frame(bytes: Uint8Array) {
  return bytes.length >= 4 && readU32(bytes, 0) === FRAME_MAGIC;
}

/**
 * Decodes every LZ4 frame in `input`, one after the other.
 *
 * @param expectedSize The decoded size when known (a mesh description's `payloadSize`), to allocate
 *   the output once. Without it, the output grows as needed.
 */
export function decodeLz4Frame(
  input: Uint8Array,
  expectedSize?: number,
): Uint8Array {
  let out = new Uint8Array(Math.max(expectedSize ?? input.length * 3, 64));
  let written = 0;

  const reserve = (count: number) => {
    if (written + count <= out.length) {
      return;
    }
    const grown = new Uint8Array(
      Math.max(out.length * 2, written + count + (1 << 16)),
    );
    grown.set(out.subarray(0, written));
    out = grown;
  };

  let pos = 0;
  while (pos + 4 <= input.length) {
    const magic = readU32(input, pos);
    pos += 4;

    if ((magic & SKIPPABLE_MAGIC_MASK) >>> 0 === SKIPPABLE_MAGIC) {
      pos += 4 + readU32(input, pos);
      continue;
    }
    if (magic !== FRAME_MAGIC) {
      throw new Error(`LZ4: not a frame (magic 0x${magic.toString(16)})`);
    }

    const flags = input[pos];
    if (flags >> 6 !== 1) {
      throw new Error(`LZ4: unsupported frame version ${flags >> 6}`);
    }
    const hasBlockChecksum = (flags & 0x10) !== 0;
    const hasContentSize = (flags & 0x08) !== 0;
    const hasContentChecksum = (flags & 0x04) !== 0;
    const hasDictionary = (flags & 0x01) !== 0;
    if (hasDictionary) {
      throw new Error("LZ4: frames using a dictionary are not supported");
    }
    // FLG, BD, the optional content size and dictionary id, then the header checksum.
    pos += 2 + (hasContentSize ? 8 : 0) + 1;

    for (;;) {
      if (pos + 4 > input.length) {
        throw new Error("LZ4: truncated frame");
      }
      const header = readU32(input, pos);
      pos += 4;
      if (header === 0) {
        break; // End mark.
      }
      const size = header & 0x7fffffff;
      if (pos + size > input.length) {
        throw new Error("LZ4: truncated block");
      }
      if (header & 0x80000000) {
        // Stored as is.
        reserve(size);
        out.set(input.subarray(pos, pos + size), written);
        written += size;
      } else {
        written = decodeBlock(
          input,
          pos,
          pos + size,
          reserve,
          () => out,
          written,
        );
      }
      pos += size + (hasBlockChecksum ? 4 : 0);
    }
    pos += hasContentChecksum ? 4 : 0;
  }

  return written === out.length ? out : out.subarray(0, written);
}

/** Decodes one compressed block, `input[start, end)`, appending at `written`. Returns the new end. */
function decodeBlock(
  input: Uint8Array,
  start: number,
  end: number,
  reserve: (count: number) => void,
  output: () => Uint8Array,
  written: number,
): number {
  let pos = start;
  while (pos < end) {
    const token = input[pos++];

    // Literals.
    let literals = token >> 4;
    if (literals === 15) {
      let extra: number;
      do {
        extra = input[pos++];
        literals += extra;
      } while (extra === 255);
    }
    if (literals > 0) {
      reserve(literals);
      output().set(input.subarray(pos, pos + literals), written);
      written += literals;
      pos += literals;
    }
    // The last sequence of a block has literals only.
    if (pos >= end) {
      break;
    }

    // Match.
    const offset = input[pos] | (input[pos + 1] << 8);
    pos += 2;
    if (offset === 0 || offset > written) {
      throw new Error("LZ4: corrupt block (bad match offset)");
    }
    let length = token & 15;
    if (length === 15) {
      let extra: number;
      do {
        extra = input[pos++];
        length += extra;
      } while (extra === 255);
    }
    length += 4;

    reserve(length);
    const out = output();
    let from = written - offset;
    if (offset >= length) {
      out.copyWithin(written, from, from + length);
      written += length;
    } else {
      // Overlapping: the match repeats bytes it is writing.
      for (let i = 0; i < length; i++) {
        out[written++] = out[from++];
      }
    }
  }
  return written;
}

function readU32(bytes: Uint8Array, at: number) {
  return (
    (bytes[at] |
      (bytes[at + 1] << 8) |
      (bytes[at + 2] << 16) |
      (bytes[at + 3] << 24)) >>>
    0
  );
}
