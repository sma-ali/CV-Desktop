import type { SceneContent } from '@/content/scene/schema';
import { fitFont, grainy, roundRect } from '../../core/canvas2d';
import { type Painter, wrapText, scaled } from './common';

// La carte de visite (contact)

export const CARD_TEXTURE = { width: 1020, height: 600 } as const;

export function paintCardFront(scene: SceneContent): Painter {
  const { name, headline, location } = scene.facts;
  return scaled(680, (c, w, h, F) => {
    c.fillStyle = '#e8dcc4';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 71, 5000, 0.05);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#1f1710';
    fitFont(c, name, w - 110, 104, 650, F.serif);
    c.fillText(name, 52, 190);
    c.fillStyle = '#c9973f';
    c.fillRect(56, 226, 90, 5);
    c.fillStyle = '#1f1710';
    const title = headline.toLocaleUpperCase();
    fitFont(c, title, w - 110, 30, 500, F.mono);
    c.fillText(title, 56, 290);
    c.fillStyle = '#6a5a48';
    fitFont(c, location, w - 110, 28, 'italic 400', F.serif);
    c.fillText(location, 56, 340);
    c.strokeStyle = 'rgba(201,151,63,.8)';
    c.lineWidth = 2;
    c.strokeRect(18, 18, w - 36, h - 36);
  });
}

export function paintCardBack(scene: SceneContent): Painter {
  const { availability, location, email, linkedin } = scene.facts;
  const { contact } = scene.card;
  return scaled(680, (c, w, h, F) => {
    c.fillStyle = '#1f1710';
    c.fillRect(0, 0, w, h);
    grainy(c, w, h, 72, 5000, 0.08);
    c.strokeStyle = 'rgba(201,151,63,.8)';
    c.lineWidth = 2;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#e2c58c';
    c.font = `500 22px ${F.mono}`;
    c.fillText(contact.toLocaleUpperCase(), 56, 82);
    c.fillStyle = '#62d18e';
    c.beginPath();
    c.arc(66, 136, 10, 0, 7);
    c.fill();
    c.fillStyle = '#f3e9d4';
    fitFont(c, availability, w - 160, 46, 600, F.serif);
    c.fillText(availability, 92, 152);
    c.font = `italic 400 32px ${F.serif}`;
    wrapText(c, location, w - 112)
      .slice(0, 2)
      .forEach((line, i) => c.fillText(line, 56, 214 + i * 40));
    c.fillStyle = '#c9973f';
    roundRect(c, 56, 288, w - 112, 1.5, 0);
    c.fill();
    c.fillStyle = '#f3e9d4';
    fitFont(c, email, w - 112, 26, 500, F.mono);
    c.fillText(email, 56, 330);
    c.fillStyle = '#e2c58c';
    fitFont(c, linkedin, w - 112, 24, 500, F.mono);
    c.fillText(linkedin, 56, 368);
  });
}
