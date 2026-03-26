# Dwell — Core Concepts

> This document explains the ideas behind Dwell: what incident response actually is, how real analysts think during an attack, and how the simulation maps to the frameworks practitioners use on the job. Read this before your first session, or share it with your team.

---

## What is incident response?

When an attacker gets inside a network, they don't announce themselves. They move quietly — stealing credentials, mapping file shares, establishing persistence — for days or weeks before doing anything visible. The moment something does become visible is when the clock starts for the defending team.

**Incident response (IR)** is the structured process of detecting that something has gone wrong, understanding what happened, stopping it from getting worse, removing the attacker from the environment, and restoring normal operations. It sounds straightforward. In practice, every decision is made under time pressure, with incomplete information, and with consequences that compound quickly if you get them wrong.

The most important thing IR teaches is that *the order of decisions matters as much as the decisions themselves*. Restoring from backup before collecting forensic evidence destroys the evidence. Isolating one infected machine without isolating the others tips off an active operator who immediately uses their remaining footholds to deploy ransomware. Shutting a machine off to stop encryption permanently destroys the encryption key that was still in RAM.

Dwell puts you inside those moments.

---

## The NIST framework

The US National Institute of Standards and Technology publishes **NIST SP 800-61r2**, the Computer Security Incident Handling Guide. It is the most widely adopted IR framework in the world, referenced in government procurement, ISO 27001 audits, and SOC hiring requirements.

NIST defines four phases that every incident moves through, in order:

```
Preparation → Detection & Analysis → Containment, Eradication & Recovery → Post-Incident Activity
```

Every stage in every Dwell scenario is labelled with the NIST phase it belongs to. Here is what each phase means and why it matters.

---

## Phase 1 — Preparation

**In real life:** Preparation is everything you do *before* an incident occurs. Firewall rules, patch cycles, endpoint detection tools, backup schedules, documented runbooks, trained staff, defined escalation paths. If your preparation is poor, every subsequent phase becomes harder.

Preparation is not just a one-time project. It is ongoing — every new vulnerability, every business change (new cloud service, acquired company, remote workforce), every post-incident lesson learned should feed back into preparation.

**In Dwell:** Preparation stages present you with a control gap or a resource decision that occurred before the incident began. You are asked what the organisation *should have done*. These stages teach which controls have the highest return against specific attack classes. Getting a Preparation decision wrong in Dwell doesn't end the scenario — but it sets the conditions for what comes next.

**The question Preparation asks:** *Given what you know about this threat, what is the single most impactful control you could have deployed?*

**Common mistakes:**
- Choosing awareness training when a technical control would have blocked the attack entirely
- Treating cyber insurance as a security control (it is financial risk transfer, not a prevention mechanism)
- Purchasing a new product when configuration changes to existing tools would have been sufficient

---

## Phase 2 — Detection & Analysis

**In real life:** Most incidents are detected late — the industry average dwell time (the gap between attacker entry and detection) is measured in days, not hours. Detection comes from SIEM alerts, endpoint telemetry, threat intelligence feeds, user reports, or active threat hunting.

Once something is flagged, *analysis* determines what you are actually dealing with before you act. This is the phase where analysts make the most consequential early mistakes, because the pressure to *do something* creates urgency that competes with the need to *understand something first*.

The two core activities in Detection & Analysis are:

1. **Triage** — confirm the alert is real, classify the severity, and understand the immediate scope
2. **Forensic collection** — gather evidence in the correct order before it disappears (RAM first, then network state, then disk)

The order of forensic collection follows the *order of volatility*: evidence that disappears fastest gets captured first. RAM is lost on reboot. Network connections vanish when you isolate. Disk artifacts can be captured later.

**In Dwell:** Detection stages present you with a live alert and ask for your first move. The correct answers prioritise understanding before acting, and capture before destroying. Wrong answers frequently involve acting on the most visible symptom without understanding the underlying cause — leading to missed persistence mechanisms, lost evidence, or tipped-off operators who accelerate their timeline.

**The question Detection & Analysis asks:** *What do you need to know before you act, and what evidence do you need to capture before it disappears?*

