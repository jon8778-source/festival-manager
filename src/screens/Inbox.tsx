import { useEffect, useState } from 'react';
import { useGame } from '../app/store';
import { Button } from '../components/Button';
import { DecisionCard } from '../components/DecisionCard';
import { Screen } from '../components/Screen';
import ui from '../components/ui.module.css';
import { defaultContent, getEmail, getEvent, type EmailAction } from '../core/content';
import { emailText, revenueAtScale, talksFor, type Email } from '../core/game';
import styles from './Inbox.module.css';

function dayLabel(day: number): string {
  return day === 0 ? 'Festival day' : `${day} ${day === 1 ? 'day' : 'days'} to go`;
}

function EmailView({ email, onClose }: { email: Email; onClose: () => void }) {
  const { game, dispatch, go } = useGame();
  const text = emailText(email);
  const template = getEmail(defaultContent, email.templateId);
  const counterLive = email.templateId === 'counter' && !!email.bandId && !!talksFor(game, email.bandId).counter;

  const run = (action: EmailAction) => {
    const bandId = email.bandId;
    switch (action) {
      case 'lineup':
      case 'site':
      case 'tickets':
      case 'finances':
        go({ name: action });
        return;
      case 'negotiate':
        if (bandId) go({ name: 'negotiation', bandId });
        return;
      case 'acceptCounter':
        if (bandId) dispatch({ type: 'acceptCounter', bandId });
        return;
      case 'walkAway':
        if (bandId) dispatch({ type: 'walkAway', bandId });
        return;
      case 'continue':
        dispatch({ type: 'continue' });
        go({ name: 'hub' });
        return;
      case 'dismiss':
        dispatch({ type: 'dismissEmail', emailId: email.id });
        onClose();
        return;
    }
  };

  // Accept and Walk away only work while the counter stands; Negotiate while talks are open.
  const answerable = (action: EmailAction) => {
    if (action === 'acceptCounter' || action === 'walkAway') return counterLive;
    if (action === 'negotiate') return !!email.bandId && talksFor(game, email.bandId).status === 'open';
    return true;
  };

  return (
    <article className={ui.card}>
      <p className={ui.muted} style={{ margin: 0 }}>
        From {text.from} · {dayLabel(email.day)}
      </p>
      <h2 className={ui.cardTitle} style={{ marginTop: 4 }}>
        {text.subject}
      </h2>
      <p>{text.body}</p>
      {email.decision ? (
        <DecisionCard
          event={getEvent(defaultContent, email.decision.eventId)}
          r={revenueAtScale(game)}
          chosen={email.decision.chosen}
          onChoose={(option) => dispatch({ type: 'chooseDecision', emailId: email.id, option })}
        />
      ) : (
        <div className={ui.buttonRow}>
          {template.buttons.map((b) => (
            <Button key={b.label} variant={b.action === 'walkAway' ? 'danger' : 'primary'} disabled={!answerable(b.action)} onClick={() => run(b.action)}>
              {b.label}
            </Button>
          ))}
        </div>
      )}
      {email.templateId === 'counter' && !counterLive && <p className={ui.muted}>This counter-offer has closed.</p>}
      <div style={{ marginTop: 12 }}>
        <Button variant="ghost" onClick={onClose}>
          ← All emails
        </Button>
      </div>
    </article>
  );
}

export function Inbox({ emailId }: { emailId?: string }) {
  const { game, dispatch } = useGame();
  const [openId, setOpenId] = useState<string | undefined>(emailId);
  const open = game.inbox.find((e) => e.id === openId);

  useEffect(() => {
    if (open && !open.read) dispatch({ type: 'readEmail', emailId: open.id });
  }, [open, dispatch]);

  const emails = [...game.inbox].reverse();
  return (
    <Screen title="Inbox">
      {open ? (
        <EmailView email={open} onClose={() => setOpenId(undefined)} />
      ) : (
        <ul className={styles.list}>
          {emails.map((e) => {
            const text = emailText(e);
            const waiting = e.decision && e.decision.chosen === null;
            return (
              <li key={e.id}>
                <button type="button" className={`${styles.item} ${e.read ? '' : styles.unread}`} onClick={() => setOpenId(e.id)}>
                  <span className={styles.meta}>
                    <span>{e.read ? '' : '● '}{text.from}</span>
                    <span>{dayLabel(e.day)}</span>
                  </span>
                  <span className={styles.subject}>
                    {waiting ? '❗ ' : ''}
                    {text.subject}
                  </span>
                  <span className={styles.preview}>{text.body}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
