'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  onError: () => void;
  children: ReactNode;
}

// Si la scène plante (au chargement de son fichier ou au rendu), la page passe
// au repli au lieu de rester noire.
export class SceneBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
