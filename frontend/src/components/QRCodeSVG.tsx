import React, { useMemo } from 'react';

/**
 * Pure TypeScript QR Code Generator (Zero external dependencies)
 * Encodes URLs and strings into an SVG QR Code matrix.
 * Supports Byte mode with Error Correction Level L/M.
 */

// Galois Field 256 math tables for Reed-Solomon error correction
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = val;
    GF256_EXP[i + 255] = val;
    GF256_LOG[val] = i;
    val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]];
}

function polyMul(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function getRSPoly(ecCount: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < ecCount; i++) {
    poly = polyMul(poly, new Uint8Array([1, GF256_EXP[i]]));
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = getRSPoly(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// QR Table: capacity for Version 1 to 5 (Byte mode, Error Correction Level L)
const QR_SPECS: Record<number, { size: number; totalCodewords: number; dataCodewords: number; ecCodewords: number; alignPos: number[] }> = {
  1: { size: 21, totalCodewords: 26, dataCodewords: 19, ecCodewords: 7, alignPos: [] },
  2: { size: 25, totalCodewords: 44, dataCodewords: 34, ecCodewords: 10, alignPos: [6, 18] },
  3: { size: 29, totalCodewords: 70, dataCodewords: 55, ecCodewords: 15, alignPos: [6, 22] },
  4: { size: 33, totalCodewords: 100, dataCodewords: 80, ecCodewords: 20, alignPos: [6, 26] },
  5: { size: 37, totalCodewords: 134, dataCodewords: 108, ecCodewords: 26, alignPos: [6, 30] },
};

function generateQRMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text);

  // Pick suitable version based on byte length
  let version = 1;
  // Byte-mode QR needs 12 header bits plus a terminator/padding. The previous
  // check overstated capacity and silently emitted malformed matrices.
  while (version <= 5 && rawBytes.length + 2 > QR_SPECS[version].dataCodewords) {
    version++;
  }
  if (version > 5) {
    throw new Error('Pairing QR payload is too large');
  }

  const spec = QR_SPECS[version];
  const size = spec.size;

  // 1. Bitstream encoding: 4 bits mode (0100=Byte) + 8 bits length + data + terminator + pad
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(4, 4); // 0100 (Byte mode)
  pushBits(rawBytes.length, 8); // length
  for (const b of rawBytes) {
    pushBits(b, 8);
  }

  // Terminator
  const maxBits = spec.dataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes: 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const dataBytes = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < spec.dataCodewords; i++) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | (bits[i * 8 + j] || 0);
    }
    dataBytes[i] = byteVal;
  }

  // Generate Reed-Solomon Error Correction
  const ecBytes = rsEncode(dataBytes, spec.ecCodewords);
  const finalCodewords = new Uint8Array(spec.totalCodewords);
  finalCodewords.set(dataBytes, 0);
  finalCodewords.set(ecBytes, dataBytes.length);

  // 2. Initialize Matrix and Reserved Functions
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  const setFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const tr = row + r;
        const tc = col + c;
        if (tr >= 0 && tr < size && tc >= 0 && tc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            matrix[tr][tc] = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          } else {
            matrix[tr][tc] = false; // Separator
          }
        }
      }
    }
  };

  // Top-left, top-right, bottom-left finders
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Alignment pattern for version >= 2
  if (spec.alignPos.length >= 2) {
    const r = spec.alignPos[1];
    const c = spec.alignPos[1];
    if (matrix[r][c] === null) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          matrix[r + dy][c + dx] = Math.max(Math.abs(dy), Math.abs(dx)) !== 1;
        }
      }
    }
  }

  // Dark module
  matrix[4 * version + 9][8] = true;

  // Reserve format timing strips
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }

  // 3. Place Data Bits in zigzag pattern
  const finalBits: number[] = [];
  for (const b of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((b >> i) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing line

    for (let vert = 0; vert < size; vert++) {
      const y = upwards ? size - 1 - vert : vert;

      for (let xOffset = 0; xOffset < 2; xOffset++) {
        const x = right - xOffset;

        if (matrix[y][x] === null) {
          let bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          // Apply standard mask pattern (y + x) % 2 == 0
          if ((y + x) % 2 === 0) {
            bit ^= 1;
          }
          matrix[y][x] = bit === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // 4. Fill format bits (Mask 000, EC Level L = 01 -> Format 0x77C4 with XOR 0x5412)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]; // Mask 0, Level L
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix.map((row) => row.map((cell) => cell === true));
}

interface QRCodeSVGProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}

export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({
  value,
  size = 220,
  fgColor = '#07090e',
  bgColor = '#ffffff',
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value);
    } catch (e) {
      console.error('QR code generation error:', e);
      return [];
    }
  }, [value]);

  if (!matrix.length) {
    return <div style={{ width: size, height: size, background: bgColor, borderRadius: 8 }} />;
  }

  const matrixSize = matrix.length;
  const padding = 2; // quiet zone
  const totalGrid = matrixSize + padding * 2;

  // Build SVG path
  let path = '';
  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      if (matrix[y][x]) {
        path += `M${x + padding},${y + padding}h1v1h-1z `;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${totalGrid} ${totalGrid}`}
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: '12px', background: bgColor, padding: '8px' }}
      shapeRendering="crispEdges"
    >
      <rect width={totalGrid} height={totalGrid} fill={bgColor} />
      <path d={path} fill={fgColor} />
    </svg>
  );
};
