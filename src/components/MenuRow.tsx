import styles from './ui.module.css';

interface Props {
  icon: string;
  label: string;
  detail?: string;
  badge?: number;
  onClick: () => void;
}

export function MenuRow({ icon, label, detail, badge, onClick }: Props) {
  return (
    <button type="button" className={styles.menuRow} onClick={onClick}>
      <span className={styles.menuIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.menuLabel}>{label}</span>
      {detail && <span className={styles.menuDetail}>{detail}</span>}
      {badge ? (
        <span className={styles.badge} aria-label={`${badge} unread`}>
          {badge}
        </span>
      ) : null}
      <span aria-hidden="true">›</span>
    </button>
  );
}
