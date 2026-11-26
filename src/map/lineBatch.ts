// A batch of straight line segments drawn with a constant width in screen pixels and soft edges
// computed in the shader, so the lines are smooth without multisampling. One draw call per batch.
import * as THREE from 'three';

const VERT = /* glsl */ `
precision highp float;
in vec2 corner;     // x: 0 at the segment start, 1 at its end; y: -1 / +1 across the line
in vec3 iStart;
in vec3 iEnd;
in vec2 iDist;      // distance along the whole path at the start and at the end
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform vec2 uResolution;
uniform float uWidth;
out float vAcross;  // signed distance from the centre line, in pixels
out float vAlong;

void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(iStart, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(iEnd, 1.0);
  vec2 halfRes = uResolution * 0.5;
  vec2 dir = b.xy / b.w * halfRes - a.xy / a.w * halfRes;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  float reach = uWidth * 0.5 + 1.0;   // one extra pixel on each side for the soft edge
  vec4 p = mix(a, b, corner.x);
  p.xy += vec2(-dir.y, dir.x) * corner.y * reach / halfRes * p.w;
  vAcross = corner.y * reach;
  vAlong = mix(iDist.x, iDist.y, corner.x);
  gl_Position = p;
}
`;

const FRAG = /* glsl */ `
precision highp float;
in float vAcross;
in float vAlong;
out vec4 outColor;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uWidth;
uniform vec3 uDash;   // dash length, gap length, offset (world units); dash length 0 = solid

void main() {
  float a = clamp(uWidth * 0.5 + 0.5 - abs(vAcross), 0.0, 1.0);
  if (uDash.x > 0.0) {
    float t = mod(vAlong + uDash.z, uDash.x + uDash.y);
    float soft = max(fwidth(vAlong), 1e-4);
    a *= smoothstep(0.0, soft, t) * (1.0 - smoothstep(uDash.x - soft, uDash.x, t));
  }
  outColor = vec4(uColor, a * uOpacity);
}
`;

export type LineStyle = { color: number; dash?: [length: number, gap: number] };

export class LineBatch {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: {
    uResolution: { value: THREE.Vector2 };
    uWidth: { value: number };
    uColor: { value: THREE.Color };
    uOpacity: { value: number };
    uDash: { value: THREE.Vector3 };
  };

  constructor(style: LineStyle, renderOrder: number) {
    this.uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uWidth: { value: 2 },
      uColor: { value: new THREE.Color(style.color) },
      uOpacity: { value: 0 },
      uDash: { value: new THREE.Vector3(style.dash?.[0] ?? 0, style.dash?.[1] ?? 0, 0) },
    };
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), 2));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
  }

  /** Replaces the batch with these paths. Each path is a flat list of x,y,z points. */
  setPaths(paths: number[][]): void {
    const starts: number[] = [];
    const ends: number[] = [];
    const dists: number[] = [];
    for (const pts of paths) {
      let along = 0;
      for (let i = 0; i + 5 < pts.length; i += 3) {
        const len = Math.hypot(pts[i + 3] - pts[i], pts[i + 4] - pts[i + 1], pts[i + 5] - pts[i + 2]);
        starts.push(pts[i], pts[i + 1], pts[i + 2]);
        ends.push(pts[i + 3], pts[i + 4], pts[i + 5]);
        dists.push(along, along + len);
        along += len;
      }
    }
    const geo = this.mesh.geometry as THREE.InstancedBufferGeometry;
    // Release what was drawn before. three.js fixes the number of instances it will draw from the
    // attributes a geometry has when it is first drawn, so without this a batch given more segments
    // than its first set is drawn cut short. This also frees the old buffers on the GPU.
    geo.dispose();
    geo.setAttribute('iStart', new THREE.InstancedBufferAttribute(new Float32Array(starts), 3));
    geo.setAttribute('iEnd', new THREE.InstancedBufferAttribute(new Float32Array(ends), 3));
    geo.setAttribute('iDist', new THREE.InstancedBufferAttribute(new Float32Array(dists), 2));
    geo.instanceCount = dists.length / 2;
    this.mesh.visible = geo.instanceCount > 0;
  }

  get count(): number {
    return (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount;
  }

  setResolution(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
  }

  /** Width in pixels, opacity 0..1, and how far the dashes have drifted (world units). */
  style(width: number, opacity: number, dashOffset = 0): void {
    this.uniforms.uWidth.value = width;
    this.uniforms.uOpacity.value = opacity;
    this.uniforms.uDash.value.z = dashOffset;
  }
}