**Common mistakes:**
- Powering off an infected machine (destroys RAM, which contains encryption keys and injected code)
- Running AV scans expecting to find fileless malware (modern implants live in memory, not on disk)
- Isolating patient zero without checking whether the threat has already spread
- Prioritising executive notification over parallel technical action

---

## Phase 3 — Containment, Eradication & Recovery

NIST's third phase covers three distinct activities that practitioners often treat as one because they happen in rapid sequence.

### Containment

**In real life:** Containment stops the bleeding. The goal is to prevent the attacker from doing more damage while you complete your analysis. Containment actions include network isolation, account suspension, firewall rule changes, and disabling compromised services.

Containment has two modes:
- **Short-term containment** — immediate actions taken while the incident is active (isolating a machine via RMM, blocking a C2 domain at the proxy)
- **Long-term containment** — interim measures that can stay in place while eradication is prepared (removing a compromised account from privileged groups, placing an affected system in a quarantine VLAN)

The critical containment insight is **simultaneity**. If three machines are beaconing to a C2 server and you isolate them one at a time, the attacker sees the first machine go offline and immediately accelerates activity on the remaining two. Simultaneous isolation is mandatory when an active human operator is behind the attack.

**In Dwell:** Containment stages test whether you act on all confirmed compromises at once, whether you understand which hosts are truly in scope, and whether you know which actions tip off an active operator. Wrong choices here escalate the scenario — you may branch into a crisis stage where the attack has spread further.

**The question Containment asks:** *How do you stop this from getting worse without giving the attacker warning to pivot?*

### Eradication

**In real life:** Eradication removes the threat entirely — the malware, its persistence mechanisms, and any backdoors the attacker installed. This is where many organisations fail: they clean the obvious infection without hunting for persistence.

Ransomware operators routinely install secondary persistence mechanisms (scheduled tasks, WMI event subscriptions, registry run keys) before deploying their payload, specifically so they can return after an incomplete remediation. An organisation that restores from backup without identifying the persistence mechanism will be re-infected on the restored machine's first boot.

The gold standard for eradication is **reimaging**: wiping and reinstalling the operating system from a known-good image. Antivirus cleaning of a ransomware-infected machine is not eradication — it removes the files it can detect but leaves persistence mechanisms intact.

**In Dwell:** Eradication stages present you with the choice between quick cleaning and proper remediation. They also test whether you rotate credentials for every account that was accessed during the attacker's dwell period — not just the obviously compromised ones.

**The question Eradication asks:** *Are you certain the attacker has no path back in?*

### Recovery

**In real life:** Recovery restores systems to normal operation in a verified, clean state. The key word is *verified* — systems must be confirmed clean before being reconnected to the network, or you risk reintroducing the threat. Recovery also involves validating the integrity of restored data, monitoring restored systems closely in the days following reconnection, and confirming that normal operations have resumed.

**In Dwell:** Recovery stages test whether you restore from the right backup (one taken before the initial compromise, not one that includes the persistence mechanism), whether you verify integrity before reconnecting, and whether you reset all credentials that were exposed during the incident.

**The question Recovery asks:** *How do you know you are clean?*

---

## Phase 4 — Post-Incident Activity

**In real life:** The post-incident phase is the most neglected and the most valuable. It is where lessons get turned into controls that prevent the next incident. It involves:

- **Root cause analysis** — what fundamental gap allowed this to happen?
- **Lessons learned meeting** — bringing all responders together to document what worked, what didn't, and what would have changed the outcome
- **Control improvements** — translating lessons into specific technical or process changes with owners and deadlines
- **Indicator sharing** — contributing IOCs to threat intelligence communities so other organisations benefit from your incident
- **Documentation** — writing a formal incident report for leadership, auditors, and regulators

The NIST 72-hour notification requirement under GDPR and similar breach notification laws also applies here — regulators expect timely notification after a confirmed breach, not after the post-incident review is complete.

**In Dwell:** Post-incident stages present you with a choice of improvement actions and ask which addresses the root cause most effectively. The right answers are the ones that break the attack chain at its earliest point — preventing the next incident rather than improving response to it.

**The question Post-Incident asks:** *What would have prevented this, and who will implement it by when?*

---

## MITRE ATT&CK

Every scenario in Dwell references real attacker techniques drawn from the **MITRE ATT&CK framework** — a publicly maintained knowledge base of the tactics, techniques, and procedures (TTPs) observed in real-world attacks.

