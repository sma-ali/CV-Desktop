'use client';

import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { extraLineChars } from '../core/arrival';
import { ARRIVAL, MONITOR } from '../core/constants';
import { Box, Cyl } from '../core/geometry';
import { standardMaterial } from '../core/materials';
import { useSceneStoreApi } from '../core/store-context';
import type { SceneTexts } from '../core/texts';
import { paintCanvasTexture, useCanvasTexture, useSceneFonts } from '../core/textures';
import { ITEMS_PRIORITY, type PresentState } from './presentation';
import {
  closingBand,
  codeLength,
  drawScreen,
  linkAt,
  SCREEN_TEXTURE,
  tokenize,
  type ScreenFrame,
} from './screen';
import { usePresentation } from './usePresentation';

// L'écran principal (mon et monTilt du prototype) : pied, dalle inclinée,
// petite caméra posée dessus, deux post-it décoratifs sur le bord gauche, et
// le code du parcours qui se tape pendant l'arrivée. Un clic le présente : il
// ne se soulève pas, la caméra de la mise en scène s'en approche
// (SCREEN_FOCUS). Un clic sur « voirPortable() » présente le portable, où
// sont toutes les compétences.
//
// Une fois le code tapé, la grande texture (2048x1152) ne change plus : la
// ligne finale qui se tape en boucle et le curseur qui clignote vivent dans
// une bande à part (closingBand), posée par-dessus, seule repeinte ensuite.

const metal = () => standardMaterial(0x2a2826, { roughness: 0.4, metalness: 0.4 });

/** Au plus 30 rafraîchissements de la texture par seconde pendant la frappe. */
const REPAINT_INTERVAL = 1 / 30;

function sameFrame(a: ScreenFrame, b: ScreenFrame): boolean {
  return a.typed === b.typed && a.extra === b.extra && a.cursor === b.cursor;
}

