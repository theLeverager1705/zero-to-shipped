import type { MouseEvent } from 'react';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'smile',
    title: 'Kids check in, in 30 seconds',
    body: 'Mood, energy and a few tags. Quests turn goals into small wins that earn screen time, so the budget feels fair instead of imposed.',
  },
  {
    icon: 'sparkle',
    title: 'Anchor connects the dots',
    body: 'A transparent signals engine links mood, energy, screen time, quests and teacher notes. Claude on Amazon Bedrock turns them into a weekly brief with wins, watch-outs and conversation starters.',
  },
  {
    icon: 'school',
    title: 'Teachers close the loop',
    body: 'A note from school becomes a quest at home. Families decide whether to share check-ins back, and teachers get a class pulse that respects that choice.',
  },
];

const PRINCIPLES: { title: string; body: string }[] = [
  { title: 'Transparency, not surveillance', body: 'Kids see the same data their parents see. No secret tracking, no message reading, no location.' },
  { title: 'Explainable AI', body: 'Every brief lists the signals it used. If Claude is unavailable, a rules engine writes the brief from the same signals.' },
  { title: 'Privacy by default', body: 'Parents set up kid profiles, and teachers only see check-ins when a family opts in. No ads, no data sales. Demo data expires after 30 days.' },
  { title: 'Knows its limits', body: 'The coach is told it is not a clinician and points families to their doctor, school counselor or 988 when signals call for it.' },
];

const PLANS: { name: string; price: string; body: string }[] = [
  { name: 'Family', price: 'Free', body: 'Check-ins, quests and screen budgets for up to three kids.' },
  { name: 'Family Plus', price: '$6 / month', body: 'AI weekly briefs, the Ask Anchor coach and quest ideas.' },
  { name: 'Schools', price: '$3 / student / year', body: 'Teacher console, class pulse, notes home and roster sync.' },
];

const STACK: { name: string; role: string }[] = [
  { name: 'Amazon CloudFront + S3', role: 'Serves the React app over HTTPS' },
  { name: 'Amazon API Gateway + AWS Lambda', role: 'Node.js 22 API on Arm (Graviton)' },
  { name: 'Amazon DynamoDB', role: 'Family workspaces with optimistic locking and TTL' },
  { name: 'Amazon Bedrock', role: 'Claude Opus 5, with Claude Sonnet 5 as fallback' },
  { name: 'AWS CDK', role: 'All infrastructure as TypeScript code' },
];

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="#/" className="brand" aria-label="Anchor home">
          <span className="brand-mark">
            <Icon name="anchor" size={18} />
          </span>
          <span className="brand-name">Anchor</span>
        </a>
        <nav className="landing-links" aria-label="Sections">
          <a href="#how" onClick={(e) => scrollTo(e, 'how')}>
            How it works
          </a>
          <a href="#trust" onClick={(e) => scrollTo(e, 'trust')}>
            Trust
          </a>
          <a href="#aws" onClick={(e) => scrollTo(e, 'aws')}>
            Built on AWS
          </a>
        </nav>
        <a className="btn btn-primary" href="#/parent">
          Open the live demo
        </a>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">The family co-pilot for Gen Alpha</p>
            <h1>One shared plan for the kid in the middle.</h1>
            <p className="lead">
              Anchor connects the three people who shape a Gen Alpha kid’s week. Kids check in and run quests, parents get an AI weekly brief grounded in
              real signals, and teachers close the loop from school. Nobody has to guess, and nobody has to spy.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary btn-lg" href="#/parent">
                Open the live demo
              </a>
              <a className="btn btn-secondary btn-lg" href="#/kid">
                Kid view
              </a>
              <a className="btn btn-secondary btn-lg" href="#/teacher">
                Teacher view
              </a>
            </div>
            <p className="microcopy">No sign-up. You get a private demo family with two weeks of realistic, fictional data.</p>
          </div>

          <figure className="hero-card" aria-label="Example weekly brief">
            <div className="hero-card-head">
              <span className="kid-tab-avatar" aria-hidden="true">
                🦊
              </span>
              <div>
                <strong>Maya’s weekly brief</strong>
                <span className="muted">Age 11 · 6th grade</span>
              </div>
              <span className="pill pill-ai">
                <Icon name="sparkle" size={12} /> Claude · Amazon Bedrock
              </span>
            </div>
            <p className="brief-headline">A harder week for Maya, and late screens look like part of the story.</p>
            <div className="pattern">
              <span className="pattern-label">
                <Icon name="sparkle" size={14} /> Pattern Anchor noticed
              </span>
              <p>Energy was low the day after 4 of 5 over-budget screen days, vs 1 of 7 other days.</p>
            </div>
            <ul className="starters">
              <li>“What was the trickiest part of lunch this week?”</li>
            </ul>
            <figcaption className="muted">Illustration from the demo family. The live demo writes a fresh one.</figcaption>
          </figure>
        </section>

        <section className="section problem">
          <h2>Gen Alpha is growing up online. The adults around them are working from fragments.</h2>
          <div className="features">
            <div className="feature">
              <h3>Screen-time apps count minutes, not meaning</h3>
              <p>They can tell you Thursday hit 140 minutes. They can’t tell you why Thursday was hard.</p>
            </div>
            <div className="feature">
              <h3>School updates are scattered</h3>
              <p>The one note that matters gets buried between newsletters and permission slips.</p>
            </div>
            <div className="feature">
              <h3>Advice comes from feeds, not your kid</h3>
              <p>Generic parenting tips arrive with zero context about the child in front of you.</p>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <h2>How Anchor works</h2>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="step">
                <span className="step-icon">
                  <Icon name={step.icon} size={20} />
                </span>
                <span className="step-number">Step {i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" id="trust">
          <h2>Built for trust</h2>
          <div className="principles">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="principle">
                <Icon name="check" size={18} className="signal-positive" />
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Where Anchor is headed</h2>
          <p className="section-lead">
            Anchor grows through classrooms: every teacher who adopts it brings a class of families, and parents upgrade for the AI features.
          </p>
          <div className="plans">
            {PLANS.map((plan) => (
              <div key={plan.name} className="plan">
                <h3>{plan.name}</h3>
                <p className="plan-price">{plan.price}</p>
                <p>{plan.body}</p>
              </div>
            ))}
          </div>
          <p className="microcopy">Planned pricing. The live demo includes every feature.</p>
        </section>

        <section className="section" id="aws">
          <h2>Built on AWS, shipped with a coding agent</h2>
          <p className="section-lead">
            Anchor was built from an empty repository with Claude Code for AWS Zero to Shipped 2026, and deployed with the AWS CDK.
          </p>
          <ul className="stack-list">
            {STACK.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
                <span>{s.role}</span>
              </li>
            ))}
          </ul>
          <div className="cta-row">
            <a className="btn btn-primary btn-lg" href="#/parent">
              Try Anchor now
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Anchor · a Zero to Shipped 2026 project</span>
        <span>All demo families, students and teachers are fictional.</span>
      </footer>
    </div>
  );
}

function scrollTo(e: MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
