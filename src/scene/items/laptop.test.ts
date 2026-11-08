import type { SceneContent } from '@/content/scene/schema';
import { describe, expect, it } from 'vitest';
import { laptopSkills, layoutLaptopChips } from './paint';

// Seuls les champs que lit laptopSkills : le contenu réel
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

describe('le portable porte les compétences', () => {
  it('ses autocollants sont des compétences, sans les noms des projets', () => {
    expect(laptopSkills(scene)).toEqual(['TypeScript', 'React', 'Node.js', 'Next.js', 'Proxmox']);
  });

  it('son écran range toutes les compétences, groupe par groupe, sans déborder', () => {
    const groups = [
      { label: 'Front-end', items: ['React', 'TypeScript', 'Next.js'] },
      { label: 'IA & LLM', items: ['Agents IA', 'RAG', 'LLM-as-judge', 'Claude Code'] },
    ];
    const measure = (text: string) => text.length * 10;
    const { placed, bottom } = layoutLaptopChips(groups, measure, 16, 50, 300, 100);
    const chips = placed.filter((item) => item.kind === 'chip').map((item) => item.text);
    expect(chips).toEqual(groups.flatMap((group) => group.items));
    for (const item of placed) expect(item.x + item.width).toBeLessThanOrEqual(300);
    // Chaque groupe ouvre une ligne, sous le précédent.
    const labels = placed.filter((item) => item.kind === 'label');
    expect(labels.map((item) => item.x)).toEqual([50, 50]);
    expect(labels[1]!.y).toBeGreaterThan(labels[0]!.y);
    expect(bottom).toBeGreaterThan(labels[1]!.y);
  });
});