export function Monitor({ texts }: { texts: SceneTexts }) {
  const store = useSceneStoreApi();
  const { screen } = texts.content;
  const tokens = useMemo(() => screen.code.map(tokenize), [screen.code]);
  const total = useMemo(() => codeLength(screen.code), [screen.code]);

  // Ce que montrent l'écran et sa bande, lu par le dessin ; une nouvelle
  // image seulement s'il change.
  const shown = useRef<ScreenFrame>({ typed: 0, extra: 0, cursor: true });
  const bandShown = useRef<ScreenFrame>({ typed: total, extra: 0, cursor: false });
  const sincePaint = useRef(0);
  const band = useMemo(
    () => closingBand(screen.code, screen.closing),
    [screen.code, screen.closing],
  );
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
  // La bande : le même éditeur, décalé pour n'en garder que les lignes de la fin.
  const drawBand = useMemo(
    () =>
      (
        ctx: CanvasRenderingContext2D,
        _w: number,
        _h: number,
        fonts: Parameters<typeof drawScreen>[3],
      ) => {
        ctx.translate(0, -band.top);
        drawScreen(
          ctx,
          SCREEN_TEXTURE.width,
          SCREEN_TEXTURE.height,
          fonts,
          screen,
          tokens,
          bandShown.current,
        );
      },
    [screen, tokens, band],
  );
  const texture = useCanvasTexture({
    ...SCREEN_TEXTURE,
    draw,
    redrawKey: texts.locale,
    anisotropy: 16,
  });
  const bandTexture = useCanvasTexture({
    width: SCREEN_TEXTURE.width,
    height: band.height,
    draw: drawBand,
    redrawKey: `${texts.locale}:${band.top}`,
    anisotropy: 16,
  });
  const { fonts } = useSceneFonts();

  const screenMaterial = useMemo(
    () => new MeshBasicMaterial({ map: texture, color: 0x000000, toneMapped: false }),
    [texture],
  );
  const bandMaterial = useMemo(
    () => new MeshBasicMaterial({ map: bandTexture, color: 0x000000, toneMapped: false }),
    [bandTexture],
  );
  const bandMesh = useRef<Mesh>(null);
  // Plan de la bande, à la même échelle que la dalle (texels de même taille).
  const bandPlane = useMemo(() => {
    const { width, height } = MONITOR.screen;
    const geometry = new PlaneGeometry(width, (height * band.height) / SCREEN_TEXTURE.height);
    const y = height / 2 - (height * (band.top + band.height / 2)) / SCREEN_TEXTURE.height;
    return { geometry, y };
  }, [band]);
  const ledMaterial = useMemo(() => new MeshBasicMaterial({ color: 0x220808 }), []);
  const screenGeometry = useMemo(
    () => new PlaneGeometry(MONITOR.screen.width, MONITOR.screen.height),
    [],
  );
  useEffect(
    () => () => {
      screenMaterial.dispose();
      bandMaterial.dispose();
      ledMaterial.dispose();
      screenGeometry.dispose();
      bandPlane.geometry.dispose();
    },
    [screenMaterial, bandMaterial, ledMaterial, screenGeometry, bandPlane],
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

  // Le lien vers le portable : un clic dessus, une fois le code tapé, le présente.
  const onScreenClick = (event: ThreeEvent<MouseEvent>) => {
    const scene = store.getState();
    const uv = event.uv;
    if (!uv || scene.frame.typed < total) return;
    if (!linkAt(screen, uv.x, uv.y)) return;
    event.stopPropagation();
    scene.markUser();
    scene.present('laptop', 'click');
  };

  useFrame(() => {
    const { frame, settings } = store.getState();
    const { t, dt } = frame;
    const reduced = settings.reducedMotion;
    const state = focus.current;
    const boost = state ? state.hover * 0.06 + state.p * 0.04 : 0;
    screenMaterial.color.setScalar(Math.min(1, frame.screen * 0.98 + boost * frame.screen));
    bandMaterial.color.copy(screenMaterial.color);

    // La frappe : le code, puis la ligne finale tapée, laissée et effacée en boucle.
    // Le clavier du décor se cale sur la fin exacte du code.
    frame.typingEnd = ARRIVAL.typingStart + total / ARRIVAL.typingRate;
    const typed = Math.min(frame.typed, total);
    const done = typed >= total;
    const length = screen.closing.length;
    const extra = done ? (reduced ? length : extraLineChars(t, length)) : 0;
    const typing = !done || (extra > 0 && extra < length);
    const cursor = typing || (!reduced && Math.floor(t * 1.9) % 2 === 1);
    sincePaint.current += dt;
    const due = sincePaint.current >= REPAINT_INTERVAL || !typing;
    // Pendant la frappe du code, toute la texture ; ensuite, seulement la
    // bande. La grande texture ne change plus que pour le numéro de ligne de
    // la barre d'état (ligne finale vide ou non) : deux fois par boucle.
    const main: ScreenFrame = done
      ? { typed, extra: extra > 0 ? 1 : 0, cursor: false }
      : { typed, extra: 0, cursor };
    if (bandMesh.current) bandMesh.current.visible = done;
    if (!sameFrame(shown.current, main) && due) {
      Object.assign(shown.current, main);
      sincePaint.current = 0;
      paintCanvasTexture(texture, draw, fonts);
    }
    if (done) {
      const next: ScreenFrame = { typed, extra, cursor };
      if (!sameFrame(bandShown.current, next) && due) {
        Object.assign(bandShown.current, next);
        sincePaint.current = 0;
        paintCanvasTexture(bandTexture, drawBand, fonts);
      }
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
        <mesh
          geometry={screenGeometry}
          material={screenMaterial}
          position={[0, 0, 0.068]}
          onClick={onScreenClick}
        />
        <mesh
          ref={bandMesh}
          geometry={bandPlane.geometry}
          material={bandMaterial}
          position={[0, bandPlane.y, 0.071]}
          visible={false}
        />
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
      </group>
    </group>
  );
}
