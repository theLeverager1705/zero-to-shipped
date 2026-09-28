import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { CoachMessage } from '../../../shared/actions';
import { daysBetween, dueLabel, localToday, relativeDay } from '../../../shared/dates';
import { isInClass, kidSignals, kidStats, notesFor } from '../../../shared/stats';
import type { KidStats, Signal } from '../../../shared/stats';
import { QUEST_CATEGORIES } from '../../../shared/types';
import type { AiResult, Kid, Quest, QuestCategory, QuestIdea, WeeklyBrief } from '../../../shared/types';
import { api, errorMessage } from '../api';
import { TrendChart } from '../components/charts';
import { Icon } from '../components/Icon';
import {
  CATEGORY_LABELS,
  Card,
  CategoryPill,
  FallbackNote,
  KidTabs,
  Loading,
  SignalIcon,
  SourceTag,
  StatTile,
} from '../components/ui';
import type { DeltaTone } from '../components/ui';
import { useAnchor } from '../state';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function ParentView() {
  const { ws, today, replace, notify } = useAnchor();
  const [kidId, setKidId] = useState(ws.kids[0].id);
  const kid = ws.kids.find((k) => k.id === kidId) ?? ws.kids[0];
  const stats = useMemo(() => kidStats(ws, kid.id, today), [ws, kid.id, today]);
  const signals = useMemo(() => kidSignals(ws, kid, stats), [ws, kid, stats]);

  const [briefLoading, setBriefLoading] = useState<Record<string, boolean>>({});
  const requested = useRef(new Set<string>());
  const generateBrief = useCallback(
    async (id: string) => {
      requested.current.add(id);
      setBriefLoading((s) => ({ ...s, [id]: true }));
      try {
        const { workspace } = await api.brief(ws.id, id);
        replace(workspace);
      } catch (err) {
        notify(errorMessage(err), 'error');
      } finally {
        setBriefLoading((s) => ({ ...s, [id]: false }));
      }
    },
    [ws.id, replace, notify],
  );

  useEffect(() => {
    if (!ws.briefs[kid.id] && !requested.current.has(kid.id)) void generateBrief(kid.id);
  }, [kid.id, ws.briefs, generateBrief]);

  const brief = ws.briefs[kid.id];

  return (
    <div className="view">
      <div className="page-intro">
        <div>
          <p className="eyebrow">{ws.familyName}</p>
          <h1>
            {greeting()}, {ws.parentName}
          </h1>
          <p className="page-sub">
            {kid.name}’s week, built from check-ins, quests, screen time and notes from {ws.classroom.teacherName}.
          </p>
        </div>
        <KidTabs kids={ws.kids} value={kid.id} onChange={setKidId} label="Choose a child" />
      </div>

      <KidTiles kid={kid} stats={stats} />

      <div className="grid-dashboard">
        <div className="stack">
          <BriefCard kid={kid} brief={brief} loading={!!briefLoading[kid.id]} onGenerate={() => generateBrief(kid.id)} signals={signals} />
          <Card title="Last 14 days" icon="chart" subtitle="Hover or tab through the days for details">
            <TrendChart days={stats.days} today={today} kidName={kid.name} />
          </Card>
          <CoachCard key={kid.id} kid={kid} signals={signals} />
        </div>
        <div className="stack">
          <InboxCard kid={kid} stats={stats} />
          <SignalsCard signals={signals} used={brief?.data.signalsUsed ?? []} />
          <QuestsCard key={kid.id} kid={kid} stats={stats} />
          <AgreementCard kid={kid} />
          <TimelineCard kid={kid} />
        </div>
      </div>
    </div>
  );
}

function trend(delta: number, threshold: number, unit: string): { text: string; tone: DeltaTone; direction?: 'up' | 'down' } {
  if (Math.abs(delta) < threshold) return { text: 'About the same as last week', tone: 'flat' };
  const up = delta > 0;
  return { text: `${up ? 'Up' : 'Down'} ${unit} vs last week`, tone: up ? 'good' : 'bad', direction: up ? 'up' : 'down' };
}

