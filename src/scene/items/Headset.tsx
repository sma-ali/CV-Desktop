'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CatmullRomCurve3, MeshBasicMaterial, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { ARRIVAL, HEADSET_STAND, ITEM_POSES } from '../core/constants';
import { Cyl, Sph } from '../core/geometry';
import { brass, standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import { deskRestPose, ITEMS_PRIORITY } from './presentation';
import { usePresentation } from './usePresentation';

// Le casque-micro sur son support (DARES, le support aux utilisateurs).
// Présenté, il tourne lentement devant la caméra. Sa LED s'allume pendant
// l'arrivée.

const stand = () => standardMaterial(0x2b2927, { roughness: 0.4, metalness: 0.4 });
const dark = () => standardMaterial(0x2a2826, { roughness: 0.5, metalness: 0.2 });
const sage = () => standardMaterial(0x86a07d, { roughness: 0.8 });

/** Le support : pied, tige et crochet (fixe, hors de l'objet présenté). */
function HeadsetStand() {
  const hook = useMemo(() => new TorusGeometry(0.22, 0.04, 5, 10, Math.PI), []);
  useEffect(() => () => hook.dispose(), [hook]);
  return (
    <group position={HEADSET_STAND}>
      <Cyl
        radiusTop={0.36}
        radiusBottom={0.4}
        height={0.08}
        segments={10}
        position={[0, 0.04, 0]}
        material={stand()}
      />
      <Cyl
        radiusTop={0.05}
        radiusBottom={0.05}
        height={1.45}
        segments={7}
        position={[0, 0.76, 0]}
        material={stand()}
      />
      <mesh
        geometry={hook}
        material={stand()}
        position={[0, 1.48, 0]}
        rotation={[0, 0, Math.PI]}
        castShadow
      />
    </group>
  );
}

export function Headset() {
  const store = useSceneStoreApi();
  const geometries = useMemo(() => {
    const boom = new CatmullRomCurve3([
      new Vector3(-0.6, -0.12, 0.05),
      new Vector3(-0.62, -0.3, 0.3),
      new Vector3(-0.45, -0.45, 0.6),
      new Vector3(-0.15, -0.5, 0.72),
    ]);
    return {
      band: new TorusGeometry(0.5, 0.055, 6, 16, Math.PI),
      pad: new TorusGeometry(0.5, 0.06, 4, 10, Math.PI * 0.4),
      boom: new TubeGeometry(boom, 16, 0.022, 5, false),
    };
  }, []);
  const led = useMemo(() => new MeshBasicMaterial({ color: 0x1a0806 }), []);
  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      led.dispose();
    },
    [geometries, led],
  );

  const rest = useMemo(() => deskRestPose(ITEM_POSES.headset), []);
  const { ref, handlers } = usePresentation({ id: 'headset', rest, seed: 0.9 });

  useFrame(() => {
    const on = store.getState().frame.t >= ARRIVAL.headsetLed;
    led.color.setRGB(on ? 0.2 : 0.05, on ? 1.2 : 0.02, on ? 0.5 : 0.02);
  }, ITEMS_PRIORITY);

  return (
    <>
      <HeadsetStand />
      <group ref={ref} {...handlers}>
        <mesh geometry={geometries.band} material={dark()} castShadow />
        <mesh
          geometry={geometries.pad}
          material={sage()}
          rotation={[0, 0, Math.PI * 0.3]}
          scale={[0.97, 0.97, 1.2]}
        />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Cyl
              radiusTop={0.22}
              radiusBottom={0.22}
              height={0.16}
              segments={10}
              position={[side * 0.52, -0.08, 0]}
              rotation={[0, 0, Math.PI / 2]}
              material={dark()}
            />
            <Cyl
              radiusTop={0.18}
              radiusBottom={0.2}
              height={0.08}
              segments={10}
              position={[side * 0.42, -0.08, 0]}
              rotation={[0, 0, Math.PI / 2]}
              material={sage()}
            />
            <Cyl
              radiusTop={0.225}
              radiusBottom={0.225}
              height={0.03}
              segments={10}
              position={[side * 0.61, -0.08, 0]}
              rotation={[0, 0, Math.PI / 2]}
              material={brass()}
            />
          </group>
        ))}
        <mesh geometry={geometries.boom} material={dark()} castShadow />
        <Sph
          radius={0.06}
          detail={1}
          position={[-0.13, -0.5, 0.74]}
          material={standardMaterial(0x1b1916, { roughness: 0.9 })}
        />
        <mesh position={[-0.63, -0.08, 0.12]} material={led}>
          <sphereGeometry args={[0.03, 5, 4]} />
        </mesh>
      </group>
    </>
  );
}