ATT&CK organises attacker behaviour into 14 tactics (the *why*) and hundreds of techniques (the *how*). You will see references like `T1566.001 — Spearphishing Attachment` or `T1490 — Inhibit System Recovery` in the technical explanations after each decision. These are real identifiers you can look up at [attack.mitre.org](https://attack.mitre.org) to read primary source documentation on the technique, how defenders detect it, and how they mitigate it.

Understanding ATT&CK helps you recognise that attacker behaviour is not random — ransomware groups follow recognisable playbooks. Macro-delivered payloads always use similar execution chains. Credential-harvesting tools leave predictable memory artifacts. If you know the technique, you know what evidence to look for and what the next stage of the attack is likely to be.

---

## How Dwell maps to all of this

Every Dwell scenario is built around a real attack class — WannaCry-style SMB worms, BazarLoader-delivered ransomware, ESXi hypervisor attacks, supply chain compromises. The scenarios are not fictional — they are simulations of documented attack patterns from CISA advisories, Mandiant reports, and the MITRE ATT&CK knowledge base.

Each scenario follows the same structure:

| Component | What it is |
|---|---|
| **Preparation stage** | A control decision that could have prevented or limited the attack |
| **Detection & Analysis stages** | Triage, forensic collection, scope assessment |
| **Containment stage** | Simultaneous isolation, account suspension, network controls |
| **Eradication & Recovery stage** | Reimaging, credential rotation, backup restoration |
| **Post-Incident stage** | Root cause analysis, control improvements |
| **Branch stages** | Crisis stages that activate when an earlier decision made things worse |
| **Lessons learned** | The specific technical controls this attack demonstrated the need for |

The branching is what makes Dwell different from a quiz. If you take a wrong containment action — isolate only one of three infected machines, or run AV on a fileless implant expecting it to detect anything — the scenario doesn't just deduct points. The *story changes*. You are now dealing with an active operator who knows you found them, or a re-infected machine because you missed the persistence mechanism. Those consequences are not punishments — they are what actually happens in real incidents when those decisions are made.

---

## A note on difficulty

Dwell scenarios are rated Easy, Medium, or Hard. The rating reflects two things:

1. **How much time pressure you are under** — Hard scenarios have faster-moving threats and fewer attempts
2. **How technically specific the correct answers are** — Easy scenarios have clearly wrong options; Hard scenarios require understanding subtle tradeoffs

**Recommended path:**
- Start with **Operation: Encrypted Inbox** (Easy) — it covers all four NIST phases in a straightforward phishing incident
- Then **Operation: Cracked Software** (Easy) — a single-workstation infection with a clean resolution path
- Then **Operation: RDP Breach** or **Operation: Ghost Credential** (Medium) — introduces credential-based attacks and lateral movement
- Hard scenarios are appropriate once you are comfortable with the correct decision logic in Medium scenarios

---

## How to get the most from a session

**Solo play:** Read every technical explanation after each decision, including for the choices you did not make. The explanations are where the learning happens — they are not just feedback on your answer, they explain *why* the wrong options fail in the real world.

**Team play:** Assign roles before starting. The IR Lead, Network, and Endpoint roles receive different contextual information — the Network analyst sees traffic data that the IR Lead does not, and vice versa. Discuss options before the IR Lead submits. After the scenario, run through the debrief together and identify which stage caused the most disagreement.

**Facilitators:** See the [Facilitator Guide](FACILITATOR_GUIDE.md) for session structure, discussion prompts, and follow-up exercises.

---

## Further reading

These are the primary sources behind the scenarios and technical explanations in Dwell:

- [NIST SP 800-61r2 — Computer Security Incident Handling Guide](https://www.nist.gov/publications/computer-security-incident-handling-guide)
- [MITRE ATT&CK Framework](https://attack.mitre.org)
- [CISA Ransomware Guide](https://www.cisa.gov/stopransomware/ransomware-guide)
- [CISA StopRansomware Advisories](https://www.cisa.gov/stopransomware) — the primary source for real-world attacker TTPs
- [Mandiant M-Trends Reports](https://www.mandiant.com/resources/m-trends-reports) — annual dwell time data and attacker behaviour trends
