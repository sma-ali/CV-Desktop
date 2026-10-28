'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Mesh,
} from 'three';
import { LAMP, LAMP_COLOR } from '../core/constants';
import { useSceneStoreApi } from '../core/store-context';
import { coneOpacity } from './lighting';
import { STAGE_PRIORITY } from './priorities';
import { noRaycast } from './shaders';

/** Demi-angle d'ouverture du cône visible (un peu moins que le projecteur). */
const CONE_ANGLE = 0.6;

const vertexShader = /* glsl */ `
varying float vY;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vY = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

// Plus dense face à la caméra et près de l'abat-jour.
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vY;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = pow(abs(dot(vNormal, vView)), 1.6);
  float a = uOpacity * facing * (0.25 + 0.75 * vY);
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`;

// Le cône de lumière de la lampe, visible dans la poussière de l'air : un
// tronc de cône ouvert, en mélange additif, qui suit la lampe.
export function LampCone() {
  const store = useSceneStoreApi();
  const meshRef = useRef<Mesh<CylinderGeometry, ShaderMaterial>>(null);
  const { geometry, material, position, quaternion } = useMemo(() => {
    const head = new Vector3(...LAMP.head);
    const aim = new Vector3(...LAMP.aim);
    const length = head.distanceTo(aim) * 0.92;
    const cone = new CylinderGeometry(0.22, length * Math.tan(CONE_ANGLE), length, 18, 1, true);
    cone.translate(0, -length / 2, 0);
    const shader = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(LAMP_COLOR) }, uOpacity: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const direction = aim.clone().sub(head).normalize();
    return {
      geometry: cone,
      material: shader,
      position: head.clone().add(new Vector3(0, -0.2, 0)),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), direction),
    };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const uniform = meshRef.current?.material.uniforms.uOpacity;
    if (!uniform) return;
    const { frame, mood } = store.getState();
    uniform.value = coneOpacity(frame.lamp, frame.lampFlash, frame.window, mood);
  }, STAGE_PRIORITY.lights);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={position}
      quaternion={quaternion}
      renderOrder={3}
      raycast={noRaycast}
    />
  );
}