function KidTiles({ kid, stats }: { kid: Kid; stats: KidStats }) {
  const moodDelta = stats.moodAvg !== null && stats.prevMoodAvg !== null ? stats.moodAvg - stats.prevMoodAvg : null;
  const questDelta = stats.questsDone - stats.prevQuestsDone;
  const over = stats.overBudgetDays;
  return (
    <div className="tiles">
      <StatTile
        label="Mood this week"
        value={stats.moodAvg === null ? '–' : stats.moodAvg.toFixed(1)}
        unit="/ 5"
        delta={moodDelta === null ? undefined : trend(moodDelta, 0.25, Math.abs(moodDelta).toFixed(1))}
      />
      <StatTile label="Quests done" value={stats.questsDone} unit="this week" delta={trend(questDelta, 2, String(Math.abs(questDelta)))} />
      <StatTile
        label="Screen time"
        value={stats.screenAvg === null ? '–' : Math.round(stats.screenAvg)}
        unit="min / day"
        delta={
          stats.screenDaysCounted
            ? { text: `${over} of ${stats.screenDaysCounted} days over budget`, tone: over >= 3 ? 'bad' : over === 0 ? 'good' : 'flat' }
            : undefined
        }
        hint={`Budget ${kid.dailyScreenMinutes} min + earned time`}
      />
      <StatTile
        label="Check-in streak"
        value={stats.streak}
        unit={stats.streak === 1 ? 'day' : 'days'}
        hint={stats.checkedInToday ? 'Checked in today' : 'Hasn’t checked in yet today'}
      />
    </div>
  );
}

