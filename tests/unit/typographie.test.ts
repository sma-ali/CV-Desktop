import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Fichiers suivis par git, plus les nouveaux fichiers pas encore commités.
function repositoryFiles(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      encoding: 'utf8',
    },
  );
  return output
    .split('\0')
    .filter((file) => file !== '' && file !== 'package-lock.json' && existsSync(file));
}

describe('typographie du dépôt', () => {
  it("n'utilise jamais de tiret cadratin ni de demi-cadratin", () => {
    const dashed: string[] = [];
    for (const file of repositoryFiles()) {
      const buffer = readFileSync(file);
      if (buffer.includes(0)) continue; // fichier binaire
      buffer
        .toString('utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/[\u2013\u2014]/.test(line)) dashed.push(`${file}:${index + 1}`);
        });
    }
    expect(dashed).toEqual([]);
  });
});
