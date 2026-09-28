import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { daysBetween, dueLabel, relativeDay } from '../../../shared/dates';
import { kidStats, notesFor } from '../../../shared/stats';
import type { KidStats } from '../../../shared/stats';
import { CHECKIN_TAGS, ENERGY_LEVELS, MOOD_EMOJI, MOOD_LABELS, QUEST_CATEGORIES } from '../../../shared/types';
import type { CheckinTag, Energy, Kid, QuestCategory } from '../../../shared/types';
import { ScreenRing } from '../components/charts';
import { Icon } from '../components/Icon';
import { CATEGORY_LABELS, Card, CategoryPill } from '../components/ui';
import { useAnchor } from '../state';

const ENERGY_LABELS: Record<Energy, string> = { low: 'Low battery', ok: 'Okay', high: 'Full power' };

export function KidView() {
  const { ws, today } = useAnchor();
  const [kidId, setKidId] = useState(ws.kids[0].id);
  const kid = ws.kids.find((k) => k.id === kidId) ?? ws.kids[0];
  const stats = useMemo(() => kidStats(ws, kid.id, today), [ws, kid.id, today]);

  return (
    <div className="kid-shell">
      <div className="kid-picker" role="tablist" aria-label="Who is checking in?">
        {ws.kids.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={k.id === kid.id} className="kid-picker-btn" onClick={() => setKidId(k.id)}>
            <span aria-hidden="true">{k.avatar}</span> I’m {k.name}
          </button>
        ))}
      </div>

      <section className="kid-hero">
        <span className="kid-avatar" aria-hidden="true">
          {kid.avatar}
        </span>
        <div>
          <h1>Hey {kid.name}!</h1>
          <div className="kid-badges">
            <span className="kid-badge">
              <Icon name="flame" size={16} /> {stats.streak}-day streak
            </span>
            <span className="kid-badge">
              <Icon name="star" size={16} /> {stats.points} points
            </span>
          </div>
        </div>
      </section>

      <CheckInCard key={`${kid.id}-checkin`} kid={kid} stats={stats} />
      <ScreenCard key={`${kid.id}-screen`} kid={kid} stats={stats} />
      <KidQuests kid={kid} stats={stats} />
      <IdeaCard key={`${kid.id}-idea`} kid={kid} />
      <TeacherMessages kid={kid} />

      <p className="kid-footnote">
        <Icon name="lock" size={14} /> Anchor is private to your family. Your grown-ups see your check-ins, and you can see everything they see.
      </p>
    </div>
  );
}

