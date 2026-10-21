import { useRef, useState } from 'react';
import { saveFile } from '../app/files';
import { useStore } from '../app/store';
import { readLog } from '../app/storage';
import { Button } from '../components/Button';
import ui from '../components/ui.module.css';
import { toJsonl } from '../core/playtestLog';
import { deserialise, exportFileName, serialise } from '../core/save';

export function Settings() {
  const { game, dispatch, back, loadGame, settings, updateSettings } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const exportSave = async () => {
    if (!game) return;
    const now = new Date().toISOString();
    await saveFile(exportFileName(now), serialise(game, now), 'application/json');
    setMessage({ text: 'Save exported.', ok: true });
  };

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    const result = deserialise(await file.text());
    if (result.ok) {
      loadGame(result.state);
      setMessage({ text: 'Save loaded. Open the main menu to carry on.', ok: true });
    } else {
      setMessage({ text: result.error, ok: false });
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const downloadLog = async () => {
    const records = readLog();
    const date = new Date().toISOString().slice(0, 10);
    await saveFile(`festival-manager-log-${date}.jsonl`, toJsonl(records), 'application/x-ndjson');
    setMessage({ text: `Playtest log ready: ${records.length} records.`, ok: true });
  };

  return (
    <main className={ui.screen} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div className={ui.content}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        {message && (
          <p role="status" className={message.ok ? ui.ok : ui.bad} style={{ margin: 0 }}>
            {message.ok ? '✓' : '⚠️'} {message.text}
          </p>
        )}

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Save</h2>
          <p className={ui.muted} style={{ marginTop: 0 }}>
            The game saves itself in this browser. Export a copy to keep it safe if the browser is cleared.
          </p>
          <div className={ui.buttonRow}>
            <Button disabled={!game} onClick={exportSave}>
              Export save
            </Button>
            <Button onClick={() => fileInput.current?.click()}>Import save</Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => importSave(e.target.files?.[0])}
          />
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Playtest log</h2>
          <p className={ui.muted} style={{ marginTop: 0 }}>
            A record of your choices, kept only on this device. Send it to the developer after a playtest.
          </p>
          <Button onClick={downloadLog}>Download log</Button>
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Accessibility</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
            <input
              type="checkbox"
              style={{ width: 24, height: 24 }}
              checked={settings.reducedMotion}
              onChange={(e) => updateSettings({ ...settings, reducedMotion: e.target.checked })}
            />
            Reduce motion (stops the festival scene animating)
          </label>
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Randy's tutorial</h2>
          {game ? (
            game.tutorial.skipped ? (
              <p style={{ margin: 0 }}>Skipped for this game.</p>
            ) : (
              <Button onClick={() => dispatch({ type: 'skipTutorial' })}>Skip the chat</Button>
            )
          ) : (
            <p style={{ margin: 0 }}>Randy talks you through your first festival. You can skip him at any time.</p>
          )}
        </section>

        <Button variant="primary" wide onClick={back}>
          Back
        </Button>
      </div>
    </main>
  );
}
