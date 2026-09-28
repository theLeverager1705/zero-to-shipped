# Anchor: one shared plan for the kid in the middle

**Tags:** #commercial-potential #startups
**Live app:** LIVE_URL
**Code:** https://github.com/theLeverager1705/zero-to-shipped

Anchor is a family co-pilot for Gen Alpha. Kids check in and run quests, parents get an AI weekly brief written by Claude on Amazon Bedrock, and teachers close the loop from school, all on one shared plan.

## The problem

Gen Alpha is the first generation growing up with tablets, algorithmic feeds and AI from day one. The adults around them are working from fragments:

- **Screen-time apps count minutes, not meaning.** They can tell you Thursday hit 140 minutes. They can’t tell you why Thursday was hard.
- **School updates are scattered.** The one note that matters gets buried between newsletters and permission slips.
- **Advice comes from feeds, not from your kid.** Generic tips arrive with no context about the child in front of you.

The usual answer is a monitoring app that watches the kid. That breaks trust at exactly the age when kids start deciding how much to tell their parents.

## The reframe

Anchor started as an idea for a parent-only assistant. For Zero to Shipped I rebuilt it from an empty repository around a different question: what if the kid, the parent and the teacher shared one plan instead of three disconnected tools and a spy app?

- **Kids are participants, not subjects.** They check in, earn screen time through quests, ask for more time with a reason, and can see everything their parents see.
- **Parents get meaning, not raw data.** A weekly brief connects the dots and ends with conversation starters, not alarms.
- **Teachers close the loop.** A note from school can carry a task that becomes a quest at home. Families choose whether to share check-ins back.

## What it does

**Parent view.** Opens with Maya’s AI weekly brief: wins, things to keep an eye on, and a pattern Anchor noticed. In the demo family, _energy was low the day after 4 of 5 over-budget screen days, vs 1 of 7 other days_. The brief adds conversation starters and quests to try next week, which you can add with one click. Beside it: a 14-day mood and screen-time chart, the Ask Anchor coach, an inbox of requests and teacher notes, and the family agreement settings.

**Kid view.** A 30-second emoji check-in, quests that earn points and bonus screen minutes, a screen-time ring the kid can see, and buttons to ask for more time or suggest a quest.

**Teacher view.** A consent-aware class pulse, a roster with 7-day mood heat strips (only for families who opt in; the others show as private), and notes home that can carry a task.

Every visitor gets a private demo family with two weeks of realistic, fictional data, so judges can click through all three roles with no sign-up.

## How the AI works

1. A deterministic **signals engine** turns the week into explainable facts: mood trend, tough days, the screen-time → energy link, quest momentum, overdue work, teacher notes.
2. **Claude Opus 5 on Amazon Bedrock** reads those signals plus the 14-day log and writes the brief (or coach reply, quest ideas or class pulse). Output comes back as a tool call validated with a zod schema, and the brief lists which signals it used.
3. If a model is not enabled, times out or declines, Anchor falls back to **Claude Sonnet 5**, then to a **rules engine** that writes from the same signals. The live demo never shows an empty screen, and the UI labels which one answered.

Safety is designed in: the prompt grounds every claim in data, leads with strengths, treats family-written text as data rather than instructions, and points to a pediatrician, counselor or 988 when signals call for it. Kids never chat with the AI; it works for the adults.

## Built on AWS

- **Amazon CloudFront + S3** serve the React app over HTTPS with security headers. The bucket is private and reached through origin access control.
- **Amazon API Gateway (HTTP API) + AWS Lambda** run the API: Hono on Node.js 22, arm64, throttled.
- **Amazon DynamoDB** stores each family workspace, with optimistic locking and 30-day TTL.
- **Amazon Bedrock** runs Claude Opus 5, with Claude Sonnet 5 as the fallback.
- **AWS CDK** defines all of it in TypeScript. `npm run deploy` builds, deploys and smoke-tests the live URL.

## How the coding agent helped me ship

I used **Claude Code** connected to my AWS account and GitHub repository. Starting from an empty repo, it:

- helped me reframe Anchor for the Startups lane and chose an architecture that would pass the ship gate;
- built the API, the signals engine, the three role views and the CDK stack;
- checked current documentation for Claude in Amazon Bedrock (model IDs, IAM action, which features are supported) and designed the model fallback chain around it;
- verified its own work before shipping:
  - 18 unit and API tests;
  - a headless-Chromium walkthrough of all three roles at desktop and phone widths, with zero console errors;
  - a local invocation of the bundled Lambda with API Gateway events;
  - `cdk synth`;
  - a colorblind-safety check of the chart palette;
- deployed the stack to AWS with the CDK and ran the smoke test against the live URL.

The commit history shows the process: API and signals engine first, then the web app, then infrastructure and deployment.

### Proof of the AWS connection

PROOF_SCREENSHOTS: add these before posting:

1. Claude Code running `aws sts get-caller-identity` (account ID partly hidden).
2. The `npm run deploy` output ending in “Anchor is live at https://…”.
3. The CloudFormation console showing `AnchorStack` in `CREATE_COMPLETE`.
4. The smoke test line showing `source=claude model=anthropic.claude-opus-5`.

## Where Anchor is headed (Startups lane)

- **Business model.** Free for families (check-ins, quests, screen budgets). Family Plus at $6/month for AI briefs, the coach and quest ideas. Schools at $3 per student per year for the teacher console, class pulse and notes home.
- **Go-to-market.** Classroom first: every teacher who adopts Anchor brings a class of families, and parents upgrade for the AI features.
- **Why it can win.** Monitoring apps see only the device, and school apps see only the classroom. Anchor links home and school signals, and earns trust by being transparent with kids and consent-based with teachers.
- **Next 90 days.** Real accounts with Amazon Cognito and verifiable parental consent; screen-time sync from device platforms; a pilot with three classrooms, measuring the share of kids checking in 5+ days a week, brief usefulness ratings, and completion of teacher tasks sent home.

## Try it in two minutes

1. Open the live app and choose **Open the live demo**.
2. Read Maya’s weekly brief and hover the 14-day chart.
3. Ask the coach: “How do I talk with Maya about late-night screens without a fight?”
4. Switch to Theo and approve his request for 20 extra minutes.
5. Open the **Kid** view, check in as Maya and finish a quest.
6. Open the **Teacher** view, read the class pulse, and send Maya’s family a note with a task. It appears as a quest in the parent view.

---

_Before posting, remove this line and fill in LIVE_URL and PROOF_SCREENSHOTS. Add the two tags in Builder Center: one category (`#commercial-potential`) and one lane (`#startups`)._
