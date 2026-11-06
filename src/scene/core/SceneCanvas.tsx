'use client';

import { Canvas } from '@react-three/fiber';
import { useEffect, useState, type ReactNode } from 'react';
import { Color } from 'three';
import { ClockDriver } from './ClockDriver';
import { BACKGROUND, REST } from './constants';
import { useSceneStore } from './store-context';

export interface SceneCanvasProps {
  /** aria-label du canvas. */
  label: string;
  className?: string;
  /** La scène a dessiné ses premières images. */
  onReady?: () => void;
  /** Le contexte WebGL est perdu : la page passe au repli. */
  onContextLost?: () => void;
  children: ReactNode;
}

// Le Canvas de React Three Fiber, réglé pour retrouver le rendu du prototype :
//
// - gestion des couleurs active (défaut de three) : textures de canvas en
//   sRGB, sortie en sRGB. r128 n'en avait pas : les intensités du prototype
//   se recalibrent (voir docs/scene-3d.md) ;
// - pas de tone mapping (flat) : l'étalonnage du prototype se fait en
//   post-traitement (mise en scène) ;
// - ombres PCF ;
// - anticrénelage confié au post-traitement (voir gl) ;
// - densité de pixels bornée à 2 (la qualité adaptative peut descendre) ;
// - rendu suspendu quand l'onglet est caché.
export function SceneCanvas({
  label,
  className,
  onReady,
  onContextLost,
  children,
}: SceneCanvasProps) {
  const noShadow = useSceneStore((state) => state.settings.noShadow);
  const noPost = useSceneStore((state) => state.settings.noPost);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <Canvas
      className={className}
      shadows={noShadow ? false : 'percentage'}
      flat
      dpr={[1, 2]}
      // Le post-traitement dessine la scène dans ses propres cibles, avec son
      // multisampling : l'anticrénelage du canvas ne servirait qu'au quad
      // final. Il n'est gardé que sans post-traitement (?nopost).
      gl={{ antialias: noPost, powerPreference: 'high-performance' }}
      camera={{ fov: REST.landscape.fov, near: 0.1, far: 90, position: [0, 13, 9] }}
      frameloop={hidden ? 'never' : 'always'}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(BACKGROUND, 1);
        scene.background = new Color(BACKGROUND);
        const canvas = gl.domElement;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', label);
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <ClockDriver onReady={onReady} />
      {children}
    </Canvas>
  );
}
