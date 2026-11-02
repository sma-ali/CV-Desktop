import type { SceneContent } from '@/content/scene/schema';
import { describe, expect, it } from 'vitest';
import { laptopChips, laptopSkills } from './paint';

// Seuls les champs que lisent laptopSkills et laptopChips : le contenu réel
// n'entre pas dans src/scene (il arrive en props), même dans les tests.
const scene = {
  screen: { words: { stackItems: ['TypeScript', 'React', 'Node.js'] } },
  facts: {
    projects: {
      items: [
        { name: 'Netherbrain', tagline: '...' },
        { name: 'Homelab', tagline: '...' },
      ],
      stickers: ['Netherbrain', 'TypeScript', 'Homelab', 'Next.js', 'Proxmox'],
      chips: ['Next.js', 'FastAPI', 'pgvector', 'Proxmox', 'WireGuard'],
    },
  },
} as unknown as SceneContent;

describe('le portable porte la pile', () => {
  it('ses autocollants sont des compétences, sans les noms des projets', () => {
    expect(laptopSkills(scene)).toEqual(['TypeScript', 'React', 'Node.js', 'Next.js', 'Proxmox']);
  });

  it('son écran montre la pile puis les technologies des projets qui sont des compétences', () => {
    const skills = [
      'TypeScript',
      'React',
      'Next.js',
      'Node.js',
      'FastAPI',
      'PostgreSQL / pgvector',
    ];
    const chips = laptopChips(scene, [...skills, 'Proxmox']);
    expect(chips).toEqual([
      'TypeScript',
      'React',
      'Node.js',
      'Next.js',
      'Proxmox',
      'FastAPI',
      'pgvector',
    ]);
    expect(chips).not.toContain('WireGuard');
    expect(chips).not.toContain('Netherbrain');
    expect(chips).not.toContain('Homelab');
  });
});
