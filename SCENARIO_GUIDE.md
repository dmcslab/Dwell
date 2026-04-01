# Dwell — Scenario Guide

> One entry per scenario. For each: the real incident it is based on, the decision skills it exercises, the MITRE ATT&CK techniques that appear, a recommended path by experience level, the difficulty rationale, and the estimated play time.
>
> Use this guide to choose the right scenario for your team, brief analysts before a session, or debrief against real-world context afterwards.

---

## How to read each entry

**Based on** — the real-world incident that inspired the scenario. The simulation does not use real organisation names or confirmed technical details, but the attack pattern, tools, and decisions map closely to documented events.

**Decision skills** — the specific analytical capabilities the scenario tests. These are the things an analyst should be better at after playing.

**MITRE ATT&CK techniques** — the technique IDs that appear in the technical explanations. Full documentation at [attack.mitre.org](https://attack.mitre.org).

**Recommended path** — whether the scenario suits new analysts, experienced analysts, or works for both with different facilitation.

**Difficulty rationale** — why it is rated Easy, Medium, or Hard, and what specifically makes it harder than the previous tier.

**Play time** — estimated active simulation time, excluding debrief.

---

## Easy

---

### 1. Operation: Encrypted Inbox

**Difficulty:** Easy — 3 attempts per stage

**Based on:** CryptoLocker-class phishing campaigns (2013 onwards, still active). The scenario uses the canonical delivery pattern: `.docm` attachment → macro → PowerShell download cradle → RSA+AES encryption → C2-dependent key exchange → VSS deletion. Structurally similar to hundreds of documented phishing-to-ransomware incidents across financial services firms.

**The incident:** A Finance analyst opens an invoice attachment, enables macros, and calls the helpdesk 20 minutes later when files start showing `.encrypted` extensions. SIEM is silent. You are the first responder.

**Decision skills this scenario exercises:**
- First-action triage: why network isolation via RMM beats every other first move
- Volatile evidence: why powering off a machine destroys the encryption key and the case
- Order of forensic collection: RAM → network state → processes → disk
- Scope assessment: running an IOC hunt on all phishing recipients in parallel with server damage assessment
- Eradication choice: AV cleaning vs. reimaging, and why one of these always fails
- Post-incident: which root cause control breaks the entire phishing-macro delivery chain

**MITRE ATT&CK techniques:**
- T1566.001 — Spearphishing Attachment
- T1059.001 — PowerShell
- T1055 — Process Injection
- T1486 — Data Encrypted for Impact
- T1490 — Inhibit System Recovery (vssadmin)

**Recommended path:**
- *New analysts:* Start here. Every NIST phase is represented. The correct choices are defensible on first principles. The wrong choices are wrong for clear reasons.
- *Experienced analysts:* Use as a baseline in Month 1 and repeat in Month 6 to measure improvement (see Facilitator Guide).

**Difficulty rationale:** Easy because the correct first action (NIC isolation via RMM) is unambiguous once the principle of network-before-forensics is understood. Wrong options have obvious consequences. The branch stage (re-infection after premature backup restoration) teaches a real lesson without being punishing on first play.

**Estimated play time:** 25–35 minutes

---

### 2. Operation: Cracked Software

**Difficulty:** Easy — 3 attempts per stage

**Based on:** GandCrab/REvil-class malicious download campaigns (2018–2021). Trojanised software — cracked applications, fake game mods, pirated tools — delivering RaaS payloads. This delivery method remains common and represents a different mental model from phishing: the user deliberately ran a file they obtained outside corporate channels.

**The incident:** A user reports their machine is encrypting files. Investigation reveals they downloaded and ran a cracked copy of a licensed tool from a torrent site three days ago. The ransomware has been dormant since installation, activating over the weekend when no one was watching.

**Decision skills this scenario exercises:**
- Checking NoMoreRansom.org before defaulting to backup restoration — free decryptors exist for GandCrab/REvil families
- The correct order when a decryptor exists: reimaged OS first, then decryptor, never decryptor on the live infection
- AppLocker/WDAC policy: how blocking execution from user-writable directories (AppData, Downloads, Temp) eliminates this entire delivery class
- Local admin removal: why standard workstations should not be able to install software without approval
- Scope assessment for a delayed-activation payload: what else might have run between installation and activation

**MITRE ATT&CK techniques:**
- T1204.002 — User Execution: Malicious File
- T1059.001 — PowerShell
- T1036 — Masquerading (posing as legitimate software)
- T1486 — Data Encrypted for Impact
- T1490 — Inhibit System Recovery

**Recommended path:**
- *New analysts:* Solid second scenario after Encrypted Inbox. Introduces delayed activation and the NoMoreRansom check that most analysts skip.
- *Experienced analysts:* Can be run in 30 minutes as a warm-up before a Hard scenario session.

**Difficulty rationale:** Easy because the delivery vector is straightforward and the branching is limited. The novel element — checking for free decryptors before restoring from backup — is the main teaching point and is memorable.

**Estimated play time:** 20–30 minutes

---

### 3. Operation: Payroll Zero

**Difficulty:** Easy — 3 attempts per stage

**Based on:** Kronos/UKG Private Cloud ransomware attack (December 2021). A workforce management SaaS platform was hit by ransomware; many customers — including hospitals, transit authorities, and large employers — lost access to payroll, scheduling, and HR systems for weeks. This scenario places the analyst on the *customer side*, not the victim side — a perspective that is almost never represented in IR training.

**The incident:** Staff at a large healthcare system cannot log into the workforce management platform on a Monday morning. The vendor's status page is blank. Social media shows other customers reporting a global outage. HR calls: 4,200 employees need to be paid on Friday. No manual payroll process exists.

**Decision skills this scenario exercises:**
- Third-party incident triage: what the customer IR process looks like when you cannot access the victim environment
- Invoking contractual breach notification SLAs independently of the vendor's response timeline
- Data controller obligations: as the controller, you own the obligation to notify for vendor-held employee PII
- BCP activation: running manual payroll via direct ACH without the SaaS platform
- Evidence standards for breach notification: when "may have been impacted" is sufficient to start the clock
- Returning to a vendor after a major incident: what forensic attestation and right-to-audit mean in practice

**MITRE ATT&CK techniques:**
- T1486 — Data Encrypted for Impact (at vendor)
- T1199 — Trusted Relationship (SaaS dependency)
- T1078.004 — Valid Accounts: Cloud Accounts
- T1485 — Data Destruction (loss of time records)

**Recommended path:**
- *New analysts:* Excellent onboarding scenario for non-technical stakeholders (HR leads, operations managers) because the decisions are operational and legal rather than deeply technical. Also valuable for security analysts who have never considered the customer-side of a third-party incident.
- *Experienced analysts:* The data controller / HIPAA / BCP decisions are more nuanced than they appear. Run this before a Hard scenario involving regulatory exposure (Claims Denied) to establish the legal framework.

**Difficulty rationale:** Easy because there is no active attacker to outrun and no malware to analyse. The difficulty lies in organisational decisions — activating manual processes, managing contractual obligations — rather than technical forensics. The branch stage (payroll delayed until crisis point) is vivid and realistic.

**Estimated play time:** 30–40 minutes

---

## Medium

---

### 4. Operation: Ghost Credential

**Difficulty:** Medium — 3 attempts per stage

**Based on:** Colonial Pipeline (May 2021) and DarkSide/BlackMatter VPN credential attacks. A single set of credentials for a VPN account — belonging to a former contractor, never deprovisioned — was used to gain access. No phishing, no exploit. Just a valid username and password on an MFA-free VPN portal.

**The incident:** Anomalous VPN logins from unfamiliar geographies at unusual hours. By the time detection fires, the attacker has been in the environment for 19 days. Cobalt Strike is beaconing on three Finance workstations. You are conducting a threat hunt that has just found active C2.

**Decision skills this scenario exercises:**
- Detecting Cobalt Strike beacon timing patterns in netflow without endpoint access
- Simultaneous isolation of all confirmed compromised hosts vs. sequential (the core containment insight)
- Understanding why blocking one C2 domain triggers operator pivot and accelerates the timeline
- rclone.exe on workstations as a confirmed exfiltration indicator, not a suspected one
- Breach notification trigger: when does exfiltration confirmed by rclone + volume + endpoint analysis create a notification obligation
- Post-incident: why VPN without MFA is categorically insecure regardless of password strength

**MITRE ATT&CK techniques:**
- T1078 — Valid Accounts (former contractor, never deprovisioned)
- T1071.001 — Application Layer Protocol: Web Protocols (C2 over HTTPS)
- T1003.001 — OS Credential Dumping: LSASS Memory (Mimikatz)
- T1041 — Exfiltration Over C2 Channel
- T1486 — Data Encrypted for Impact
- T1657 — Financial Theft / Double Extortion

**Recommended path:**
- *New analysts:* After completing both Easy scenarios. This introduces the concept of long-dwell intrusions and active human operators — a step up from automated ransomware.
- *Experienced analysts:* Use to test simultaneous containment decision-making. In team play, the Network analyst has C2 timing data that changes the calculus for the IR Lead.

**Difficulty rationale:** Medium because the attacker's 19-day dwell means scope assessment is genuinely complex, and the correct containment action (simultaneous isolation, not sequential) requires understanding attacker tradecraft. A beginner's instinct to isolate one machine at a time produces a realistic branch consequence.

**Estimated play time:** 35–45 minutes

---

### 5. Operation: Impersonation Call

**Difficulty:** Medium — 3 attempts per stage

**Based on:** Scattered Spider / UNC3944 social engineering attacks (2022–2023), including the MGM Resorts and Caesars Entertainment incidents. The attacker calls the IT helpdesk, impersonates an employee using LinkedIn-gathered details, and requests an account reset or MFA bypass. The helpdesk obliges. The rest is credential abuse.

**The incident:** A user calls the helpdesk requesting an urgent MFA reset — they are travelling and cannot authenticate. The caller knows the employee's name, job title, manager, and recent project. The helpdesk agent is deciding whether to comply. You are the security analyst reviewing the call.

**Decision skills this scenario exercises:**
- Social engineering recognition: urgency + authority = heightened verification, not reduced
- Why LinkedIn, company websites, and professional directories cannot serve as identity verification
- Callback verification: the only reliable out-of-band channel is one the caller cannot control
- Impossible-travel detection: reset at 14:00 → foreign VPN login at 14:03 should trigger automatic lockout
- Scope assessment after a successful vishing attack: which accounts and systems are in blast radius
- Post-incident: designing a helpdesk identity verification protocol that resists social engineering

**MITRE ATT&CK techniques:**
- T1566.004 — Phishing: Spearphishing Voice (vishing)
- T1078 — Valid Accounts (compromised via helpdesk)
- T1539 — Steal Web Session Cookie
- T1621 — Multi-Factor Authentication Request Generation (MFA fatigue)
- T1485 — Data Destruction (downstream consequence)

**Recommended path:**
- *New analysts:* Strong for teams with helpdesk or customer service staff. The decisions are procedural rather than deeply technical — anyone can engage with the core question of "how do you verify identity over the phone?"
- *Experienced analysts:* Use in team play with IR Lead + Network roles. The Network analyst's context (impossible-travel data) is the early warning the IR Lead needs — testing whether the team shares information before the decision point.

**Difficulty rationale:** Medium because the initial recognition decision (is this a legitimate call?) is genuinely ambiguous, and the technical scope-assessment after a successful vishing attack involves credential blast radius analysis that goes beyond single-machine thinking.

**Estimated play time:** 30–45 minutes

---

### 6. Operation: Silent Exfiltration

**Difficulty:** Medium — 3 attempts per stage

**Based on:** Clop ransomware MoveIT / Accellion FTA campaigns (2020–2023). Clop pioneered "data theft without encryption" — compromise the file transfer platform, exfiltrate everything, threaten publication. No ransomware deployed on endpoints. No encrypted files. No ransom note until the data appears on the leak site.

**The incident:** A SIEM alert fires on unusual outbound HTTPS volume from the managed file transfer server. No endpoint alerts. No encrypted files. No user complaints. You investigate and find a web shell in an application directory. The attacker has been quietly staging data for exfiltration.

**Decision skills this scenario exercises:**
- Detecting data theft without the usual ransomware indicators (no encryption, no ransom note)
- Evidence preservation sequencing: forensic image before patching — the patch destroys the web shell
- WAF virtual patching as the first containment move while preserving evidence
- SQL database query log analysis as the definitive method for breach scope determination
- The difference between "data was accessed" and "data was exfiltrated" — why the former triggers notification without the latter
- Post-incident: why WAF rules and SQL audit logging are the two controls that close this class of attack

**MITRE ATT&CK techniques:**
- T1190 — Exploit Public-Facing Application (SQL injection)
- T1505.003 — Server Software Component: Web Shell
- T1048 — Exfiltration Over Alternative Protocol
- T1486 — Data Encrypted for Impact (withheld until extortion)
- T1657 — Financial Theft / Double Extortion

**Recommended path:**
- *New analysts:* Teaches an important counter-intuitive lesson: the absence of ransomware symptoms is not the absence of a breach. Good for teams who think IR only starts when files are encrypted.
- *Experienced analysts:* The forensic sequencing (image before patch, WAF before reboot) is detailed and specific. Excellent for teams doing application security.

**Difficulty rationale:** Medium because there are no obvious ransomware indicators to anchor initial detection, and the correct evidence preservation order (forensic image before patching) is counter-intuitive to IT staff whose instinct is to patch immediately.

**Estimated play time:** 35–45 minutes

---

### 7. Operation: Ready State

**Difficulty:** Medium — 3 attempts per stage

**Based on:** Not a specific incident — this scenario is built around the *prevention* of ransomware, not the response to it. Every stage is a Preparation phase decision. It is the only scenario in Dwell with no active attack: instead, a security team is auditing their posture against a realistic threat model.

**The incident:** The CISO has tasked you with a pre-incident controls review. A threat intelligence brief has identified your sector as a current target. You have budget for one major control improvement per quarter. Each stage presents a control gap and asks you to identify the highest-ROI fix.

**Decision skills this scenario exercises:**
- Control prioritisation: given a specific threat model, which investment prevents the most damage
- The 3-2-1-1-0 backup rule: what immutable means and why online backups on the production network do not count
- MFA deployment priority: remote access before everything else
- EDR vs. AV: why signature detection cannot stop modern ransomware loaders
- Network segmentation: why flat /16 networks amplify every lateral movement decision
- Incident response plan testing: the difference between having a plan and having a tested plan

**MITRE ATT&CK techniques:**
This scenario focuses on the *mitigations* for the techniques seen in other scenarios. The stages reference the same TTPs but ask which defensive controls would have prevented them — particularly around T1566, T1486, T1190, T1078, and T1490.

**Recommended path:**
- *New analysts:* Excellent for security awareness training with non-technical leadership. All decisions are about investment and process rather than technical forensics.
- *Experienced analysts:* Run this before the team has experienced a Hard scenario, then return to it after. The questions land differently when you know what the consequences of poor preparation look like.
- *Best use:* As a tabletop for the team's actual environment. Pause at each stage and ask: "Do we have this control? Is it actually working?"

**Difficulty rationale:** Medium because the options are genuinely close in some stages — distinguishing between "good security practice" and "highest-ROI against this specific threat" requires threat-model reasoning rather than general knowledge.

**Estimated play time:** 35–50 minutes

---

### 8. Operation: Threat Hunt

**Difficulty:** Medium — 3 attempts per stage

**Based on:** Cobalt Strike pre-ransomware intrusions documented by Mandiant, CrowdStrike, and CISA. Many ransomware deployments are preceded by weeks of Cobalt Strike C2 activity. Teams that hunt for the precursor and contain it before ransomware deploys represent the best-case outcome. This scenario simulates exactly that.

**The incident:** A SIEM alert fires on anomalous HTTPS traffic from three Finance workstations — 58-second beacon intervals to a newly registered domain. No ransomware has been deployed. No files are encrypted. The attacker is in the reconnaissance and credential harvesting phase. You have a window to stop them before they deploy.

**Decision skills this scenario exercises:**
- Cobalt Strike beacon profiling from netflow: interval, jitter, payload size against known profiles
- Why blocking a C2 domain before characterising the campaign tips off the operator
- Simultaneous isolation after full scope determination — not before
- Mimikatz artifact analysis: LSASS access Event IDs and what they imply about credential scope
- Proactive hunting: the difference between alert-driven response and hunt-driven response
- Preventing ransomware deployment entirely — the best-case IR outcome

**MITRE ATT&CK techniques:**
- T1071.001 — Application Layer Protocol: Web Protocols (CS beacon over HTTPS)
- T1003.001 — OS Credential Dumping: LSASS Memory
- T1021.001 — Remote Services: RDP (lateral movement)
- T1057 — Process Discovery
- T1486 — Data Encrypted for Impact (the threat being prevented)
- T1657 — Financial Theft / Double Extortion (the threat being prevented)

**Recommended path:**
- *New analysts:* After Ghost Credential. The threat hunting context (no active encryption) is a good bridge between detection and containment thinking.
- *Experienced analysts:* Strong for threat hunting teams specifically. The beacon profiling stage is technically specific and rewarding. Run alongside Ghost Credential in the same session as a contrast: one scenario where hunting succeeds and one where it doesn't.

**Difficulty rationale:** Medium because the correct analytical path (characterise fully before acting) runs against the instinct to block the threat immediately. The consequences of premature blocking are realistic and teach an important lesson about operator awareness.

**Estimated play time:** 30–40 minutes

---

### 9. Operation: Exposed Gateway

**Difficulty:** Medium — 3 attempts per stage

**Based on:** Travelex (January 2020). A Pulse Secure SSL VPN appliance running unpatched firmware with CVE-2019-11510 — an unauthenticated arbitrary file read vulnerability — was exploited to extract the plaintext credential store. REvil used those credentials to move laterally and deploy ransomware. The company's foreign currency exchange operations were offline for weeks.

**The incident:** SIEM logs show 847 successful VPN authentications from Tor exit nodes overnight, all using valid employee credentials. Service desk reports staff in three offices cannot access the transaction processing platform. The VPN appliance is running firmware from 18 months ago.

**Decision skills this scenario exercises:**
- Credential invalidation vs. patch vs. appliance shutdown — which closes the attack path right now
- When the full credential store is exposed, which accounts require rotation beyond the obvious ones
- LSASS dump scope: Mimikatz on a machine with DA sessions means far more than the known stolen accounts
- Simultaneous containment during active PsExec-based ransomware deployment
- The OFAC sanctions check that must happen before any ransom payment engagement
- Regulatory breach notification timing: rclone + 180GB outbound HTTPS is sufficient to trigger the clock

**MITRE ATT&CK techniques:**
- T1190 — Exploit Public-Facing Application (CVE-2019-11510)
- T1078 — Valid Accounts (stolen VPN credentials replayed)
- T1021.001 — Remote Services: RDP
- T1003.001 — OS Credential Dumping: LSASS Memory
- T1486 — Data Encrypted for Impact
- T1041 / T1537 — Exfiltration (double extortion)

**Recommended path:**
- *New analysts:* Requires understanding of credential scope and lateral movement — complete Ghost Credential first.
- *Experienced analysts:* The branch stage (missed Mimikatz scope → Golden Ticket → GPO-based mass deployment) is one of the most technically detailed in Dwell and rewards deep knowledge.

**Difficulty rationale:** Medium because the initial triage decision has a clear correct answer, but the subsequent credential scope assessment is genuinely complex. The branch stage escalates to Hard-level difficulty, making this a good bridge scenario.

**Estimated play time:** 40–55 minutes

---

### 10. Operation: Cold Chain

**Difficulty:** Medium — 3 attempts per stage

**Based on:** JBS Foods (May–June 2021). REvil ransomware disrupted beef, chicken, and pork processing operations across the US, Australia, and Canada. The attack raised novel IR questions about the IT/OT boundary: historian servers bridging corporate and plant control networks became the critical decision point.

**The incident:** At 04:30, endpoint protection is disabled simultaneously on 47 servers across three countries. Mass file rename events follow. Processing lines in three countries go offline. OT plant control systems are still nominal — but the historian server that bridges IT and OT is on the infected server list.

**Decision skills this scenario exercises:**
- The IT/OT boundary decision: when a dual-homed infected historian server must be fully isolated
- Understanding why "disconnect only the corporate NIC" is not isolation
- Scoping access blast radius vs. encryption blast radius — they are not the same
- Auditing a privileged service account as the primary forensic artifact in a Big Game Hunting attack
- Ransom payment decision advisory: the technical inputs that inform an executive recommendation
- Double extortion management: data publication threat after encryption remediation is underway

**MITRE ATT&CK techniques:**
- T1078 — Valid Accounts (credential access)
- T1562.001 — Impair Defenses: Disable/Modify Tools (AV/EDR killed pre-deployment)
- T1490 — Inhibit System Recovery (VSS deletion)
- T1486 — Data Encrypted for Impact
- T1489 — Service Stop (processing scheduling systems)
- T1021.002 — Remote Services: SMB/Windows Admin Shares

**Recommended path:**
- *New analysts:* Not recommended as a first or second scenario. The IT/OT concepts and ransom payment advisory require context from earlier scenarios.
- *Experienced analysts:* Strong for teams in manufacturing, utilities, energy, or any organisation with OT infrastructure. The IT/OT boundary decision is the most consequential in the scenario and generates excellent discussion.

**Difficulty rationale:** Medium because the decisions are structured and the consequences are clear — but the IT/OT boundary concept is unfamiliar to many analysts and requires explanation from the facilitator. The double extortion stage at the end tests a decision that has no clean answer.

**Estimated play time:** 40–55 minutes

---

## Hard

---

### 11. Operation: SMB Storm

**Difficulty:** Hard — 2 attempts per stage

**Based on:** WannaCry (May 2017). EternalBlue (CVE-2017-0144) exploitation of unpatched SMBv1 + DoublePulsar kernel backdoor + ransomware payload. Self-propagating at network speed with no user interaction. The scenario compresses the real WannaCry timeline into a 90-minute decision window before Domain Controllers are in range.

**The incident:** 14:23 on a Tuesday. SIEM fires 47 simultaneous criticals — mass file rename events on multiple hosts. The count climbs to 312 in 90 seconds. No user opened anything. DCs are uninfected but will be in under 3 minutes if TCP/445 is not blocked east-west.

**Decision skills this scenario exercises:**
- Worm recognition in the first 60 seconds: mssecsvc2.0 + .wncry + shadow copy deletion = WannaCry confirmed, not suspected
- East-west TCP/445 blocking as the primary containment action (not isolating patient zero)
- WannaCry kill-switch domain: why registering it immediately stops global propagation
- DoublePulsar remediation: why AV cannot clean a kernel-mode backdoor
- DC protection as the first asset priority — losing the DCs collapses coordinated response
- Variant identification in the first 120 seconds gates all subsequent decisions

**MITRE ATT&CK techniques:**
- T1210 — Exploitation of Remote Services (EternalBlue/MS17-010)
- T1543.003 — Create System Service (mssecsvc2.0)
- T1490 — Inhibit System Recovery
- T1486 — Data Encrypted for Impact
- T1016 — Network Configuration Discovery

**Recommended path:**
- *New analysts:* Not recommended without at least two Medium scenarios completed. The 90-second DC protection window creates realistic time pressure that overwhelms analysts who do not yet have containment instincts.
- *Experienced analysts:* The worm-specific containment decisions (firewall rules, not host isolation; kill-switch registration) differentiate this from other scenarios. Excellent for testing network-layer response capability in team play.

**Difficulty rationale:** Hard because the worm propagates faster than human process. The correct actions must be instinctive — there is no time for discussion at the DC protection decision point. Only 2 attempts per stage.

**Estimated play time:** 40–55 minutes

---

### 12. Operation: Silent Loader

**Difficulty:** Hard — 2 attempts per stage

**Based on:** Ryuk/Conti deployment chains (2019–2021). BazarLoader delivered via phishing → Cobalt Strike C2 → Mimikatz credential harvesting → lateral movement → ransomware deployment. The scenario focuses on the critical window between C2 detection and ransomware deployment — when the right actions can prevent encryption entirely.

**The incident:** A security researcher's alert: PowerShell spawning from Outlook.exe on a Finance workstation. This is a high-fidelity IOC for a macro-delivered loader. Within hours, Cobalt Strike beacons are confirmed on 4 workstations. Mimikatz is running. Ransomware deployment is estimated 60–90 minutes away.

**Decision skills this scenario exercises:**
- PowerShell spawning from email clients as an automated P1 escalation trigger
- Why partial containment (blocking one C2 domain, isolating one host) tips off an active operator
- Simultaneous isolation as a mandatory action when the attacker is watching their dashboard
- krbtgt double-rotation: why a single rotation does not invalidate existing Golden Tickets
- Full scope hunt before any isolation — the 22-day dwell means patient zero is never alone
- Backup server as first target: why attackers hit backup infrastructure before deploying ransomware

**MITRE ATT&CK techniques:**
- T1566.001 — Spearphishing Attachment (BazarLoader delivery)
- T1059.001 — PowerShell (download cradle)
- T1055 — Process Injection (Cobalt Strike reflective DLL)
- T1003.001 — OS Credential Dumping: LSASS Memory (Mimikatz)
- T1021.001 — Remote Services: RDP (lateral movement)
- T1486 — Data Encrypted for Impact (Ryuk/Conti payload)

**Recommended path:**
- *New analysts:* Not recommended without prior Hard scenario experience. The operator-awareness element (partial containment tips them off) is a nuanced concept that requires established IR fundamentals.
- *Experienced analysts:* Core Conti/Ryuk response playbook. Run alongside Ghost Credential for a two-session deep-dive into long-dwell, operator-driven attacks.

**Difficulty rationale:** Hard because the 60–90 minute ransomware deployment window creates genuine time pressure, and the simultaneously-correct actions (hunt scope fully before isolating, isolate all at once, not sequentially) are counter-intuitive under pressure.

**Estimated play time:** 45–60 minutes

---

### 13. Operation: Hypervisor Lockout

**Difficulty:** Hard — 2 attempts per stage

**Based on:** ALPHV/BlackCat ESXi encryptor campaigns (2022–2023). BlackCat deployed a purpose-built Rust-based ESXi encryptor via a single authenticated SSH session. All VMs on the hypervisor went down in under four minutes. Veeam backup servers running as VMs on the same ESXi they were backing up were encrypted alongside everything else.

**The incident:** ESXi management interface shows SSH authentication from an unfamiliar IP. Seven minutes later: all production VMs show "powered off." The hypervisor's datastore shows .ALPHV file extension on all .vmdk files. Your Veeam backup server — which ran as a VM on this ESXi — is also encrypted.

**Decision skills this scenario exercises:**
- ESXi SSH: why permanent SSH access to hypervisors is a critical attack surface
- Detecting the ALPHV ESXi encryptor pattern: single SSH session, bulk .vmdk rename in under 4 minutes
- Veeam as a VM on the same ESXi it backs up: the single point of failure that makes this Hard
- ALPHV affiliate re-entry during recovery: all entry vectors must close before rebuilding
- Deciding which VMs to recover first when all are offline — priority sequencing under complete outage
- Why restoring individual VMs from unverified ESXi snapshots can restore the encryption too

**MITRE ATT&CK techniques:**
- T1021.004 — Remote Services: SSH (ESXi management)
- T1078 — Valid Accounts (compromised ESXi credentials)
- T1486 — Data Encrypted for Impact (dedicated ESXi encryptor)
- T1490 — Inhibit System Recovery (backup VMs encrypted)
- T1059 — Command and Scripting Interpreter (encryptor execution)

**Recommended path:**
- *New analysts:* Not recommended. Requires familiarity with virtualisation concepts.
- *Experienced analysts:* Highest value for infrastructure teams, virtualisation administrators, and anyone responsible for backup architecture. The backup-as-VM-on-ESXi failure is a common real-world gap.

**Difficulty rationale:** Hard because the backup server is destroyed in the initial attack, removing the standard recovery path. Every subsequent decision is made without the safety net that other scenarios preserve.

**Estimated play time:** 45–60 minutes

---

### 14. Operation: Poisoned Update

**Difficulty:** Hard — 2 attempts per stage

**Based on:** NotPetya (June 2017). A state-sponsored wiper disguised as ransomware, distributed via a trojanised update to a Ukrainian accounting software package. Spread internally via EternalBlue + Mimikatz. MBR-overwriting, not just file-encrypting. No functional decryptor exists. No C2. The scenario is the only one in Dwell where the correct early identification decision — "this is a wiper, not ransomware" — completely changes the response.

**The incident:** 60 seconds after a software update is applied across the estate, SIEM fires on simultaneous MBR write operations on 40+ machines. The ransom note is present but there is no C2 check-in. vssadmin deletes shadows as expected — but so does ntdsutil.exe, the AD database backup tool. This is not standard ransomware behaviour.

**Decision skills this scenario exercises:**
- Wiper identification: no C2 + MBR overwrite + no functional decryptor = wiper, not ransomware
- The 60-second identification window that determines whether you spend 3 days "negotiating" or immediately move to recovery
- Dual-vector spread (EternalBlue + WMIC/Mimikatz lateral movement): why each requires different blocking
- Software update staging with change management delays: the threat intelligence window that NotPetya exploited
- Recovery from total MBR destruction: bare metal restore, not file-level recovery
- Nation-state attribution context: how the legal and regulatory response differs

**MITRE ATT&CK techniques:**
- T1195.002 — Supply Chain Compromise: Compromise Software Supply Chain
- T1210 — Exploitation of Remote Services (EternalBlue spread)
- T1003.001 — OS Credential Dumping (Mimikatz lateral movement)
- T1561.002 — Disk Wipe: Disk Structure Wipe (MBR overwrite)
- T1490 — Inhibit System Recovery
- T1486 — Data Encrypted for Impact (wiper disguised as ransomware)

**Recommended path:**
- *New analysts:* Not recommended. The wiper identification decision requires enough context about ransomware behaviour to recognise when something deviates from it.
- *Experienced analysts:* Essential for teams in sectors targeted by state-sponsored actors (energy, government, financial services, logistics). The conceptual shift from "pay for decryptor" to "there is no decryptor" is the core lesson.

**Difficulty rationale:** Hard because the correct response path (wiper → no negotiation → immediate recovery planning) is only accessible if the analyst correctly identifies what they are dealing with in the first 60 seconds. Misidentifying a wiper as ransomware wastes days.

**Estimated play time:** 40–55 minutes

---

### 15. Operation: RDP Breach

**Difficulty:** Hard — 2 attempts per stage

**Based on:** LockBit campaigns via exposed RDP (2021–2024). RDP TCP/3389 exposed to the internet remains one of the most common LockBit initial access vectors. Credential brute-force or credential stuffing → RDP session → Mimikatz → pass-the-hash DA escalation → LockBit deployment via GPO auto-spread to all domain-joined machines.

**The incident:** A security alert: mass brute-force attempts against a public-facing RDP server. Within hours, successful authentication is confirmed. By the time detection fires on domain admin logons, LockBit is already staged. A new GPO has been created that will push ransomware to all domain-joined machines on the next Group Policy refresh cycle — approximately 90 minutes.

**Decision skills this scenario exercises:**
- GPO-based ransomware: removing the malicious script from Default Domain Policy (never deleting the DDP itself)
- Pass-the-hash: how shared local admin passwords enable lateral movement across the entire estate
- LAPS: the control that eliminates shared local admin passwords at scale
- LockBit auto-spread: why this variant is different from manually-deployed ransomware
- DA credential reset scope after confirmed LSASS dump
- The 90-minute Group Policy refresh window as the containment clock

**MITRE ATT&CK techniques:**
- T1110 — Brute Force (RDP)
- T1550.002 — Use Alternate Authentication Material: Pass the Hash
- T1078 — Valid Accounts
- T1484.001 — Domain Policy Modification: Group Policy Modification
- T1486 — Data Encrypted for Impact
- T1490 — Inhibit System Recovery

**Recommended path:**
- *New analysts:* Not recommended. Pass-the-hash and GPO-based deployment require solid Active Directory fundamentals.
- *Experienced analysts:* Critical for Windows-heavy environments. The GPO removal decision (modify, not delete the Default Domain Policy) is a real-world operational detail that prevents catastrophic mistakes during the response.

**Difficulty rationale:** Hard because GPO propagation creates a hard deadline and the correct remediation (modify the GPO, not delete it) is a counter-intuitive edge case that many analysts get wrong under pressure.

**Estimated play time:** 45–60 minutes

---

### 16. Operation: Exchange Breach

**Difficulty:** Hard — 2 attempts per stage

**Based on:** Conti-class ProxyShell exploitation campaigns (2021). CVE-2021-34473/34523/31207 gave unauthenticated attackers remote code execution on Exchange servers. Exploitation left web shells. Attackers used Exchange service accounts — often over-provisioned to Domain Admin — for lateral movement and credential harvesting.

**The incident:** w3wp.exe (the Exchange application pool worker process) is spawning cmd.exe and PowerShell. This is a definitive indicator of Exchange exploitation. A web shell has been dropped into the Exchange OWA directory. The service account running Exchange is a Domain Admin.

**Decision skills this scenario exercises:**
- w3wp.exe spawning shell processes as a P1 auto-escalation indicator
- WAF virtual patching as the first containment action while preserving web shell forensic evidence
- Exchange service accounts should never be Domain Admins — the specific Exchange RBAC roles that replace DA
- rclone on server-class machines: always anomalous, always DLP/proxy alert territory
- Forensic image before vendor patch: patching destroys the web shell and the investigation
- Credential scope after Exchange DA compromise: every account that authenticated against Exchange is in scope

**MITRE ATT&CK techniques:**
- T1190 — Exploit Public-Facing Application (ProxyShell)
- T1505.003 — Server Software Component: Web Shell
- T1078 — Valid Accounts (Exchange service account as Domain Admin)
- T1003.001 — OS Credential Dumping: LSASS Memory
- T1048 — Exfiltration Over Alternative Protocol (rclone)
- T1486 — Data Encrypted for Impact

**Recommended path:**
- *New analysts:* Not recommended. Requires Exchange architecture knowledge.
- *Experienced analysts:* High value for Exchange administrators and teams managing on-premises Microsoft infrastructure. The web shell evidence preservation vs. patching tension is a frequently-made real-world error.

**Difficulty rationale:** Hard because the forensic sequencing (image before patch) runs directly against the natural instinct to patch a known CVE immediately, and the Exchange-as-DA misconfiguration is endemic but not always understood as an attack surface.

**Estimated play time:** 45–60 minutes

---

### 17. Operation: MSP Cascade

**Difficulty:** Hard — 2 attempts per stage

**Based on:** Kaseya VSA attack (July 2021). REvil exploited a zero-day in the Kaseya VSA remote monitoring and management (RMM) platform. The attacker deployed ransomware to all managed endpoints via the trusted management channel. Between 800 and 1,500 downstream businesses were affected in a single weekend attack.

**The incident:** You are the IR Lead at an MSP. A Kaseya security advisory arrives: "Shut down VSA servers immediately — active exploitation in progress." Simultaneously, SIEM shows the VSA management console executing processes on all 85 managed client endpoints. You have not yet confirmed whether this is malicious.

**Decision skills this scenario exercises:**
- Vendor emergency shutdown advisories: follow immediately, investigate later
- VSA agent task queuing: agents can execute tasks from local cache after the server shuts down
- Treating all 85 managed clients as potentially affected — not just the 12 showing active encryption
- MSP obligation: proactive client notification vs. waiting for confirmation
- Immutable backups as a service baseline: the MSP's responsibility, not just the client's
- Holiday weekend attack timing: why MSPs need on-call security coverage year-round

**MITRE ATT&CK techniques:**
- T1195.002 — Supply Chain Compromise: Compromise Software Supply Chain
- T1072 — Software Deployment Tools (VSA RMM as attack vector)
- T1490 — Inhibit System Recovery
- T1486 — Data Encrypted for Impact
- T1199 — Trusted Relationship (MSP-to-client trust)

**Recommended path:**
- *New analysts:* Not recommended. The MSP context and supply chain exploitation model require existing IR fundamentals.
- *Experienced analysts:* Essential for managed service providers and any organisation that manages security tooling for multiple clients. The cascading impact model is unique in Dwell.

**Difficulty rationale:** Hard because the blast radius extends beyond the MSP's own environment to every managed client, and the correct initial action (shut down the VSA server) must happen before investigation can even begin.

**Estimated play time:** 40–55 minutes

---

### 18. Operation: Zero Privilege

**Difficulty:** Hard — 2 attempts per stage

**Based on:** Zerologon exploitation (CVE-2020-1472, actively exploited by Conti and others in 2020–2021). The vulnerability allows an unauthenticated attacker on the internal network to reset a Domain Controller's computer account password, achieving Domain Admin in approximately 3 seconds. An unmanaged device is all that is needed.

**The incident:** 03:22. SIEM critical: "Zerologon exploitation attempt detected — DC01 — CVE-2020-1472." DC01 is unpatched. If the exploit succeeded, the attacker has been Domain Admin for 4 minutes. Conti ransomware is likely staged for deployment. You have a narrow window.

**Decision skills this scenario exercises:**
- Zerologon identification: Event ID 4742 for a DC's own computer account from an external IP is definitive
- The 4-minute containment window: why this scenario requires pre-built runbooks, not improvisation
- krbtgt double-rotation as the mandatory post-Zerologon credential reset sequence
- Unmanaged devices on internal networks as the primary threat vector — 802.1X NAC response
- DC VLAN isolation: workstations should not be able to initiate Netlogon connections to DCs directly
- Conti ransomware deployment pattern after domain compromise

**MITRE ATT&CK techniques:**
- T1210 — Exploitation of Remote Services (CVE-2020-1472)
- T1078 — Valid Accounts (Domain Admin via Zerologon)
- T1484.001 — Domain Policy Modification (Conti GPO deployment)
- T1003.001 — OS Credential Dumping
- T1486 — Data Encrypted for Impact
- T1490 — Inhibit System Recovery

**Recommended path:**
- *New analysts:* Not recommended. Requires solid Active Directory architecture knowledge and familiarity with Kerberos fundamentals.
- *Experienced analysts:* The pre-built runbook requirement is the most important lesson — this scenario is designed to demonstrate that improvising a Zerologon response is too slow. The debrief conversation about runbook documentation is as valuable as the play.

**Difficulty rationale:** Hard because the 4-minute window between exploit detection and likely ransomware deployment is genuinely tight, and the correct credential reset sequence (krbtgt twice, specific order) requires knowledge that must be recalled under pressure.

**Estimated play time:** 40–55 minutes

---

### 19. Operation: Dealer Blackout

**Difficulty:** Hard — 2 attempts per stage

**Based on:** CDK Global (June 2024). BlackSuit ransomware was deployed across CDK Global's infrastructure following a social engineering attack on the IT helpdesk. Over 15,000 automotive dealership customers lost access to their sales, financing, service, and parts systems. The outage lasted weeks. This scenario places the analyst at the SaaS provider, managing both the technical response and the downstream customer crisis simultaneously.

**The incident:** 02:17. NOC alert: mass service degradation across all data centre regions. Customer API error rates at 98%. Authentication offline. Your engineer confirms ransomware across all regions simultaneously. 15,000+ dealership customers are locked out of their businesses. You are the IR Lead.

**Decision skills this scenario exercises:**
- Isolating a partially encrypted region to halt spread vs. maintaining partial customer service
- B2B communications during a platform outage: honest early disclosure vs. silence
- Contractual 24-hour breach notification SLA — when the clock starts for a SaaS provider
- Staged forensic recovery: rebuild in isolation → verify clean state → promote to production
- Why bypassing forensic verification to restore faster leads to re-infection and longer total downtime
- Post-incident hardening announcements: specificity and root-cause alignment vs. generic security theatre

**MITRE ATT&CK techniques:**
- T1566.004 — Phishing: Spearphishing Voice (helpdesk vishing)
- T1078 — Valid Accounts (helpdesk-provisioned MFA bypass)
- T1021 — Remote Services (lateral movement)
- T1562.001 — Impair Defenses (AV/EDR disabled pre-deployment)
- T1486 — Data Encrypted for Impact
- T1657 — Financial Theft / Double Extortion

**Recommended path:**
- *New analysts:* Not recommended. The SaaS provider perspective and simultaneous technical/communications decisions require significant IR experience.
- *Experienced analysts:* Highest value for SaaS providers, cloud platform teams, and anyone who manages infrastructure that downstream customers depend on. The staged forensic recovery decision tree is the most operationally nuanced in Dwell.

**Difficulty rationale:** Hard because the analyst must manage two simultaneous crisis tracks — technical containment and B2B customer communications — with decisions in each track having consequences in the other. Only 2 attempts per stage.

**Estimated play time:** 50–70 minutes

---

### 20. Operation: Claims Denied

**Difficulty:** Hard — 2 attempts per stage

**Based on:** Change Healthcare (February 2024). ALPHV/BlackCat gained access to Change Healthcare's Citrix remote access portal — no MFA was enabled on a single account. They moved laterally for nine days, exfiltrated terabytes of data, and deployed ransomware. Healthcare payment processing across the US halted. The downstream impact — delayed prescription fills, paused insurance claim processing, cash-flow crises for hospitals — made this the most consequential healthcare ransomware incident on record.

**The incident:** SIEM alert: Citrix authentication from an unfamiliar IP for a user account with no MFA enrolled. The account is a privileged service account used for a healthcare clearinghouse application. If this is malicious, protected health information for hundreds of millions of patients may be in scope. And if ALPHV is behind this, OFAC sanctions apply to any ransom payment.

**Decision skills this scenario exercises:**
- Why a single MFA-unenrolled account on an external-facing application is a critical exposure
- HIPAA breach notification: the 60-day clock, HHS reporting obligation, patient notification at scale
- OFAC sanctions check: the legal requirement before engaging with a sanctioned ransomware group
- Healthcare payment system criticality: when ransomware causes direct patient care impact
- Parallel workstreams: clinical continuity + forensics + legal/regulatory notification running simultaneously
- The intersection of cyber incident response and public health emergency

**MITRE ATT&CK techniques:**
- T1133 — External Remote Services (Citrix without MFA)
- T1078 — Valid Accounts (credential reuse against unprotected Citrix)
- T1021 — Remote Services (lateral movement post-Citrix)
- T1048 — Exfiltration Over Alternative Protocol (rclone to cloud storage)
- T1486 — Data Encrypted for Impact (ALPHV BlackCat)
- T1657 — Financial Theft / Double Extortion

**Recommended path:**
- *New analysts:* Not recommended. This scenario integrates technical response with HIPAA compliance, OFAC law, and clinical operations continuity — requiring broad context across multiple domains.
- *Experienced analysts:* Essential for healthcare sector teams and anyone advising healthcare clients. The HIPAA + OFAC intersection is unique to this scenario and has no equivalent elsewhere in Dwell.
- *Best use:* As the capstone scenario after completing a full programme. The regulatory complexity, scale of impact, and simultaneous workstream management represent the hardest class of real-world IR decisions.

**Difficulty rationale:** Hard because the blast radius — hundreds of millions of patient records, US healthcare payment infrastructure, direct patient care impact — creates pressure that no other scenario replicates, and the regulatory decision tree (HIPAA + OFAC + state breach notification) must be managed alongside the technical response.

**Estimated play time:** 50–70 minutes

---

## Appendix: Scenario index by topic

### By attack vector
| Attack Vector | Scenarios |
|---|---|
| Phishing / macro | Encrypted Inbox |
| Malicious download | Cracked Software |
| Exposed VPN (credential theft) | Exposed Gateway, Ghost Credential |
| Exposed RDP (brute force) | RDP Breach |
| Exposed Citrix (no MFA) | Claims Denied |
| Exchange CVE exploitation | Exchange Breach |
| SQL injection / web shell | Silent Exfiltration |
| SMB worm / EternalBlue | SMB Storm, Poisoned Update |
| Helpdesk vishing | Impersonation Call, Dealer Blackout |
| RMM supply chain | MSP Cascade |
| Software update supply chain | Poisoned Update |
| Domain vulnerability (Zerologon) | Zero Privilege |
| Third-party SaaS | Payroll Zero |
| ESXi / hypervisor | Hypervisor Lockout |
| Cobalt Strike precursor | Threat Hunt, Silent Loader |
| IT/OT boundary | Cold Chain |
| Preparation-focused (no attack) | Ready State |

### By primary lesson
| If you want to practise... | Run this scenario |
|---|---|
| First-action triage and network isolation | Encrypted Inbox |
| Volatile evidence and forensic order | Encrypted Inbox, Silent Loader |
| Simultaneous containment of multiple hosts | SMB Storm, Ghost Credential, Threat Hunt |
| IT/OT boundary decisions | Cold Chain |
| Wiper vs. ransomware identification | Poisoned Update |
| GPO-based ransomware response | RDP Breach, Zero Privilege |
| Exchange / web shell forensics | Exchange Breach, Silent Exfiltration |
| Credential scope after DA compromise | Exposed Gateway, Silent Loader, Zero Privilege |
| Ransom payment decision framework | Cold Chain, Exposed Gateway |
| HIPAA / regulatory breach notification | Claims Denied, Payroll Zero |
| OFAC sanctions compliance | Claims Denied |
| Third-party / SaaS incident response | Payroll Zero, MSP Cascade, Dealer Blackout |
| Social engineering and helpdesk controls | Impersonation Call, Dealer Blackout |
| Preparation and control prioritisation | Ready State |
| Proactive threat hunting | Threat Hunt |
| ESXi / backup architecture | Hypervisor Lockout |
