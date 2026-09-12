/**
 * A minimal, dependency-free MD5 implementation, used only because @upflowi/provider-r2 requires
 * MD5 (via Content-MD5 — R2 doesn't support SHA-256/CRC32 checksums, see the "checksum" card in
 * /docs) and the browser's native Web Crypto API deliberately excludes MD5 (it's considered broken
 * for cryptographic/security use). MD5 is still a perfectly fine, fast integrity check for
 * detecting accidental corruption in transit, which is all this demo needs it for.
 *
 * This is the standard reference algorithm (RFC 1321), verified against known test vectors
 * (md5("") = d41d8cd98f00b204e9800998ecf8427e, md5("abc") = 900150983cd24fb0d6963f7d28e17f72).
 */
function md5(input: Uint8Array): Uint8Array {
  const shiftAmounts = [
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
  ];
  const sineTable = new Int32Array(64);
  for (let i = 0; i < 64; i += 1) {
    sineTable[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const originalLengthBits = input.length * 8;
  let paddedLength = input.length + 1;
  while (paddedLength % 64 !== 56) {
    paddedLength += 1;
  }
  paddedLength += 8;

  const message = new Uint8Array(paddedLength);
  message.set(input);
  message[input.length] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, originalLengthBits >>> 0, true);
  view.setUint32(
    paddedLength - 4,
    Math.floor(originalLengthBits / 2 ** 32) >>> 0,
    true,
  );

  function leftRotate(value: number, amount: number): number {
    return (value << amount) | (value >>> (32 - amount));
  }

  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    const words = new Int32Array(16);
    for (let j = 0; j < 16; j += 1) {
      words[j] = view.getUint32(chunkStart + j * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i += 1) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      // biome-ignore lint/style/noNonNullAssertion: g is always 0-15, words has 16 entries
      f = (f + a + sineTable[i]! + words[g]!) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + leftRotate(f, shiftAmounts[i] as number)) | 0;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const digest = new Uint8Array(16);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, a0 >>> 0, true);
  digestView.setUint32(4, b0 >>> 0, true);
  digestView.setUint32(8, c0 >>> 0, true);
  digestView.setUint32(12, d0 >>> 0, true);
  return digest;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Computes an MD5 digest and returns it base64-encoded — the encoding @upflowi/provider-r2 (and
 * provider-s3) require for a `ChecksumComputer`. */
export async function md5Base64(data: ArrayBuffer): Promise<string> {
  return bytesToBase64(md5(new Uint8Array(data)));
}

/** Computes a SHA-256 digest via the browser's native Web Crypto API, base64-encoded. */
export async function sha256Base64(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64(new Uint8Array(digest));
}
