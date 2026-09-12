// Assets 생성. tray PNG + app ICO(PNG 내장). 의존성 없음(node:zlib만).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const kDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "Assets");

const kCrcTable = new Int32Array(256);
for (let n = 0; n < 256; ++n)
{
	let c = n;
	for (let jdx = 0; jdx < 8; ++jdx)
		c = (c & 1) !== 0 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
	kCrcTable[n] = c;
}

function Crc(_bytes)
{
	let c = 0xFFFFFFFF;
	for (const b of _bytes)
		c = kCrcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
	return (c ^ 0xFFFFFFFF) >>> 0;
}

function Chunk(_type, _data)
{
	const out = Buffer.alloc(12 + _data.length);
	out.writeUInt32BE(_data.length, 0);
	out.write(_type, 4, "ascii");
	Buffer.from(_data).copy(out, 8);
	out.writeUInt32BE(Crc(Buffer.concat([Buffer.from(_type, "ascii"), Buffer.from(_data)])), 8 + _data.length);
	return out;
}

function Png(_size, _pixels)
{
	const raw = Buffer.alloc(_size * _size * 4 + _size);
	for (let y = 0; y < _size; ++y)
	{
		raw[y * (_size * 4 + 1)] = 0;
		for (let x = 0; x < _size; ++x)
		{
			const src = (y * _size + x) * 4;
			const dst = y * (_size * 4 + 1) + 1 + x * 4;
			raw[dst] = _pixels[src] ?? 0;
			raw[dst + 1] = _pixels[src + 1] ?? 0;
			raw[dst + 2] = _pixels[src + 2] ?? 0;
			raw[dst + 3] = _pixels[src + 3] ?? 0;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(_size, 0);
	ihdr.writeUInt32BE(_size, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const head = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
	return Buffer.concat([head, Chunk("IHDR", ihdr), Chunk("IDAT", deflateSync(raw)), Chunk("IEND", Buffer.alloc(0))]);
}

function Draw(_size)
{
	const px = Buffer.alloc(_size * _size * 4);
	const radius = _size * 0.22;
	const at = (_x, _y) => (_y * _size + _x) * 4;
	for (let y = 0; y < _size; ++y)
	{
		for (let x = 0; x < _size; ++x)
		{
			const nx = x / _size - 0.5;
			const ny = y / _size - 0.5;
			const corner = 0.32;
			const dx = Math.max(Math.abs(nx) - (0.5 - corner), 0);
			const dy = Math.max(Math.abs(ny) - (0.5 - corner), 0);
			const outside = Math.sqrt(dx * dx + dy * dy) > corner;
			const o = at(x, y);
			if (outside)
			{
				px[o + 3] = 0;
				continue;
			}
			px[o] = 0x4F;
			px[o + 1] = 0x7C;
			px[o + 2] = 0xFF;
			px[o + 3] = 0xFF;
			const dist = Math.sqrt(nx * nx + ny * ny);
			const ring = Math.abs(dist - radius / _size - 0.08) < 0.045;
			const dot = Math.hypot(nx - 0.12, ny - 0.12) < 0.07;
			if (ring || dot)
			{
				px[o] = 0xFF;
				px[o + 1] = 0xFF;
				px[o + 2] = 0xFF;
			}
		}
	}
	return px;
}

function Ico(_pngs)
{
	const head = Buffer.alloc(6 + _pngs.length * 16);
	head.writeUInt16LE(0, 0);
	head.writeUInt16LE(1, 2);
	head.writeUInt16LE(_pngs.length, 4);
	let offset = 6 + _pngs.length * 16;
	for (let idx = 0; idx < _pngs.length; ++idx)
	{
		const png = _pngs[idx];
		const entry = head.subarray(6 + idx * 16, 6 + (idx + 1) * 16);
		const dim = png.dim;
		entry[0] = dim >= 256 ? 0 : dim;
		entry[1] = dim >= 256 ? 0 : dim;
		entry[2] = 0;
		entry[3] = 0;
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(png.data.length, 8);
		entry.writeUInt32LE(offset, 12);
		offset += png.data.length;
	}
	return Buffer.concat([head, ..._pngs.map((_p) => _p.data)]);
}

mkdirSync(kDir, { recursive: true });
const p16 = Png(16, Draw(16));
const p32 = Png(32, Draw(32));
writeFileSync(path.join(kDir, "tray-16.png"), p16);
writeFileSync(path.join(kDir, "tray-32.png"), p32);
const sizes = [16, 32, 48, 256].map((_s) => ({ dim: _s, data: Png(_s, Draw(_s)) }));
writeFileSync(path.join(kDir, "app.ico"), Ico(sizes));
console.log("icons written to Assets/");
