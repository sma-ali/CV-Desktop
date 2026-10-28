'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { extraLineChars } from '../core/arrival';
import { ARRIVAL, MONITOR } from '../core/constants';
import { Box, Cyl } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { paintCanvasTexture, useCanvasTexture, useSceneFonts } from '../core/textures';
import { paintPostit, POSTIT_TEXTURE } from './paint';
import { ITEMS_PRIORITY, type PresentState } from './presentation';
import { codeLength, drawScreen, SCREEN_TEXTURE, tokenize, type ScreenFrame } from './screen';
import { standingPostitGeometry } from './shapes';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// L'écran principal (mon et monTilt du prototype) : pied, dalle inclinée,
// petite caméra posée dessus, deux post-it décoratifs sur le bord gauche, et
// le code du parcours qui se tape pendant l'arrivée. Un clic le présente : il
// ne se soulève pas, la caméra de la mise en scène s'en approche
// (SCREEN_FOCUS).

const metal = () => standardMaterial(0x2a2826, { roughness: 0.4, metalness: 0.4 });

/** Au plus 30 rafraîchissements de la texture par seconde pendant la frappe. */
const REPAINT_INTERVAL = 1 / 30;

export function Monitor({ texts }: { texts: SceneTexts }) {
  const store = useSceneStoreApi();
  const { screen, postit } = texts.content;
  const tokens = useMemo(() => screen.code.map(tokenize), [screen.code]);
  const total = useMemo(() => codeLength(screen.code), [screen.code]);

  // Ce que montre l'écran, lu par le dessin ; une nouvelle image seulement s'il change.
  const shown = useRef<ScreenFrame>({ typed: 0, extra: 0, cursor: true });
  const sincePaint = useRef(0);
  const draw = useMemo(
    () =>
      (
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        fonts: Parameters<typeof drawScreen>[3],
      ) =>
        drawScreen(ctx, w, h, fonts, screen, tokens, shown.current),
    [screen, tokens],
  );
  const texture = useCanvasTexture({
    ...SCREEN_TEXTURE,
    draw,
    redrawKey: texts.locale,
    anisotropy: 16,
  });
  const { fonts } = useSceneFonts();

  const screenMaterial = useMemo(
    () => new MeshBasicMaterial({ map: texture, color: 0x000000, toneMapped: false }),
    [texture],
  );
  const ledMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x220808 }), []);
  const screenGeometry = useMemo(
    () => new PlaneGeometry(MONITOR.screen.width, MONITOR.screen.height),
    [],
  );
  const postitGeometries = useMemo(
    () => [standingPostitGeometry(0.72), standingPostitGeometry(0.66)] as const,
    [],
  );
  useEffect(
    () => () => {
      screenMaterial.dispose();
      ledMaterial.dispose();
      screenGeometry.dispose();
      postitGeometries.forEach((geometry) => geometry.dispose());
    },
    [screenMaterial, ledMaterial, screenGeometry, postitGeometries],
  );

  const pinkPostit = usePaintedMaterial(
    useMemo(() => paintPostit('#f2a48f', 62, postit.frame[0]), [postit.frame]),
    { ...POSTIT_TEXTURE, redrawKey: texts.locale, roughness: 0.85 },
  );
  const greenPostit = usePaintedMaterial(
    useMemo(() => paintPostit('#bfe0b5', 63, postit.frame[1]), [postit.frame]),
    { ...POSTIT_TEXTURE, redrawKey: texts.locale, roughness: 0.85 },
  );

  const rest = useMemo(
    () => ({ position: new Vector3(...MONITOR.position), quaternion: new Quaternion() }),
    [],
  );
  // L'écran s'éclaire un peu au survol et quand on le regarde de près.
  const focus = useRef<PresentState | null>(null);
  const { ref, handlers } = usePresentation({
    id: 'monitor',
    rest,
    lift: false,
    animate: (state) => {
      focus.current = state;
    },
  });

  useFrame(() => {
    const { frame, settings } = store.getState();
    const { t, dt } = frame;
    const reduced = settings.reducedMotion;
    const state = focus.current;
    const boost = state ? state.hover * 0.06 + state.p * 0.04 : 0;
    screenMaterial.color.setScalar(Math.min(1, frame.screen * 0.98 + boost * frame.screen));

    // La frappe : le code, puis la ligne finale tapée, laissée et effacée en boucle.
    const typed = Math.min(frame.typed, total);
    const done = typed >= total;
    const length = screen.closing.length;
    const extra = done ? (reduced ? length : extraLineChars(t, length)) : 0;
    const typing = !done || (extra > 0 && extra < length);
    const cursor = typing || (!reduced && Math.floor(t * 1.9) % 2 === 1);
    const current = shown.current;
    sincePaint.current += dt;
    const changed = typed !== current.typed || extra !== current.extra || cursor !== current.cursor;
    if (changed && (sincePaint.current >= REPAINT_INTERVAL || !typing)) {
      current.typed = typed;
      current.extra = extra;
      current.cursor = cursor;
      sincePaint.current = 0;
      paintCanvasTexture(texture, draw, fonts);
    }

    const on = t >= ARRIVAL.webcamLed;
    ledMaterial.color.setRGB(on ? 1.4 : 0.13, on ? 0.18 : 0.03, on ? 0.12 : 0.03);
  }, ITEMS_PRIORITY);

  return (
    <group ref={ref} position={MONITOR.position} {...handlers}>
      <Box size={[1.5, 0.07, 0.95]} position={[0, 0.035, 0.1]} material={metal()} />
      <Box size={[0.22, 1.15, 0.14]} position={[0, 0.62, -0.12]} material={metal()} />
      <group position={[0, MONITOR.tiltY, 0]} rotation={[MONITOR.tiltX, 0, 0]}>
        <Box
          size={[MONITOR.frame.width, MONITOR.frame.height, 0.13]}
          material={standardMaterial(0x1c1a18, { roughness: 0.45, metalness: 0.2 })}
        />
        <Box
          size={[4.2, 2.3, 0.25]}
          position={[0, 0, -0.16]}
          material={standardMaterial(0x23211f, { roughness: 0.6 })}
        />
        <mesh geometry={screenGeometry} material={screenMaterial} position={[0, 0, 0.068]} />
        {/* La petite caméra posée sur le cadre, et sa LED. */}
        <group position={[0, 1.56, 0.02]}>
          <Box size={[0.62, 0.2, 0.2]} material={standardMaterial(0x1e1c1a, { roughness: 0.4 })} />
          <Cyl
            radiusTop={0.07}
            radiusBottom={0.07}
            height={0.06}
            segments={10}
            position={[0, 0, 0.11]}
            rotation={[Math.PI / 2, 0, 0]}
            material={standardMaterial(0x0c0c10, { roughness: 0.2, metalness: 0.6 })}
          />
          <mesh position={[0.2, 0, 0.105]} material={ledMaterial}>
            <sphereGeometry args={[0.025, 6, 4]} />
          </mesh>
          <Box
            size={[0.3, 0.05, 0.3]}
            position={[0, -0.12, -0.08]}
            material={standardMaterial(0x1e1c1a)}
          />
        </group>
        {/* Les post-it décoratifs du bord gauche (le post-it du CV est un objet à part). */}
        <mesh
          geometry={postitGeometries[0]}
          material={pinkPostit}
          position={[-2.66, -1.02, 0.09]}
          rotation={[0, 0, 0.12]}
          castShadow
        />
        <mesh
          geometry={postitGeometries[1]}
          material={greenPostit}
          position={[-2.7, -0.3, 0.1]}
          rotation={[0, 0, -0.08]}
          castShadow
        />
      </group>
    </group>
  );
}
