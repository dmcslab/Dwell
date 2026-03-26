# Dwell — Facilitator Guide

> This guide is for the person running a Dwell session with a team — a SOC manager, a security instructor, a team lead, or anyone facilitating a group exercise. It covers everything from choosing the right scenario to closing the debrief productively.

---

## What a facilitated session looks like

A typical team session runs 45–90 minutes and follows this arc:

```
Brief (5 min) → Play (25–50 min) → Debrief (15–30 min) → Assign follow-ups (5 min)
```

The simulation itself handles the mechanics. Your job as facilitator is the conversation: surfacing disagreements during play, making sure the debrief produces something actionable, and turning a training exercise into lasting change in how the team thinks and operates.

---

## Before the session

### 1. Choose a scenario

The right scenario depends on what your team needs to practise and their current experience level.

| Scenario | Difficulty | Best For |
|---|---|---|
| Operation: Encrypted Inbox | Easy | First session, new analysts, onboarding |
| Operation: Cracked Software | Easy | Onboarding, quick 30-minute sessions |
| Operation: Payroll Zero | Easy | Third-party SaaS impact, BCP decisions |
| Operation: Ghost Credential | Medium | Credential attack patterns, VPN security |
| Operation: Impersonation Call | Medium | Social engineering, helpdesk controls |
| Operation: Silent Exfiltration | Medium | Data exfiltration, regulatory obligations |
| Operation: Ready State | Medium | Preparation phase focus, control assessment |
| Operation: Threat Hunt | Medium | Proactive hunting, Cobalt Strike TTPs |
| Operation: Exposed Gateway | Medium | Unpatched VPN exploitation, double extortion |
| Operation: Cold Chain | Medium | IT/OT boundary, ransom payment decisions |
| Operation: RDP Breach | Hard | Lateral movement, DA escalation |
| Operation: Silent Loader | Hard | BazarLoader/Cobalt Strike, full intrusion |
| Operation: Exchange Breach | Hard | ProxyShell, web shell persistence |
| Operation: SMB Storm | Hard | Worm containment, time pressure |
| Operation: Hypervisor Lockout | Hard | ESXi/virtualisation attacks |
| Operation: Zero Privilege | Hard | Zerologon, domain compromise |
| Operation: MSP Cascade | Hard | Supply chain, multi-client impact |
| Operation: Poisoned Update | Hard | NotPetya-class wiper, supply chain |
| Operation: Dealer Blackout | Hard | SaaS provider, 15,000 downstream customers |
| Operation: Claims Denied | Hard | Healthcare, HIPAA + OFAC compliance |

**For a first session with an inexperienced team:** Start with Operation: Encrypted Inbox. It covers all four NIST phases, has 3 attempts per stage, and the consequences of wrong choices are clear without being punishing.

**For a team that has done a session before:** Move to Medium. Operation: Ghost Credential or Operation: Threat Hunt are good bridges — technically specific without the relentless time pressure of Hard scenarios.

**For experienced analysts:** Hard scenarios with 2 attempts per stage are appropriate. The SMB Storm worm scenario is particularly effective for team sessions because simultaneous containment decisions produce strong discussion.

**To test your preparation posture specifically:** Operation: Ready State is built around the Preparation phase and asks teams to evaluate their current controls against a realistic threat model.

### 2. Decide on roles

Dwell supports up to four players per session: **IR Lead**, **Network**, **Endpoint**, and **Solo**. For team exercises, use roles. They change what each player sees.

| Role | What they see | Who submits |
|---|---|---|
| **IR Lead** | Executive/strategic context — pressures, priorities, authorisation boundaries | Yes — only the IR Lead submits final decisions |
| **Network** | Traffic data, firewall logs, C2 communication patterns, lateral movement indicators | No — can suggest choices to the IR Lead |
| **Endpoint** | EDR telemetry, process trees, memory artifacts, persistence mechanisms | No — can suggest choices to the IR Lead |
| **Solo** | General analyst context — appropriate for individual play | Yes |

**Role assignment guidelines:**

- Assign IR Lead to your most senior analyst, or to whoever you most want to practise *decision authority under pressure*
- Assign Network to whoever you want practising traffic analysis and lateral movement reasoning
- Assign Endpoint to whoever you want practising malware analysis and forensic collection reasoning
- With fewer than 4 players, leave roles unassigned — they simply won't be filled