function CheckInCard({ kid, stats }: { kid: Kid; stats: KidStats }) {
  const { ws, today, act } = useAnchor();
  const existing = ws.checkins.find((c) => c.kidId === kid.id && c.date === today);
  const [editing, setEditing] = useState(!existing);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [energy, setEnergy] = useState<Energy>(existing?.energy ?? 'ok');
  const [tags, setTags] = useState<CheckinTag[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: CheckinTag) =>
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : current.length < 3 ? [...current, tag] : current));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mood === null) return;
    setSaving(true);
    const ok = await act(
      { type: 'check-in', kidId: kid.id, mood, energy, tags, note: note.trim() || undefined },
      existing ? 'Check-in updated' : `Checked in! That’s a ${stats.streak + 1}-day streak`,
    );
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (existing && !editing) {
    return (
      <Card title="Today’s check-in" icon="smile">
        <div className="checked-in">
          <span className="checked-in-face" aria-hidden="true">
            {MOOD_EMOJI[existing.mood - 1]}
          </span>
          <div>
            <strong>
              You’re feeling {MOOD_LABELS[existing.mood - 1].toLowerCase()} with {ENERGY_LABELS[existing.energy].toLowerCase()}.
            </strong>
            <p className="muted">{existing.tags.length ? `About: ${existing.tags.join(', ')}` : 'Thanks for checking in!'}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Change
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="How are you feeling today?" icon="smile" subtitle="Takes 30 seconds. There are no wrong answers.">
      <form onSubmit={submit} className="checkin-form">
        <div className="mood-picker" role="radiogroup" aria-label="Mood">
          {MOOD_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={mood === i + 1}
              className="mood-btn"
              onClick={() => setMood(i + 1)}
            >
              <span className="face" aria-hidden="true">
                {MOOD_EMOJI[i]}
              </span>
              {label}
            </button>
          ))}
        </div>

        <fieldset className="field">
          <legend>Energy</legend>
          <div className="chip-row">
            {ENERGY_LEVELS.map((level) => (
              <button key={level} type="button" className="chip" aria-pressed={energy === level} onClick={() => setEnergy(level)}>
                {ENERGY_LABELS[level]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>What’s it about? (pick up to 3)</legend>
          <div className="chip-row">
            {CHECKIN_TAGS.map((tag) => (
              <button key={tag} type="button" className="chip" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Anything on your mind? (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Your grown-ups can see this" />
        </label>

        <div className="form-actions">
          {existing && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={mood === null || saving}>
            {saving ? 'Saving…' : existing ? 'Update check-in' : 'Check in (+5 pts)'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function ScreenCard({ kid, stats }: { kid: Kid; stats: KidStats }) {
  const { ws, today, act } = useAnchor();
  const [asking, setAsking] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState('');
  const bonus = stats.todayAllowance - kid.dailyScreenMinutes;
  const left = stats.todayAllowance - stats.todayUsed;
  const pending = ws.requests.filter((r) => r.kidId === kid.id && r.status === 'pending');
  const answeredToday = ws.requests.filter((r) => r.kidId === kid.id && r.status !== 'pending' && r.createdOn === today);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 2) return;
    if (await act({ type: 'request-time', kidId: kid.id, minutes, reason: reason.trim() }, `Sent to ${ws.parentName}`)) {
      setAsking(false);
      setReason('');
    }
  };

  return (
    <Card title="Screen time today" icon="clock">
      <div className="screen-row">
        <ScreenRing used={stats.todayUsed} allowance={stats.todayAllowance} />
        <div className="screen-info">
          <p className="screen-left">{left >= 0 ? `${left} min left today` : `${-left} min over today`}</p>
          <p className="muted">
            {kid.dailyScreenMinutes} min budget{bonus > 0 ? ` + ${bonus} min you earned` : ''}
          </p>
          <div className="chip-row">
            <button type="button" className="chip" onClick={() => act({ type: 'log-screen', kidId: kid.id, minutes: 15 }, 'Logged 15 minutes')}>
              + Log 15 min
            </button>
            <button type="button" className="chip" onClick={() => act({ type: 'log-screen', kidId: kid.id, minutes: 30 }, 'Logged 30 minutes')}>
              + Log 30 min
            </button>
          </div>
        </div>
      </div>

      {pending.map((r) => (
        <p key={r.id} className="status-line">
          <Icon name="clock" size={14} /> Waiting for {ws.parentName} to answer your request for {r.minutes} more minutes.
        </p>
      ))}
      {answeredToday.map((r) => (
        <p key={r.id} className="status-line">
          <Icon name={r.status === 'approved' ? 'check' : 'info'} size={14} />
          {r.status === 'approved' ? `${ws.parentName} said yes to ${r.minutes} more minutes!` : `${ws.parentName} said not today.`}
        </p>
      ))}

      {asking ? (
        <form className="ask-form" onSubmit={ask}>
          <div className="chip-row" role="radiogroup" aria-label="How many minutes?">
            {[15, 30, 45].map((m) => (
              <button key={m} type="button" role="radio" aria-checked={minutes === m} className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>
          <label className="field">
            <span>Why? Your grown-up will see this.</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="I finished my reading and want to…" />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={reason.trim().length < 2}>
              Send request
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setAsking(true)}>
          Ask for more time
        </button>
      )}
    </Card>
  );
}

function KidQuests({ kid, stats }: { kid: Kid; stats: KidStats }) {
  const { ws, today, act } = useAnchor();
  const doneToday = ws.quests.filter((q) => q.kidId === kid.id && q.status === 'done' && q.completedOn === today);

  return (
    <Card title="Your quests" icon="star" subtitle={`Each one earns points and ${kid.bonusMinutesPerQuest} bonus screen minutes`}>
      <ul className="kid-quests">
        {stats.openQuests.map((q) => (
          <li key={q.id} className="kid-quest">
            <div>
              <strong>{q.title}</strong>
              <div className="quest-meta">
                <CategoryPill category={q.category} />
                <span>{q.points} pts</span>
                {q.dueDate && <span className={q.dueDate < today ? 'overdue' : undefined}>{dueLabel(q.dueDate, today)}</span>}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-done"
              onClick={() =>
                act({ type: 'complete-quest', questId: q.id }, `Nice work! +${q.points} points and +${kid.bonusMinutesPerQuest} min screen time`)
              }
            >
              <Icon name="check" size={16} /> Done
            </button>
          </li>
        ))}
        {stats.openQuests.length === 0 && <li className="muted">All done! Suggest a new quest below.</li>}
      </ul>
      {doneToday.length > 0 && (
        <div className="done-today">
          <p className="muted">Finished today</p>
          <ul>
            {doneToday.map((q) => (
              <li key={q.id}>
                <Icon name="check" size={14} className="signal-positive" /> {q.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {stats.proposedQuests.length > 0 && (
        <p className="status-line">
          <Icon name="clock" size={14} /> Waiting for {ws.parentName}: {stats.proposedQuests.map((q) => `“${q.title}”`).join(', ')}
        </p>
      )}
    </Card>
  );
}

function IdeaCard({ kid }: { kid: Kid }) {
  const { ws, act } = useAnchor();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<QuestCategory>('life');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (clean.length < 2) return;
    if (await act({ type: 'propose-quest', kidId: kid.id, title: clean, category }, `Sent to ${ws.parentName} for a thumbs up`)) setTitle('');
  };

  return (
    <Card title="Got an idea for a quest?" icon="sparkle" subtitle={`${ws.parentName} will see it and can add it to your list`}>
      <form className="idea-form" onSubmit={submit}>
        <label className="field">
          <span className="sr-only">Quest idea</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Build a birdhouse with Grandpa" />
        </label>
        <div className="chip-row" role="radiogroup" aria-label="Kind of quest">
          {QUEST_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-secondary" disabled={title.trim().length < 2}>
          Suggest it
        </button>
      </form>
    </Card>
  );
}

function TeacherMessages({ kid }: { kid: Kid }) {
  const { ws, today } = useAnchor();
  const notes = notesFor(ws, kid.id).filter((n) => daysBetween(n.createdOn, today) <= 14).slice(0, 3);
  if (!notes.length) return null;
  return (
    <Card title={`From ${ws.classroom.teacherName}`} icon="school">
      <ul className="kid-notes">
        {notes.map((n) => (
          <li key={n.id}>
            <p>{n.body}</p>
            <span className="muted">{relativeDay(n.createdOn, today)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
