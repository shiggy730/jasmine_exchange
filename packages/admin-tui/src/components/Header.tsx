import React from 'react';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

interface HeaderProps {
  mode: 'dashboard' | 'crud';
  width: number;
}

export function Header({ mode, width }: HeaderProps) {
  const rightLabel = mode === 'dashboard' ? 'OPERATIONAL DASHBOARD' : 'ADMIN — PLAYERS & PLANTS';

  return (
    <TitledBox
      title="JASMINE ADMIN"
      rightLabel={rightLabel}
      width={width}
      borderColor={colors.border}
      titleColor={colors.title}
    />
  );
}