**For a 2-person session:** IR Lead + Network works well. The Network analyst provides suggestions and the IR Lead decides. Endpoint information is still visible but no one holds the dedicated role.

**For a 1-person session:** Use the Solo role. All context is visible and the player submits decisions directly.

### 3. Set up the session

Only the facilitator needs to log in with admin credentials. Players do not need accounts.

1. Log in at `http://localhost:5173` with your admin credentials
2. Go to the Scenario Library and select your chosen scenario
3. Enter your name and click **Launch Session**
4. Copy the share link from the session screen
5. Send the link to participants — they click it and choose a role (no login required)

The facilitator can also join as a **Spectator** — watching the session without participating. This is the recommended facilitator mode: you see everything the team sees, you can observe their discussion, but you are not influencing the decisions.

**Technical requirements for participants:** A modern web browser. Nothing else. No Docker, no accounts, no installation.

---

## During the session

### The facilitator's role while the simulation runs

Resist the urge to steer. The value of the exercise comes from letting the team make their own decisions and experience the consequences. If you tell them what to do, you eliminate the learning moment.

What you should do:
- **Watch the discussion.** Note where disagreement happens — those moments become your debrief material
- **Note which options each player suggests.** The voting panel shows this; disagreements between roles are valuable
- **Track which stages take the longest.** Hesitation often indicates a gap in knowledge or a genuine process ambiguity worth surfacing
- **Let wrong choices land.** When the team makes a wrong decision and the consequence appears, resist immediately explaining why it was wrong. Let them read it. The debrief is the place for explanation

### When to pause

Dwell does not have a built-in pause function, but you can pause the discussion at any point simply by calling it out verbally.

**Good moments to pause:**
- When the team is split between two options and both seem reasonable — ask each side to make their case before submitting
- After a particularly significant consequence appears — "let's talk about what just happened before we move on"
- When someone makes a confident claim about what will work that contradicts how the scenario is built — worth surfacing before the choice is submitted

**Don't pause on every stage.** Pausing too often disrupts the sense of urgency that makes the simulation effective, especially on time-pressured Hard scenarios.

### Handling the "that would never happen here" objection

Some analysts will push back on a scenario by saying their organisation is different — they have better tools, their patching is tighter, their SIEM would have caught this earlier. This is a healthy instinct and worth engaging with rather than dismissing.

The most useful response: **"Let's say you're right — which specific control would have caught it, and how do we know it's working?"** This turns the objection into a productive conversation about whether the claimed control actually exists and is functioning.

### If the team hits a branch stage

Branch stages activate when a wrong choice redirects the scenario into a crisis path — the attacker has more time, the scope is wider, or the forensic opportunity is gone. When this happens, don't skip past it.

Pause briefly and acknowledge what happened: "We made a containment decision that tipped off the operator. The scenario has branched — this is what that looks like in practice." Then continue. The branch is the point.

---

## After the session — running the debrief

The debrief is where the learning happens. A poorly run debrief wastes the session. A well-run debrief produces specific commitments that change how the team operates.

Allow at least 15 minutes. 30 is better for Hard scenarios with multiple branch points.

### Debrief structure

**Step 1: Open the debrief screen together (2 minutes)**

After the session ends, the debrief screen appears showing every decision made, whether it was correct, the consequence, and the optimal path for wrong choices. Put this on a shared screen.

Walk through it linearly. For each stage, read the decision made and the consequence before opening discussion.

**Step 2: Identify the highest-stakes wrong decision (5 minutes)**

Ask the group: *"If we could go back and change one decision, which one would have changed the outcome the most?"*

This is usually easy to identify from the branch points and the consequence text. Focus discussion on this stage first. Why did the team make that choice? What information did they not have? What assumption did they make that was wrong?

**Step 3: Map the lesson to your real environment (10–15 minutes)**

For each significant wrong decision, ask: *"In our actual environment, what would we have done? Would we have made the same mistake?"*

This is the most valuable part of the debrief and the hardest to facilitate well. The goal is to move from the scenario to a specific statement about your real posture. Some questions that help:

- "Do we have the capability to isolate a machine remotely in under 60 seconds? If not, what's our actual process?"
- "Would our SIEM have detected this? Have we ever tested that?"
- "If this had been three machines rather than one, could we have acted on all three simultaneously?"
- "Who has the authority to take a production system offline at 2am without escalation? Is that documented?"

**Step 4: Extract one to three specific actions (5 minutes)**

End the debrief with a short list of specific, owned actions. Not "we should improve our containment process" — that is not actionable. Instead:

- "Sam will check whether our RMM agent has remote NIC disable capability and confirm by Friday"
- "We will run a tabletop on simultaneous isolation at next month's team meeting"
- "I will raise the patch cycle for critical CVEs at the next security review"

Write these down. The person who owns each action is named. There is a date.

### Discussion prompts by NIST phase

**Preparation:**
- "What single control, if we had deployed it before this, would have changed the outcome?"
- "Do we currently have this control? Is it actually enabled, or just licensed?"
- "What's the blockers to deploying it, and are those blockers worth the risk we just saw?"

**Detection & Analysis:**
- "How quickly would we have detected this in our environment? Hours? Days? Weeks?"
- "What would our first move have been — and would it have preserved the forensic evidence we needed?"
- "Who has authority to declare this a major incident without waiting for sign-off?"

**Containment:**
- "Can we act on multiple confirmed infections simultaneously, or does our process require sequential approvals?"
- "If an operator is behind this attack, how do we know whether we've tipped them off before we've finished containing?"
- "What's our process for isolating a production server during business hours?"

**Eradication & Recovery:**
- "When was our last backup validation? Did we test restore, or just confirm the backup completed?"
- "If we had to reimage 10 machines this week, what would that actually look like operationally?"
- "What accounts would we rotate in this scenario? Are there accounts we would miss?"

**Post-Incident:**
- "What would our root cause analysis have concluded? Would we have identified the actual entry vector?"
- "Do we have a lessons-learned process, or does the incident ticket close when the machine is reimaged?"
- "Who gets the post-incident report? Does it go to someone who can fund the controls it recommends?"

---

## Session formats

### Standard team exercise (45–75 minutes)
*3–4 players, any Medium or Hard scenario*

The default format. All roles assigned, share link distributed, facilitator joins as spectator. The team plays the scenario, the facilitator watches and takes notes on disagreements. Debrief runs for 20–30 minutes. Produces 2–3 action items.

### Onboarding exercise (30–45 minutes)
*1–2 new analysts, Easy scenario, facilitator plays alongside*

The facilitator joins as IR Lead. The new analyst(s) take Network and Endpoint roles. This is not a test — it is guided exploration. The facilitator explains their reasoning before submitting each decision, making the internal logic of IR decisions visible to analysts who have not practised them before.

After the session, walk through the debrief together and read every technical explanation, including for choices that weren't made.

### Scenario challenge (60 minutes, competitive)
*Two teams, same scenario, separate sessions, compare scores*

Divide the team into two groups of 2–3. Both groups run the same scenario independently at the same time. At the end, compare debrief results: who made fewer wrong choices, where did each team diverge, which team would have contained the incident faster.

Works best with teams that have done at least one previous session. The competitive element is not the point — the comparison of different reasoning paths is.

### Red team review (30 minutes, Hard scenario only)
*A red teamer or threat researcher plays alongside*

If you have someone with offensive security experience, have them join as a spectator or player. After each stage, ask them: "From an attacker's perspective, what would you do next if the team had chosen the wrong option?" This adds a layer of adversary perspective that the scenario alone cannot provide.

### Leadership briefing (20 minutes, Easy scenario)
*Senior leaders as participants, facilitator runs and explains*

Run an Easy scenario with non-technical leaders as participants. Do not use roles — run it in Solo mode on a projected screen. Pause after each consequence and explain what it means in business terms: data lost, regulatory exposure, operational downtime. The goal is not IR literacy — it is helping leadership understand why investment in detection and containment capability produces measurable outcomes.

---

## Logistics and common questions

### How many people can participate?
Up to 4 active participants (one per role) plus unlimited spectators. Spectators can watch via the share link and choose "Spectate" at the role select screen.

