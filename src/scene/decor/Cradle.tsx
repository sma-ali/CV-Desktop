'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { useSceneStoreApi } from '../core/store-context';
import { CRADLE, cradleBallX, cradleHits, cradleSwing } from './layout';
import type { Part } from './merge';
import { box, MergedParts, rodPart, sph, usePressTime, WOOD } from './shared';

// Le pendule de Newton, posé dans le coin avant gauche. Un clic lève la
// bille de gauche et la lâche : elle frappe les autres, celle de droite
// part, revient, et le va-et-vient s'amortit (cradleSwing, layout.ts).
// Chaque choc fait « clac ». Mouvement réduit : rien ne bouge.

const STEEL = 0xc9ced6;
const FRAME = 0x2b2c30;
/** L'écart des deux fils d'une bille, de part et d'autre de son plan. */
const STRING_SPREAD = CRADLE.hd - 0.05;

/** Le socle et le cadre (repère du monde). */
function frameParts(): Part[] {
  const [cx, , cz] = CRADLE.center;
  const { hw, hd, base, top } = CRADLE;
  const px = hw - 0.05;
  const pz = hd - 0.05;
  const parts: Part[] = [
    {
      geometry: box(hw * 2, base, hd * 2),
      color: WOOD,
      finish: 'satin',
      position: [cx, base / 2, cz],
    },
  ];
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      parts.push(
        rodPart(
          [cx + sx * px, base, cz + sz * pz],
          [cx + sx * px, top, cz + sz * pz],
          0.018,
          FRAME,
        ),
      );
    }
    parts.push(rodPart([cx - px, top, cz + sz * pz], [cx + px, top, cz + sz * pz], 0.018, FRAME));
  }
  return parts;
}

/** Une bille et ses deux fils, dans le repère de son point d'attache. */
function ballParts(): Part[] {
  const { radius, length } = CRADLE;
  return [
    { geometry: sph(radius, 1), color: STEEL, finish: 'metal', position: [0, -length, 0] },
    rodPart([0, 0, -STRING_SPREAD], [0, -length + radius * 0.6, 0], 0.005, 0xe8e2d4, 'satin', 4),
    rodPart([0, 0, STRING_SPREAD], [0, -length + radius * 0.6, 0], 0.005, 0xe8e2d4, 'satin', 4),
  ];
}

const BALLS = Array.from({ length: CRADLE.balls }, (_, i) => i);

export function Cradle() {
  const store = useSceneStoreApi();
  const { at, handlers } = usePressTime();
  const balls = useRef<(Group | null)[]>([]);
  const heard = useRef({ at: null as number | null, count: 0 });

  useFrame(() => {
    const { frame, settings, sound } = store.getState();
    const reduced = settings.reducedMotion;
    const swing = cradleSwing(frame.t, at.current, reduced);
    balls.current.forEach((ball, i) => {
      if (!ball) return;
      const end = (i === 0 && swing < 0) || (i === CRADLE.balls - 1 && swing > 0);
      ball.rotation.z = end ? swing : 0;
    });
    // Un « clac » par nouveau choc, de plus en plus doux.
    if (heard.current.at !== at.current) heard.current = { at: at.current, count: 0 };
    const hits = cradleHits(frame.t, at.current, reduced);
    if (hits.count > heard.current.count) {
      heard.current.count = hits.count;
      sound.play('clack', 0.3 + 0.7 * hits.strength);
    }
  });

  return (
    <group name="decor-cradle" {...handlers}>
      <MergedParts build={frameParts} />
      {BALLS.map((i) => (
        <group
          key={i}
          ref={(node) => {
            balls.current[i] = node;
          }}
          position={[cradleBallX(i), CRADLE.top, CRADLE.center[2]]}
        >
          <MergedParts build={ballParts} />
        </group>
      ))}
    </group>
  );
}
