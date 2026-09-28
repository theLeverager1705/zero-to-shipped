import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, lastNDays, relativeDay, weekday } from '../../../shared/dates';
import { classRows } from '../../../shared/stats';
import { QUEST_CATEGORIES } from '../../../shared/types';
import type { QuestCategory } from '../../../shared/types';
import { api, errorMessage } from '../api';
import { MoodLegend, MoodStrip } from '../components/charts';
import { Icon } from '../components/Icon';
import { CATEGORY_LABELS, Card, FallbackNote, Loading, SourceTag, StatTile } from '../components/ui';
import { useAnchor } from '../state';

export function TeacherView() {
  const { ws, today, replace, notify } = useAnchor();
  const rows = useMemo(() => classRows(ws, today).sort((a, b) => a.student.name.localeCompare(b.student.name)), [ws, today]);
  const week = useMemo(() => lastNDays(today, 7), [today]);
  const sharing = rows.filter((r) => r.shares);
  const averages = sharing.flatMap((r) => (r.moodAvg === null ? [] : [r.moodAvg]));
  const classAvg = averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null;
  const checkins = sharing.reduce((sum, r) => sum + r.checkins, 0);
  const tasksDone = rows.reduce((sum, r) => sum + r.tasksDone, 0);
  const tasksTotal = rows.reduce((sum, r) => sum + r.tasksTotal, 0);

  const [pulseLoading, setPulseLoading] = useState(false);
  const requested = useRef(false);
  const generatePulse = useCallback(async () => {
    requested.current = true;
    setPulseLoading(true);
    try {
      const { workspace } = await api.classPulse(ws.id);
      replace(workspace);
    } catch (err) {
      notify(errorMessage(err), 'error');
    } finally {
      setPulseLoading(false);
    }
  }, [ws.id, replace, notify]);

  useEffect(() => {
    if (!ws.pulse && !requested.current) void generatePulse();
  }, [ws.pulse, generatePulse]);

  const pulse = ws.pulse;

  return (
    <div className="view">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Teacher console</p>
          <h1>
            {ws.classroom.name} · {ws.classroom.teacherName}
          </h1>
          <p className="page-sub">
            {rows.length} students. {sharing.length} families share check-ins with you; the rest stay private.
          </p>
        </div>
      </div>

      <div className="tiles">
        <StatTile label="Class mood" value={classAvg === null ? '–' : classAvg.toFixed(1)} unit="/ 5" hint={`Across ${sharing.length} sharing families`} />
        <StatTile label="Check-ins this week" value={checkins} hint={`Out of ${sharing.length * 7} possible`} />
        <StatTile label="Class tasks done" value={`${tasksDone}/${tasksTotal}`} hint="Tasks sent home from school" />
        <StatTile label="Quiet check-ins suggested" value={pulse ? pulse.data.checkIns.length : '–'} hint="From the class pulse" />
      </div>

      <div className="grid-dashboard">
        <div className="stack">
          <Card
            title="Class pulse"
            icon="sparkle"
            subtitle={pulse ? `Written ${relativeDay(pulse.generatedOn, today).toLowerCase()} from shared check-ins and class tasks` : 'A weekly read on how the class is doing'}
            actions={
              <>
                {pulse && <SourceTag result={pulse} />}
                <button type="button" className="btn btn-ghost btn-sm" onClick={generatePulse} disabled={pulseLoading}>
                  <Icon name="refresh" size={14} />
                  {pulseLoading ? 'Writing…' : 'Refresh'}
                </button>
              </>
            }
          >
            {!pulse && pulseLoading ? (
              <div className="brief-skeleton" role="status">
                <Loading label="Claude is reading the class’s week…" />
                <span className="skeleton-line" style={{ width: '80%' }} />
                <span className="skeleton-line" style={{ width: '65%' }} />
              </div>
            ) : pulse ? (
              <div className={pulseLoading ? 'is-refreshing' : undefined}>
                <p className="brief-headline">{pulse.data.summary}</p>
                <div className="brief-grid">
                  <div className="brief-section">
                    <h3>Highlights</h3>
                    <ul className="icon-list">
                      {pulse.data.highlights.map((h) => (
                        <li key={h}>
                          <Icon name="info" size={16} className="signal-neutral" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="brief-section">
                    <h3>Might appreciate a quiet check-in</h3>
                    {pulse.data.checkIns.length ? (
                      <ul className="icon-list">
                        {pulse.data.checkIns.map((c) => (
                          <li key={c.student}>
                            <Icon name="users" size={16} className="signal-watch" />
                            <span>
                              <strong>{c.student}</strong>: {c.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No one stands out this week.</p>
                    )}
                  </div>
                </div>
                <div className="brief-section">
                  <h3>Ideas for next week</h3>
                  <ul className="starters">
                    {pulse.data.ideas.map((idea) => (
                      <li key={idea}>{idea}</li>
                    ))}
                  </ul>
                </div>
                <FallbackNote result={pulse} />
              </div>
            ) : (
              <div className="empty">
                <button type="button" className="btn btn-primary" onClick={generatePulse}>
                  <Icon name="sparkle" size={16} /> Write the class pulse
                </button>
              </div>
            )}
          </Card>

          <Card title="Roster" icon="users" subtitle="Mood check-ins appear only for families who opt in">
            <div className="table-scroll">
              <table className="roster">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">
                      <span className="strip-head" aria-hidden="true">
                        {week.map((d) => (
                          <span key={d}>{weekday(d).charAt(0)}</span>
                        ))}
                      </span>
                      <span className="sr-only">Mood, last 7 days</span>
                    </th>
                    <th scope="col" className="num">
                      Avg
                    </th>
                    <th scope="col" className="num">
                      Low days
                    </th>
                    <th scope="col" className="num">
                      Class tasks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student.id}>
                      <th scope="row">
                        <span className="student">
                          <span aria-hidden="true">{r.student.avatar}</span> {r.student.name}
                        </span>
                      </th>
                      <td>
                        {r.shares ? (
                          <MoodStrip moods={r.moods} dates={week} />
                        ) : (
                          <span className="private">
                            <Icon name="lock" size={14} /> Family keeps check-ins private
                          </span>
                        )}
                      </td>
                      <td className="num">{r.shares && r.moodAvg !== null ? r.moodAvg.toFixed(1) : '–'}</td>
                      <td className="num">{r.shares ? r.lowDays : '–'}</td>
                      <td className="num">
                        {r.tasksDone}/{r.tasksTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MoodLegend />
          </Card>
        </div>

        <div className="stack">
          <PostNoteCard />
          <RecentNotesCard />
          <Card title="How sharing works" icon="lock">
            <ul className="icon-list">
              <li>
                <Icon name="check" size={16} className="signal-positive" />
                <span>Families choose whether you see mood check-ins, and can change it any time.</span>
              </li>
              <li>
                <Icon name="check" size={16} className="signal-positive" />
                <span>Your notes and tasks reach every family, and the student sees them too.</span>
              </li>
              <li>
                <Icon name="check" size={16} className="signal-positive" />
                <span>The class pulse only ever reads data families have shared.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PostNoteCard() {
  const { ws, today, act } = useAnchor();
  const [to, setTo] = useState<string>('class');
  const [body, setBody] = useState('');
  const [withTask, setWithTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [category, setCategory] = useState<QuestCategory>('school');
  const [dueDate, setDueDate] = useState(addDays(today, 3));
  const [sending, setSending] = useState(false);
  const students = [...ws.classroom.students].sort((a, b) => a.name.localeCompare(b.name));
  const target = to === 'class' ? null : students.find((s) => s.id === to);
  const canSend = body.trim().length >= 2 && (!withTask || taskTitle.trim().length >= 2);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    const ok = await act(
      {
        type: 'post-note',
        studentId: target?.id ?? null,
        body: body.trim(),
        quest: withTask ? { title: taskTitle.trim(), category, points: 20, dueDate: dueDate || undefined } : undefined,
      },
      `Sent to ${target ? `${target.name}’s family` : `every family in ${ws.classroom.name}`}${withTask ? ', with a quest for home' : ''}`,
    );
    setSending(false);
    if (ok) {
      setBody('');
      setTaskTitle('');
      setWithTask(false);
    }
  };

  return (
    <Card title="Send a note home" icon="send" subtitle="Notes land in the family’s Anchor. Add a task and it becomes a quest at home.">
      <form className="note-form" onSubmit={submit}>
        <label className="field">
          <span>To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="class">Whole class ({students.length} families)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}’s family
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={600}
            rows={4}
            placeholder={target ? `Something ${target.name} did well this week…` : 'A quick update for families…'}
          />
        </label>
        <label className="check-field">
          <input type="checkbox" checked={withTask} onChange={(e) => setWithTask(e.target.checked)} />
          <span>Add a task for home</span>
        </label>
        {withTask && (
          <div className="task-fields">
            <label className="field">
              <span>Task</span>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={80} placeholder="e.g. Practice your science fair pitch" />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Type</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as QuestCategory)}>
                  {QUEST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Due</span>
                <input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={!canSend || sending}>
          <Icon name="send" size={16} /> {sending ? 'Sending…' : 'Send note'}
        </button>
      </form>
    </Card>
  );
}

function RecentNotesCard() {
  const { ws, today } = useAnchor();
  const names = new Map(ws.classroom.students.map((s) => [s.id, s.name]));
  const notes = [...ws.notes].sort((a, b) => b.createdOn.localeCompare(a.createdOn)).slice(0, 5);
  return (
    <Card title="Recent notes" icon="message">
      <ul className="kid-notes">
        {notes.map((n) => (
          <li key={n.id}>
            <span className="muted">
              {n.studentId ? `To ${names.get(n.studentId) ?? 'a student'}’s family` : `To ${ws.classroom.name}`} · {relativeDay(n.createdOn, today)}
            </span>
            <p>{n.body}</p>
            {n.questTitle && (
              <span className="pill">
                <Icon name="star" size={12} /> Quest: {n.questTitle}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