### Do participants need accounts?
No. Only the session creator (typically the facilitator) needs an admin account. Participants join via share link with no login required.

### Can we run this remotely?
Yes. Use Cloudflare Tunnel to expose your local instance over the internet — see [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md) for setup. Once the tunnel is running, the share link works for anyone with the URL. The application auto-detects the public URL and generates correct share links automatically.

### What if a player disconnects mid-session?
The session state is preserved in Redis. The player can reconnect via the original share link and rejoin the session in the same role.

### How long does a scenario take?
Easy scenarios: 20–35 minutes of active play. Medium: 30–45 minutes. Hard: 40–60 minutes. Add 15–30 minutes for debrief. A full Hard session including debrief typically runs 75–90 minutes.

### Can we replay a scenario?
Yes — any scenario can be replayed. Starting a new session with the same scenario resets all state. The debrief report from the previous session is not retained across sessions.

### Can we stop and continue later?
Not currently. Sessions are designed to be completed in a single sitting. If you need to stop, note where the scenario was and run a new session from the beginning in the next meeting.

### What if the team keeps getting the same question wrong?
Do not advance past it. Pause, read the technical explanation together, and discuss why the correct answer is correct before submitting it. The simulation allows multiple attempts per stage — use them as teaching moments, not as failures to rush past.

---

## Building a recurring programme

A one-time session is valuable. A recurring programme is where real skill development happens.

### Monthly session cadence

| Month | Scenario | Focus |
|---|---|---|
| 1 | Operation: Encrypted Inbox | Baseline — all four NIST phases |
| 2 | Operation: Ghost Credential | Credential-based attacks, VPN exposure |
| 3 | Operation: SMB Storm | Worm containment, simultaneous action |
| 4 | Operation: Silent Loader | Long-dwell detection, active C2 |
| 5 | Operation: Ready State | Preparation audit — test your real posture |
| 6 | Repeat Month 1 | Measure improvement against baseline |

Additional scenarios for teams that complete the core six:

| Month | Scenario | Focus |
|---|---|---|
| 7 | Operation: Payroll Zero | Third-party SaaS crisis, BCP activation |
| 8 | Operation: Cold Chain | IT/OT boundaries, ransom payment advisory |
| 9 | Operation: Dealer Blackout | SaaS provider perspective, customer impact |
| 10 | Operation: Claims Denied | Healthcare compliance, HIPAA + OFAC |
| 11 | Operation: Zero Privilege | Domain compromise, Golden Ticket |
| 12 | Operation: Exposed Gateway | VPN exploitation, double extortion |

By Month 6, run the same scenario as Month 1 and compare debrief results. Changed scores and changed discussion patterns are evidence of skill development.

### Tracking progress

Keep a log of:
- Which scenarios the team has run
- The debrief actions committed to, and whether they were completed
- The stages where the team consistently gets wrong answers (these identify training gaps)
- Whether previously identified gaps improved in later sessions

The most useful metric is not the score — it is whether the action items from previous sessions were actually implemented.

### Connecting sessions to real events

When a high-profile ransomware incident appears in the news, run the scenario closest to that attack class within two weeks. The combination of real-world news coverage and simulation creates stronger retention than either alone. Use the news article as the pre-brief material: "This week, a company was hit by a Clop-class attack targeting their MFT software. We are about to simulate exactly that type of incident."

---

## Reference: What each role sees

To understand what each player's experience looks like, here is how role-specific context is structured in each scenario stage:

**IR Lead** receives the executive framing: what leadership pressure exists, what authorisations are in play, what the business risk is. The IR Lead is the only role that can submit a final decision.

**Network** receives traffic data: firewall logs, DNS queries, netflow anomalies, C2 communication indicators, lateral movement via network protocol. Network players often see the attacker's infrastructure before the endpoint team sees execution.

**Endpoint** receives host telemetry: EDR process trees, memory analysis results, persistence mechanisms found, credential theft indicators, file system artifacts. Endpoint players often understand the attacker's execution chain before the network team understands its scope.

**All players** see the core situation prompt — the same incident description. Only the context that surrounds it differs by role.

When running sessions with new participants, brief them on this before starting: their role gives them a specific analytical lens, not complete information. Sharing what they see with each other before the IR Lead decides is the point of multi-role play.
