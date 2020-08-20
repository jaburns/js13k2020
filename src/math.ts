export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];
export type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export const math_clamp = (a: number, b: number, x: number) => x < a ? a : x > b ? b : x;
export const math_range = (a: number, b: number): number[] => Array(b-a).fill(void 0).map((x,i)=>i+a);

export const vec3_plus = (a: Vec3, b: Vec3): Vec3 => a.map((x,i)=>x+b[i]) as Vec3;
export const vec3_minus = (a: Vec3, b: Vec3): Vec3 => a.map((x,i)=>x-b[i]) as Vec3;
export const vec3_lerp = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((x,i)=> x + math_clamp(0,1,t)*(b[i]-x)) as Vec3;
export const vec3_dot = (a: Vec3, b: Vec3): number => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

export const vec3_cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
];

export const vec3_reflect = (v: Vec3, n: Vec3, elasticity: number): Vec3 => // elasticity: 1: no bounce -> 2: full bounce
    vec3_minus(v, n.map(x=>x*elasticity*vec3_dot(v, n)) as Vec3);

export const vec3_length = (a: Vec3): number => Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
export const vec3_normalize = (a: Vec3): Vec3 => a.map(x=>x/vec3_length(a)) as Vec3;

export const quat_length = (a: Quat): number => Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2] + a[3]*a[3]);
export const quat_normalize = (a: Quat): Quat => a.map(x=>x/quat_length(a)) as Quat;

export const quat_setAxisAngle = (axis: Vec3, rad: number, _s?: number): Quat =>
    (_s = Math.sin(.5*rad), [_s * axis[0], _s * axis[1], _s * axis[2], Math.cos(.5*rad)]);

export const quat_mul = (a: Quat, b: Quat): Quat => [
    a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
    a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
    a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];

export const quat_conj = (a: Quat): Quat => [-a[0], -a[1], -a[2], a[3]];

export const quat_fromYawPitchRoll = (yaw: number, pitch: number, roll: number): Quat =>
    quat_mul(
        quat_mul(quat_setAxisAngle([0,1,0], yaw), quat_setAxisAngle([1,0,0], pitch)),
        quat_setAxisAngle([0,0,1], roll)
    );

export const quat_mulVec3 = (q: Quat, v: Vec3): Vec3 => mat4_mulNormal(mat4_fromRotationTranslationScale(q,[0,0,0],[1,1,1]), v) as Vec3;

export const mat4_perspective = (aspect: number, near: number, far: number): Mat4 => {
//  const f = 1.0 / Math.tan(fovy / 2), nf = 1 / (near - far)
	const f = 1, nf = 1 / (near - far);  // Hard-coded FOV to PI / 2 here.
	return [
		f / aspect, 0, 0, 0,
		0, f, 0, 0,
		0, 0, (far + near) * nf, -1,
		0, 0, (2 * far * near) * nf, 0
	];
};

// Transform a vec3 my a mat4. w is assumed 1 in the vec4 used internally.
export const mat4_mulPosition = (m: Mat4, a: Vec3): Vec3 => {
    const x = a[0], y = a[1], z = a[2];
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w || 1;
    return [
        (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
        (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
        (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    ];
};

// Multiply a vec3 by the upper left mat3 of a mat4.
export const mat4_mulNormal = (m: Mat4, a: Vec3): Vec3 => [
    a[0]*m[0] + a[1]*m[4] + a[2]*m[8],
    a[0]*m[1] + a[1]*m[5] + a[2]*m[9],
    a[0]*m[2] + a[1]*m[6] + a[2]*m[10]
];

export const mat4_identity = (): Mat4 => math_range(0,16).map(x=>x%5?0:1) as Mat4;

export const mat4_multiply = (a: Mat4, b: Mat4): Mat4 => 
    math_range(0,16).map((x,i,j:any) => (
        i=4*(x/4|0), j=x%4,
        b[i]*a[j] + b[i+1]*a[j+4] + b[i+2]*a[j+8] + b[i+3]*a[j+12]
    )) as Mat4;

export const mat4_fromRotationTranslationScale = (q: Quat, v: Vec3, s: Vec3): Mat4 => {
    const x = q[0], y = q[1], z = q[2], w = q[3];

    return [
        (1 - (y*y*2 + z*z*2)) * s[0],
        (x*y*2 + w*z*2) * s[0],
        (x*z*2 - w*y*2) * s[0],
        0,
            (x*y*2 - w*z*2) * s[1],
            (1 - (x*x*2 + z*z*2)) * s[1],
            (y*z*2 + w*x*2) * s[1],
            0,
        (x*z*2 + w*y*2) * s[2],
        (y*z*2 - w*x*2) * s[2],
        (1 - (x*x*2 + y*y*2)) * s[2],
        0,
            v[0],
            v[1],
            v[2],
            1
    ];
};