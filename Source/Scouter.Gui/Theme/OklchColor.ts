/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: OklchColor. OKLCH 기반 스케일·혼합. opencode 테마 엔진 이식.
*/

export interface IOklch
{
	L: number;
	C: number;
	H: number;
}

export interface IRgb01
{
	R: number;
	G: number;
	B: number;
}

export interface IShift
{
	L?: number;
	C?: number;
	H?: number;
}

export class OklchColor
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// hex를 0~1 RGB로 푼다. 3·4·6·8자리 지원.
	// @param _hex: 색 문자열
	public static HexToRgb(_hex: string): IRgb01
	{
		const body = _hex.replace("#", "");
		const full = body.length === 3 || body.length === 4
			? body.split("").map((_c) => _c + _c).join("")
			: body;
		const rgb = full.length === 8 ? full.slice(0, 6) : full;
		const num = Number.parseInt(rgb, 16);
		return { R: ((num >> 16) & 255) / 255, G: ((num >> 8) & 255) / 255, B: (num & 255) / 255 };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 0~1 RGB를 hex로 묶는다.
	// @param _rgb: RGB
	public static RgbToHex(_rgb: IRgb01): string
	{
		const toHex = (_v: number): string =>
		{
			const clamped = OklchColor.Clamp(_v, 0, 1);
			return Math.round(clamped * 255).toString(16).padStart(2, "0");
		};
		return `#${toHex(_rgb.R)}${toHex(_rgb.G)}${toHex(_rgb.B)}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// RGB를 OKLCH로 바꾼다.
	// @param _rgb: RGB
	public static RgbToOklch(_rgb: IRgb01): IOklch
	{
		const lr = OklchColor.SrgbToLinear(_rgb.R);
		const lg = OklchColor.SrgbToLinear(_rgb.G);
		const lb = OklchColor.SrgbToLinear(_rgb.B);
		const lRoot = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
		const mRoot = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
		const sRoot = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
		const l = Math.cbrt(lRoot);
		const m = Math.cbrt(mRoot);
		const s = Math.cbrt(sRoot);
		const bigL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
		const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
		const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
		const chroma = Math.sqrt(a * a + b * b);
		let hue = Math.atan2(b, a) * (180 / Math.PI);
		if (hue < 0)
			hue += 360;
		return { L: bigL, C: chroma, H: hue };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// OKLCH를 RGB로 바꾼다.
	// @param _oklch: OKLCH
	public static OklchToRgb(_oklch: IOklch): IRgb01
	{
		const a = _oklch.C * Math.cos((_oklch.H * Math.PI) / 180);
		const b = _oklch.C * Math.sin((_oklch.H * Math.PI) / 180);
		const l = _oklch.L + 0.3963377774 * a + 0.2158037573 * b;
		const m = _oklch.L - 0.1055613458 * a - 0.0638541728 * b;
		const s = _oklch.L - 0.0894841775 * a - 1.291485548 * b;
		const l3 = l * l * l;
		const m3 = m * m * m;
		const s3 = s * s * s;
		return {
			R: OklchColor.LinearToSrgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
			G: OklchColor.LinearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
			B: OklchColor.LinearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// hex를 OKLCH로 바꾼다.
	// @param _hex: 색 문자열
	public static HexToOklch(_hex: string): IOklch
	{
		return OklchColor.RgbToOklch(OklchColor.HexToRgb(_hex));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// OKLCH를 hex로 바꾼다.
	// @param _oklch: OKLCH
	public static OklchToHex(_oklch: IOklch): string
	{
		return OklchColor.RgbToHex(OklchColor.OklchToRgb(_oklch));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// sRGB 영역에 들어가게 채도를 낮춘다.
	// @param _oklch: OKLCH
	public static FitOklch(_oklch: IOklch): IOklch
	{
		const base: IOklch = { L: OklchColor.Clamp(_oklch.L, 0, 1), C: Math.max(0, _oklch.C), H: OklchColor.Hue(_oklch.H) };
		const rgb = OklchColor.OklchToRgb(base);
		if (rgb.R >= 0 && rgb.R <= 1 && rgb.G >= 0 && rgb.G <= 1 && rgb.B >= 0 && rgb.B <= 1)
			return base;
		let chroma = base.C;
		for (let idx = 0; idx < 24; ++idx)
		{
			chroma *= 0.9;
			const next: IOklch = { L: base.L, C: chroma, H: base.H };
			const out = OklchColor.OklchToRgb(next);
			if (out.R >= 0 && out.R <= 1 && out.G >= 0 && out.G <= 1 && out.B >= 0 && out.B <= 1)
				return next;
		}
		return { L: base.L, C: 0, H: base.H };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 시드색 12단계 스케일을 만든다.
	// @param _seed: 시드색
	// @param _isDark: 다크 여부
	public static GenerateScale(_seed: string, _isDark: boolean): string[]
	{
		const base = OklchColor.HexToOklch(_seed);
		const lightSteps = _isDark
			? [
				0.118, 0.138, 0.167, 0.202, 0.246, 0.304, 0.378, 0.468,
				OklchColor.Clamp(base.L * 0.825, 0.53, 0.705),
				OklchColor.Clamp(base.L * 0.89, 0.61, 0.79),
				OklchColor.Clamp(base.L + 0.033, 0.868, 0.943),
				0.984,
			]
			: [0.993, 0.983, 0.962, 0.936, 0.906, 0.866, 0.811, 0.74, base.L, Math.max(0, base.L - 0.036), 0.49, 0.27];
		const chromaMult = _isDark
			? [0.52, 0.68, 0.86, 1.02, 1.14, 1.24, 1.36, 1.48, 1.56, 1.64, 1.62, 1.15]
			: [0.12, 0.24, 0.46, 0.68, 0.84, 0.98, 1.08, 1.16, 1.22, 1.26, 1.18, 0.98];
		const scale: string[] = [];
		for (let idx = 0; idx < 12; ++idx)
		{
			scale.push(OklchColor.OklchToHex({
				L: OklchColor.At(lightSteps, idx),
				C: base.C * OklchColor.At(chromaMult, idx),
				H: base.H,
			}));
		}
		return scale;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 중립 12단계 스케일을 만든다. ink가 있으면 혼합 방식.
	// @param _seed: 시드색
	// @param _isDark: 다크 여부
	// @param _ink: 잉크색 (생략 가능)
	public static GenerateNeutralScale(_seed: string, _isDark: boolean, _ink?: string): string[]
	{
		if (_ink !== undefined)
			return OklchColor.NeutralWithInk(_seed, _isDark, _ink);
		const base = OklchColor.HexToOklch(_seed);
		const neutralChroma = Math.min(base.C, _isDark ? 0.068 : 0.04);
		const lightSteps = _isDark
			? [0.138, 0.156, 0.178, 0.202, 0.232, 0.272, 0.326, 0.404, OklchColor.Clamp(base.L * 0.83, 0.43, 0.55), 0.596, 0.719, 0.956]
			: [0.991, 0.979, 0.964, 0.946, 0.931, 0.913, 0.891, 0.83, base.L, 0.617, 0.542, 0.205];
		const scale: string[] = [];
		for (let idx = 0; idx < 12; ++idx)
		{
			scale.push(OklchColor.OklchToHex({ L: OklchColor.At(lightSteps, idx), C: neutralChroma, H: base.H }));
		}
		return scale;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전경을 배경에 알파로 섞는다.
	// @param _color: 전경
	// @param _background: 배경
	// @param _alpha: 알파
	public static Blend(_color: string, _background: string, _alpha: number): string
	{
		const fg = OklchColor.HexToRgb(_color);
		const bg = OklchColor.HexToRgb(_background);
		return OklchColor.RgbToHex({
			R: fg.R * _alpha + bg.R * (1 - _alpha),
			G: fg.G * _alpha + bg.G * (1 - _alpha),
			B: fg.B * _alpha + bg.B * (1 - _alpha),
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// OKLCH를 이동시킨다.
	// @param _color: 원본
	// @param _shift: 이동량
	public static Shift(_color: string, _shift: IShift): string
	{
		const base = OklchColor.HexToOklch(_color);
		return OklchColor.OklchToHex({
			L: base.L + (_shift.L ?? 0),
			C: base.C * (_shift.C ?? 1),
			H: base.H + (_shift.H ?? 0),
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 두 색을 OKLCH에서 섞는다.
	// @param _first: 첫 색
	// @param _second: 둘째 색
	// @param _amount: 둘째 비중
	public static Mix(_first: string, _second: string, _amount: number): string
	{
		const first = OklchColor.HexToOklch(_first);
		const second = OklchColor.HexToOklch(_second);
		const delta = ((((second.H - first.H) % 360) + 540) % 360) - 180;
		return OklchColor.OklchToHex({
			L: first.L + (second.L - first.L) * _amount,
			C: first.C + (second.C - first.C) * _amount,
			H: first.H + delta * _amount,
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// rgba() 문자열을 만든다.
	// @param _color: 색
	// @param _alpha: 알파
	public static WithAlpha(_color: string, _alpha: number): string
	{
		const rgb = OklchColor.HexToRgb(_color);
		return `rgba(${Math.round(rgb.R * 255)}, ${Math.round(rgb.G * 255)}, ${Math.round(rgb.B * 255)}, ${_alpha})`;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 범위로 묶는다.
	// @param _v: 값
	// @param _min: 최소
	// @param _max: 최대
	private static Clamp(_v: number, _min: number, _max: number): number
	{
		return Math.max(_min, Math.min(_max, _v));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 색상을 0~360으로 묶는다.
	// @param _v: 색상
	private static Hue(_v: number): number
	{
		return ((_v % 360) + 360) % 360;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선형을 sRGB로 바꾼다.
	// @param _c: 선형값
	private static LinearToSrgb(_c: number): number
	{
		if (_c <= 0.0031308)
			return _c * 12.92;
		return 1.055 * Math.pow(_c, 1 / 2.4) - 0.055;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// sRGB를 선형으로 바꾼다.
	// @param _c: sRGB값
	private static SrgbToLinear(_c: number): number
	{
		if (_c <= 0.04045)
			return _c / 12.92;
		return Math.pow((_c + 0.055) / 1.055, 2.4);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스를 굳힌다. 없으면 throw(프로그래밍 오류).
	// @param _arr: 배열
	// @param _idx: 인덱스
	private static At(_arr: number[], _idx: number): number
	{
		const found = _arr[_idx];
		if (found === undefined)
			throw new Error(`[OklchColor] 인덱스 없음: ${_idx}`);
		return found;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// ink 혼합 방식 중립 스케일을 만든다.
	// @param _seed: 시드색
	// @param _isDark: 다크 여부
	// @param _ink: 잉크색
	private static NeutralWithInk(_seed: string, _isDark: boolean, _ink: string): string[]
	{
		const base = OklchColor.HexToOklch(_seed);
		const lift = (_tone: number): string => OklchColor.OklchToHex({
			L: base.L + (1 - base.L) * _tone,
			C: base.C * Math.max(0, 1 - _tone),
			H: base.H,
		});
		const sink = (_tone: number): string => OklchColor.OklchToHex({
			L: base.L * (1 - _tone),
			C: base.C * Math.max(0, 1 - _tone * (_isDark ? 0.12 : 0.3)),
			H: base.H,
		});
		const bg = _isDark
			? sink(OklchColor.Clamp(0.19 + Math.max(0, base.L - 0.12) * 0.33 + base.C * 1.95, 0.17, 0.27))
			: base.L < 0.82
				? lift(0.86)
				: lift(OklchColor.Clamp(0.1 + base.C * 3.2 + Math.max(0, 0.95 - base.L) * 0.35, 0.1, 0.28));
		const steps = _isDark
			? [0, 0.018, 0.039, 0.064, 0.097, 0.143, 0.212, 0.31, 0.46, 0.649, 0.845, 0.984]
			: [0, 0.022, 0.042, 0.068, 0.102, 0.146, 0.208, 0.296, 0.432, 0.61, 0.81, 0.965];
		return steps.map((_step) => OklchColor.Mix(bg, _ink, _step));
	}
}
