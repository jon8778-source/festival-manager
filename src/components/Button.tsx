import type { ButtonHTMLAttributes } from 'react';
import styles from './ui.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  wide?: boolean;
}

export function Button({ variant = 'secondary', wide, className, type = 'button', ...rest }: Props) {
  const classes = [styles.button, variant !== 'secondary' && styles[variant], wide && styles.wide, className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