function BriefCard({
  kid,
  brief,
  loading,
  onGenerate,
  signals,
}: {
  kid: Kid;
  brief?: AiResult<WeeklyBrief>;
  loading: boolean;
  onGenerate: () => void;
  signals: Signal[];
}) {
  const { ws, today, act } = useAnchor();
  const openTitles = new Set(ws.quests.filter((q) => q.kidId === kid.id && q.status !== 'done').map((q) => q.title.toLowerCase()));
  const signalTitles = new Map(signals.map((s) => [s.id, s.title]));

  return (
    <Card
      className="brief-card"
      title={`${kid.name}’s weekly brief`}
      icon="sparkle"
      subtitle={
        brief
          ? `Written ${relativeDay(brief.generatedOn, today).toLowerCase()} from ${kid.name}’s last 14 days`
          : `Claude reads ${kid.name}’s week and writes you a brief`
      }
      actions={
        <>
          {brief && <SourceTag result={brief} />}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onGenerate} disabled={loading}>
            <Icon name="refresh" size={14} />
            {loading ? 'Writing…' : 'Refresh'}
          </button>
        </>
      }
    >
      {!brief && loading ? (
        <div className="brief-skeleton" role="status">
          <Loading label={`Claude is reading ${kid.name}’s week…`} />
          <span className="skeleton-line" style={{ width: '85%' }} />
          <span className="skeleton-line" style={{ width: '70%' }} />
          <span className="skeleton-line" style={{ width: '78%' }} />
        </div>
      ) : brief ? (
        <div className={loading ? 'is-refreshing' : undefined}>
          <p className="brief-headline">{brief.data.headline}</p>
          <div className="brief-grid">
            <div className="brief-section">
              <h3>Wins</h3>
              <ul className="icon-list">
                {brief.data.wins.map((win) => (
                  <li key={win}>
                    <Icon name="check" size={16} className="signal-positive" />
                    <span>{win}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="brief-section">
              <h3>Keep an eye on</h3>
              {brief.data.watch.length ? (
                <ul className="icon-list">
                  {brief.data.watch.map((item) => (
                    <li key={item}>
                      <Icon name="alert" size={16} className="signal-watch" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing worrying this week.</p>
              )}
            </div>
          </div>

          {brief.data.pattern && (
            <div className="pattern">
              <span className="pattern-label">
                <Icon name="sparkle" size={14} /> Pattern Anchor noticed
              </span>
              <p>{brief.data.pattern}</p>
            </div>
          )}

          <div className="brief-section">
            <h3>Conversation starters</h3>
            <ul className="starters">
              {brief.data.conversationStarters.map((starter) => (
                <li key={starter}>“{starter}”</li>
              ))}
            </ul>
          </div>

          <div className="brief-section">
            <h3>Try next week</h3>
            <ul className="next-list">
              {brief.data.nextWeek.map((q) => {
                const added = openTitles.has(q.title.toLowerCase());
                return (
                  <li key={q.title} className="next-item">
                    <div>
                      <strong>{q.title}</strong> <CategoryPill category={q.category} />
                      <p className="muted">{q.why}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={added}
                      onClick={() =>
                        act(
                          { type: 'add-quest', kidId: kid.id, source: 'ai', quest: { title: q.title.slice(0, 80), category: q.category, points: 20 } },
                          `Added “${q.title}” to ${kid.name}’s quests`,
                        )
                      }
                    >
                      <Icon name={added ? 'check' : 'plus'} size={14} />
                      {added ? 'On the list' : 'Add quest'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {brief.data.signalsUsed.length > 0 && (
            <p className="based-on">
              <span className="muted">Based on:</span>
              {brief.data.signalsUsed.map((id) => (
                <span key={id} className="pill">
                  {signalTitles.get(id) ?? id}
                </span>
              ))}
            </p>
          )}
          <FallbackNote result={brief} />
        </div>
      ) : (
        <div className="empty">
          <p className="muted">No brief yet for {kid.name}.</p>
          <button type="button" className="btn btn-primary" onClick={onGenerate}>
            <Icon name="sparkle" size={16} /> Write this week’s brief
          </button>
        </div>
      )}
    </Card>
  );
}

function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const clean = (s: string) => s.replace(/\*\*/g, '');
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={blocks.length}>
        {items.map((b, i) => (
          <li key={i}>{clean(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      bullets.push(item[1]);
    } else {
      flush();
      blocks.push(<p key={blocks.length}>{clean(line)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function coachSuggestions(kid: Kid, signals: Signal[]): string[] {
  const watching = new Set(signals.filter((s) => s.tone === 'watch').map((s) => s.id));
  const ideas: string[] = [];
  if (watching.has('energy-link') || watching.has('screen-budget')) ideas.push(`How do I talk with ${kid.name} about late-night screens without a fight?`);
  if (watching.has('low-days') || watching.has('mood-trend')) ideas.push(`${kid.name} had a couple of rough days. How do I bring it up gently?`);
  if (signals.some((s) => s.id === 'teacher-note')) ideas.push('How should I follow up on the note from school?');
  if (signals.some((s) => s.id === 'screen-budget' && s.tone === 'positive')) ideas.push(`${kid.name} is doing well with screen time. How do I keep it up without nagging?`);
  ideas.push(`What’s one small thing I could try with ${kid.name} this week?`);
  return ideas.slice(0, 3);
}

function CoachCard({ kid, signals }: { kid: Kid; signals: Signal[] }) {
  const { ws, notify } = useAnchor();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<AiResult<string> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    const history = messages.slice(-14).map((m) => ({ ...m, content: m.content.slice(0, 1500) }));
    const next: CoachMessage[] = [...history, { role: 'user', content: question }];
    setMessages(next);
    setDraft('');
    setPending(true);
    try {
      const { result } = await api.coach(ws.id, kid.id, next);
      setMessages([...next, { role: 'assistant', content: result.data }]);
      setLast(result);
    } catch (err) {
      notify(errorMessage(err), 'error');
      setMessages(history);
      setDraft(question);
    } finally {
      setPending(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <Card
      title="Ask Anchor"
      icon="message"
      subtitle={`A coach that knows ${kid.name}’s week. Helpful context, not a substitute for professional advice.`}
      actions={last && <SourceTag result={last} />}
    >
      <div className="chat" ref={listRef} aria-live="polite">
        {messages.length === 0 && <p className="muted">Ask anything about supporting {kid.name}, or start with one of these:</p>}
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>
            {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
          </div>
        ))}
        {pending && (
          <div className="bubble bubble-assistant">
            <Loading label="Anchor is thinking…" />
          </div>
        )}
      </div>
      {messages.length === 0 && (
        <div className="suggestions">
          {coachSuggestions(kid, signals).map((s) => (
            <button key={s} type="button" className="chip chip-suggestion" onClick={() => void send(s)} disabled={pending}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="coach-input">
          Ask Anchor about {kid.name}
        </label>
        <input
          id="coach-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder={`Ask about ${kid.name}…`}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={pending || !draft.trim()} aria-label="Send question">
          <Icon name="send" size={16} />
        </button>
      </form>
      {last && <FallbackNote result={last} />}
      <p className="safety-note">
        Worried about your child’s safety? Reach out to their doctor or school counselor. In the US, call or text 988 for a mental-health crisis.
      </p>
    </Card>
  );
}

function InboxCard({ kid, stats }: { kid: Kid; stats: KidStats }) {
  const { ws, today, act } = useAnchor();
  const notes = notesFor(ws, kid.id).filter((n) => daysBetween(n.createdOn, today) <= 7);
  const empty = !stats.pendingRequests.length && !stats.proposedQuests.length && !notes.length;

  return (
    <Card title="Waiting on you" icon="clock" subtitle={`Requests from ${kid.name} and notes from school`}>
      {empty ? (
        <p className="muted">You’re all caught up.</p>
      ) : (
        <ul className="inbox">
          {stats.pendingRequests.map((r) => (
            <li key={r.id} className="inbox-item">
              <div>
                <strong>
                  {kid.name} asks for {r.minutes} more minutes
                </strong>
                <p>“{r.reason}”</p>
              </div>
              <div className="inbox-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => act({ type: 'decide-request', requestId: r.id, approve: true }, `Approved ${r.minutes} extra minutes for ${kid.name}`)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => act({ type: 'decide-request', requestId: r.id, approve: false }, `Told ${kid.name} “not today”`)}
                >
                  Not today
                </button>
              </div>
            </li>
          ))}
          {stats.proposedQuests.map((q) => (
            <li key={q.id} className="inbox-item">
              <div>
                <strong>{kid.name} suggested a quest</strong>
                <p>“{q.title}”</p>
              </div>
              <div className="inbox-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => act({ type: 'review-quest', questId: q.id, approve: true }, `“${q.title}” is now one of ${kid.name}’s quests`)}
                >
                  Approve
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act({ type: 'review-quest', questId: q.id, approve: false }, 'Passed on that idea')}>
                  Pass
                </button>
              </div>
            </li>
          ))}
          {notes.map((n) => (
            <li key={n.id} className="inbox-item inbox-note">
              <div>
                <strong>
                  <Icon name="school" size={14} /> {ws.classroom.teacherName}
                  {n.studentId ? '' : ` to ${ws.classroom.name}`} · {relativeDay(n.createdOn, today)}
                </strong>
                <p>{n.body}</p>
                {n.questTitle && <p className="muted">Added a quest: {n.questTitle}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SignalsCard({ signals, used }: { signals: Signal[]; used: string[] }) {
  return (
    <Card title="What Anchor noticed" icon="chart" subtitle="Computed by Anchor’s rules engine. The AI brief builds on these, so every insight traces back to data.">
      {signals.length === 0 ? (
        <p className="muted">Not enough data yet.</p>
      ) : (
        <ul className="signals">
          {signals.map((s) => (
            <li key={s.id} className="signal">
              <SignalIcon tone={s.tone} />
              <div>
                <strong>{s.title}</strong>
                <p>{s.detail}</p>
              </div>
              {used.includes(s.id) && <span className="pill pill-used">In brief</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuestsCard({ kid, stats }: { kid: Kid; stats: KidStats }) {
  const { ws, today, act, notify } = useAnchor();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<QuestCategory>('learning');
  const [goal, setGoal] = useState('');
  const [ideas, setIdeas] = useState<AiResult<QuestIdea[]> | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const openTitles = new Set(stats.openQuests.map((q) => q.title.toLowerCase()));

  const sourceLabel = (q: Quest) =>
    q.source === 'teacher'
      ? `From ${ws.classroom.teacherName}`
      : q.source === 'ai'
        ? 'Anchor idea'
        : q.source === 'kid'
          ? `${kid.name}’s idea`
          : `From ${ws.parentName}`;

  const addQuest = async (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (clean.length < 2) return;
    if (await act({ type: 'add-quest', kidId: kid.id, source: 'parent', quest: { title: clean, category, points: 15 } }, `Added “${clean}”`)) {
      setTitle('');
    }
  };

  const getIdeas = async (e: FormEvent) => {
    e.preventDefault();
    const clean = goal.trim();
    if (clean.length < 3) return;
    setLoadingIdeas(true);
    try {
      const { result } = await api.questIdeas(ws.id, kid.id, clean);
      setIdeas(result);
    } catch (err) {
      notify(errorMessage(err), 'error');
    } finally {
      setLoadingIdeas(false);
    }
  };

  return (
    <Card title="Quests" icon="star" subtitle={`Each quest ${kid.name} finishes earns ${kid.bonusMinutesPerQuest} bonus screen minutes`}>
      <ul className="quest-list">
        {stats.openQuests.map((q) => (
          <li key={q.id} className="quest-item">
            <div>
              <strong>{q.title}</strong>
              <div className="quest-meta">
                <CategoryPill category={q.category} />
                <span>{sourceLabel(q)}</span>
                {q.dueDate && <span className={q.dueDate < today ? 'overdue' : undefined}>{dueLabel(q.dueDate, today)}</span>}
              </div>
            </div>
            <span className="points">{q.points} pts</span>
          </li>
        ))}
        {stats.openQuests.length === 0 && <li className="muted">No open quests right now.</li>}
      </ul>

      <form className="inline-form" onSubmit={addQuest}>
        <label className="sr-only" htmlFor="quest-title">
          New quest for {kid.name}
        </label>
        <input id="quest-title" placeholder="Add a quest…" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <label className="sr-only" htmlFor="quest-category">
          Category
        </label>
        <select id="quest-category" value={category} onChange={(e) => setCategory(e.target.value as QuestCategory)}>
          {QUEST_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary" disabled={title.trim().length < 2}>
          <Icon name="plus" size={14} /> Add
        </button>
      </form>

      <div className="ideas">
        <p className="ideas-title">
          <Icon name="sparkle" size={14} /> Need ideas? Describe a goal
        </p>
        <form className="inline-form" onSubmit={getIdeas}>
          <label className="sr-only" htmlFor="quest-goal">
            Goal for {kid.name}
          </label>
          <input
            id="quest-goal"
            placeholder={`e.g. more reading; loves ${kid.interests[0] ?? 'games'}`}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={300}
          />
          <button type="submit" className="btn btn-secondary" disabled={loadingIdeas || goal.trim().length < 3}>
            {loadingIdeas ? 'Thinking…' : 'Get ideas'}
          </button>
        </form>
        {ideas && (
          <div className="idea-results">
            <div className="idea-head">
              <SourceTag result={ideas} />
            </div>
            <ul className="quest-list">
              {ideas.data.map((idea) => {
                const added = openTitles.has(idea.title.toLowerCase());
                return (
                  <li key={idea.title} className="quest-item">
                    <div>
                      <strong>{idea.title}</strong>
                      <div className="quest-meta">
                        <CategoryPill category={idea.category} />
                        <span>{idea.why}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={added}
                      onClick={() =>
                        act(
                          { type: 'add-quest', kidId: kid.id, source: 'ai', quest: { title: idea.title.slice(0, 80), category: idea.category, points: idea.points } },
                          `Added “${idea.title}”`,
                        )
                      }
                    >
                      <Icon name={added ? 'check' : 'plus'} size={14} />
                      {added ? 'On the list' : 'Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
            <FallbackNote result={ideas} />
          </div>
        )}
      </div>
    </Card>
  );
}

function AgreementCard({ kid }: { kid: Kid }) {
  const { ws, act } = useAnchor();
  const inClass = isInClass(ws, kid.id);
  const setBudget = (minutes: number) =>
    act({ type: 'set-budget', kidId: kid.id, dailyScreenMinutes: minutes }, `${kid.name}’s daily screen budget is now ${minutes} min`);

  return (
    <Card title="Family agreement" icon="users" subtitle={`${kid.name} sees these settings too`}>
      <div className="setting">
        <div>
          <strong>Daily screen budget</strong>
          <p className="muted">Plus {kid.bonusMinutesPerQuest} min for each quest completed</p>
        </div>
        <div className="stepper">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Lower budget by 15 minutes"
            disabled={kid.dailyScreenMinutes <= 0}
            onClick={() => setBudget(Math.max(0, kid.dailyScreenMinutes - 15))}
          >
            −
          </button>
          <span className="stepper-value">{kid.dailyScreenMinutes} min</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Raise budget by 15 minutes"
            disabled={kid.dailyScreenMinutes >= 600}
            onClick={() => setBudget(Math.min(600, kid.dailyScreenMinutes + 15))}
          >
            +
          </button>
        </div>
      </div>
      {inClass && (
        <div className="setting">
          <div>
            <strong>Share check-ins with {ws.classroom.teacherName}</strong>
            <p className="muted">Teachers only see mood check-ins if you opt in. Notes and quests from school arrive either way.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={kid.shareWithTeacher}
            aria-label={`Share ${kid.name}’s check-ins with ${ws.classroom.teacherName}`}
            className="switch"
            onClick={() =>
              act(
                { type: 'set-sharing', kidId: kid.id, shareWithTeacher: !kid.shareWithTeacher },
                kid.shareWithTeacher ? `Stopped sharing ${kid.name}’s check-ins` : `Sharing ${kid.name}’s check-ins with ${ws.classroom.teacherName}`,
              )
            }
          >
            <span className="switch-thumb" />
          </button>
        </div>
      )}
    </Card>
  );
}

function TimelineCard({ kid }: { kid: Kid }) {
  const { ws, today } = useAnchor();
  const items = ws.activity.filter((a) => !a.kidId || a.kidId === kid.id).slice(0, 8);
  return (
    <Card title="Family timeline" icon="clock">
      <ul className="timeline">
        {items.map((a) => (
          <li key={a.id}>
            <span className={`actor actor-${a.actor}`} aria-hidden="true">
              <Icon name={a.actor === 'teacher' ? 'school' : a.actor === 'kid' ? 'smile' : 'home'} size={14} />
            </span>
            <div>
              <p>{a.text}</p>
              <time dateTime={a.at}>{relativeDay(localToday(new Date(a.at)), today)}</time>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
