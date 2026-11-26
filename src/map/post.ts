// Final pass: a faint tilt-shift blur at the very top and bottom of the tilted view, and a vignette.
// Both are kept light: the nodes and links drawn over the map must stay sharp.
import * as THREE from 'three';

const VERT = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform vec2 uTexel;
uniform float uTilt;     // 0 = no blur (top-down view), 1 = full tilt-shift
uniform float uRadius;   // blur radius in pixels at the top and bottom edge

void main() {
  // sharp across a band around the middle, increasingly soft towards the far and near edges
  float away = abs(vUv.y - 0.47);
  float amount = smoothstep(0.30, 0.56, away) * uTilt;
  vec3 col;
  if (amount < 0.02) {
    col = texture(uScene, vUv).rgb;
  } else {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 14; i++) {
      float a = float(i) * 2.39996;
      float r = sqrt((float(i) + 0.5) / 14.0) * amount * uRadius;
      acc += texture(uScene, vUv + vec2(cos(a), sin(a)) * r * uTexel).rgb;
    }
    col = acc / 14.0;
  }
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.86);
  col *= 1.0 - 0.40 * smoothstep(0.36, 0.92, length(q) * 1.28);
  outColor = vec4(col, 1.0);
}
`;

export class PostFX {
  enabled = true;
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly uniforms = {
    uScene: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uTilt: { value: 0 },
    uRadius: { value: 5 },
  };

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new THREE.Mesh(
      geo,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.uniforms,
        depthTest: false,
        depthWrite: false,
      }),
    );
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    this.target?.dispose();
    this.target = new THREE.WebGLRenderTarget(w, h, {
      // No multisampling: the terrain has no hard geometric edges, and lines soften their own edges in the
      // shader. Multisampling would shade every pixel on a triangle edge twice.
      samples: 0,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.target.texture.colorSpace = THREE.NoColorSpace;
    this.uniforms.uScene.value = this.target.texture;
    this.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.uniforms.uRadius.value = 3.2 * pixelRatio;
  }

  /**
   * `repeats` lists further places to draw the whole scene, as offsets along x: the world joins up with
   * itself east-west, so a view across the join shows the far side of the map beside the near one.
   */
  render(scene: THREE.Scene, camera: THREE.Camera, tilt: number, repeats: number[] = []): void {
    if (!this.target) return;
    this.uniforms.uTilt.value = this.enabled ? tilt : 0;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    if (repeats.length) {
      // Moving the camera the other way is the same as moving the scene, and leaves the scene untouched.
      const x = camera.position.x;
      this.renderer.autoClear = false;
      for (const offset of repeats) {
        camera.position.x = x - offset;
        camera.updateMatrixWorld();
        this.renderer.render(scene, camera);
      }
      this.renderer.autoClear = true;
      camera.position.x = x;
      camera.updateMatrixWorld();
    }
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
