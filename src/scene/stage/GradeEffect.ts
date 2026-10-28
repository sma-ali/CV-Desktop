import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';

// L'étalonnage chaud du prototype (GradeShader), en effet de postprocessing :
// ombres froides et hautes lumières chaudes, courbe douce, vignette,
// assombrissement autour de ce qu'on présente, fondu depuis le noir de
// l'arrivée. Le prototype travaillait sur des valeurs d'affichage (sans
// gestion des couleurs) : on repasse en sRGB pour appliquer les mêmes
// formules, puis on revient en linéaire pour la suite de la chaîne.
//
// La vignette est un peu plus légère que celle du prototype (0.85) : la page pose
// déjà une vignette CSS par-dessus le canvas (Desk.module.css), les deux
// ensemble retrouvent la sienne.

const fragmentShader = /* glsl */ `
uniform float uDim;
uniform float uFade;
uniform float uVignette;
uniform vec2 uFocus;

vec3 gradeToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 gradeToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = gradeToSrgb(max(inputColor.rgb, 0.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c *= mix(vec3(0.86, 0.95, 1.08), vec3(1.05, 1.0, 0.92), smoothstep(0.08, 0.7, l));
  c = c * 1.02;
  c = c / (1.0 + c * 0.12);
  c = pow(max(c, 0.0), vec3(0.95));
  vec2 d = uv - 0.5;
  float v = smoothstep(1.1, 0.3, length(d * vec2(aspect * 0.8, 1.0)));
  c *= mix(1.0, v, uVignette);
  vec2 fd = (uv - uFocus) * vec2(aspect, 1.0);
  float fm = smoothstep(0.62, 0.18, length(fd));
  c *= mix(1.0, 0.36 + 0.64 * fm, uDim);
  c *= uFade;
  outputColor = vec4(gradeToLinear(c), inputColor.a);
}`;

export class GradeEffect extends Effect {
  private readonly dimUniform = new Uniform(0);
  private readonly fadeUniform = new Uniform(1);
  private readonly focusUniform = new Uniform(new Vector2(0.5, 0.5));

  constructor({ vignette = 0.75 }: { vignette?: number } = {}) {
    super('GradeEffect', fragmentShader, { blendFunction: BlendFunction.SRC });
    this.uniforms.set('uDim', this.dimUniform);
    this.uniforms.set('uFade', this.fadeUniform);
    this.uniforms.set('uFocus', this.focusUniform);
    this.uniforms.set('uVignette', new Uniform(vignette));
  }

  /** Assombrissement autour du point de focus (0 à 1). */
  set dim(value: number) {
    this.dimUniform.value = value;
  }

  /** Fondu depuis le noir (0 : noir, 1 : image pleine). */
  set fade(value: number) {
    this.fadeUniform.value = value;
  }

  /** Point de focus, en coordonnées d'écran (0 à 1, origine en bas à gauche). */
  setFocus(x: number, y: number) {
    this.focusUniform.value.set(x, y);
  }
}
