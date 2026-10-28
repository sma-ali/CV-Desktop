'use client';

import { useEffect, useMemo } from 'react';
import type { SceneTexts } from '../core/texts';
import { TagAnchor } from './TagLayer';
import { paintPostit, paintPostitBack, POSTIT_TEXTURE } from './paint';
import { postitRestPose } from './presentation';
import { lyingPostitGeometry } from './shapes';
import { usePaintedMaterial } from './usePaintedMaterial';
import { usePresentation } from './usePresentation';

// Le post-it à décoller (DARES, 2024), collé en bas à droite du cadre de
// l'écran : « Ticket résolu » et le volume de tickets au recto, le support
// N1/N2 au verso. Présenté, il se décolle (arc plus court) et se retourne.

export function PostIt({ texts }: { texts: SceneTexts }) {
  const { content, locale } = texts;
  const { dares } = content.facts;

  const front = usePaintedMaterial(
    useMemo(
      () => paintPostit('#f3d46a', 61, content.postit.resolved, dares.tickets),
      [content.postit.resolved, dares.tickets],
    ),
    { ...POSTIT_TEXTURE, redrawKey: locale, roughness: 0.85 },
  );
  const back = usePaintedMaterial(
    useMemo(() => paintPostitBack(content), [content]),
    { ...POSTIT_TEXTURE, redrawKey: locale, roughness: 0.85, back: true },
  );

  const geometry = useMemo(() => lyingPostitGeometry(0.78), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const rest = useMemo(() => postitRestPose(), []);
  const glow = useMemo(() => [front, back], [front, back]);
  const { ref, handlers } = usePresentation({ id: 'postit', rest, arc: 0.4, seed: 0.5, glow });

  return (
    <group ref={ref} {...handlers}>
      <mesh geometry={geometry} material={front} castShadow receiveShadow />
      <mesh geometry={geometry} material={back} />
      <TagAnchor id="postit" />
    </group>
  );
}
