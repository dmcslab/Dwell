#!/usr/bin/env python3
"""
scripts/seed_scenarios.py — v3 Complete IR Simulation Scenarios
----------------------------------------------------------------
All 15 scenarios are analyst simulations following NIST SP 800-61r2.
NO company names, years, or ransom amounts referenced.
Each scenario is grounded in real ransomware TTPs from CISA/MITRE research.

Run: docker exec -it cyberrans_backend python scripts/seed_scenarios.py
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.config import settings
from app.models.models import Base, Scenario

SCENARIOS = []

# 1 — CryptoLocker-class
SCENARIOS.append({
    "name": "Operation: Encrypted Inbox",
    "description": "A phishing .docm attachment drops RSA+AES ransomware. Navigate all four IR phases from first user call through post-incident hardening.",
    "initial_prompt": "You are a Tier-2 SOC analyst. 09:14 — helpdesk: 'User in Finance says her Word/Excel files show .encrypted extension and a note YOUR_FILES_ARE_ENCRYPTED.txt appeared on her desktop. She opened an email attachment 20 minutes ago.' SIEM shows no alerts. Where do you start?",
    "difficulty_level": "easy",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "CryptoLocker-class (phishing-delivered, RSA+AES, C2-dependent key exchange)",
        "irPhase": "Detection & Analysis",
        "attackVector": "Spearphishing .docm → macro → cmd.exe → PowerShell download cradle → DLL injection into explorer.exe → file encryption → VSS deletion",
        "keyTTPs": ["T1566.001 — Spearphishing Attachment", "T1059.001 — PowerShell", "T1055 — Process Injection", "T1486 — Data Encrypted for Impact", "T1490 — Inhibit System Recovery"],
        "simulationContext": "Mid-sized financial firm ~400 employees. Flat /16 network. Signature AV only, no EDR. Email gateway passes .docm macros. Workstation WS-FIN-04 is on, network-connected. SIEM not yet alerted.",
        "decisionTree": [
            {
                "stageId": "s1_triage",
                "irPhase": "Detection & Analysis",
                "prompt": "User confirms she opened 'Overdue Invoice' email and enabled macros ~20 minutes ago. Ransom note shows a .onion URL. Machine is powered on and network-connected. What is your FIRST action?",
                "analystContext": "Available: Splunk SIEM, RMM agent (can disable NIC remotely), email gateway logs, helpdesk ticketing. Windows 10 22H2.",
                "options": [
                    {"actionText": "Remotely disable the NIC via the RMM agent to isolate the workstation from the network immediately", "isCorrect": True, "consequence": "Network isolated in seconds. C2 beacon cannot retrieve the RSA key. Ransomware cannot traverse mapped SMB shares. Forensic state preserved with machine still powered on.", "nextStageId": "s2_artifacts", "technicalExplanation": "CryptoLocker-class must contact C2 to receive the session RSA key. Isolating before that exchange may interrupt encryption. Critically it stops propagation to mapped SMB drives. NIST SP 800-61r2: isolate first. Keep machine on — volatile RAM holds key material, C2 connections, and process list."},
                    {"actionText": "Ask the user to power off the machine immediately to stop encryption", "isCorrect": False, "consequence": "Shutdown destroys volatile RAM — encryption key, process list, and C2 socket are lost permanently. Memory forensics is now impossible.", "nextStageId": "s2_artifacts", "technicalExplanation": "RAM acquisition (Magnet RAM Capture / Volatility) can recover the encryption key still in memory, reveal injected shellcode, and map the full attack chain. NIST 800-61r2 explicitly warns against unnecessary shutdowns. Correct posture: isolate network, preserve power, then image RAM."},
                    {"actionText": "Check the SIEM for other infected hosts first to understand full scope before acting on WS-FIN-04", "isCorrect": False, "consequence": "Eight minutes of SIEM work pass. Ransomware traverses the mapped Finance share via SMB and encrypts 1,200 additional files on FILESERVER01.", "nextStageId": "s2_artifacts", "technicalExplanation": "Scope assessment and containment must run in parallel — never sequentially. Assign a second analyst to the SIEM while you isolate the confirmed infected host. CryptoLocker-class malware uses file-system enumeration (T1083) to find mapped drives and encrypts them within minutes."}
                ,
                    {"actionText": 'Forward the email to IT helpdesk for review before doing anything', "isCorrect": False, "consequence": 'Macro executes while the ticket is in the helpdesk queue. Beacon established within 4 hours.', "nextStageId": 's2_artifacts', "technicalExplanation": 'Routing confirmed malicious emails through helpdesk processes adds hours of delay. Immediate isolation by the IR team is required — the macro payload begins executing as soon as the attachment is opened.'}]
            },
            {
                "stageId": "s2_artifacts",
                "irPhase": "Detection & Analysis",
                "prompt": "Workstation isolated. RMM shows: 'svchost32.exe' in C:\\Users\\Finance\\AppData\\Roaming\\ (not System32), vssadmin deleted shadows 18 minutes ago, PowerShell ran base64-encoded command 22 minutes ago. What do you collect first?",
                "analystContext": "Magnet RAM Capture available via RMM file-push. Switch SPAN port available for capture. Email gateway shows sender domain registered 3 days ago.",
                "options": [
                    {"actionText": "Push Magnet RAM Capture via RMM, acquire RAM image, then collect process list, prefetch files, AppData executables, and event logs — before any reboot", "isCorrect": True, "consequence": "RAM image captured. Volatility recovers the decoded PowerShell cradle, C2 IP in a socket handle, and injected shellcode in explorer.exe. Full IOC set extracted.", "nextStageId": "s3_scope", "technicalExplanation": "Order of volatility: RAM → network state → running processes → open files → disk. svchost32.exe in AppData = T1036.005 (masquerading). vssadmin deletion = T1490. Base64 PowerShell = T1027. All ephemeral — lost on reboot. Image RAM before anything else."},
                    {"actionText": "Kill svchost32.exe immediately to stop ongoing encryption before collecting anything", "isCorrect": False, "consequence": "Encryption completed before you arrived. Killing the process destroys the encryption key in memory. Recovery without paying ransom becomes impossible.", "nextStageId": "s3_scope", "technicalExplanation": "By Tier-2 escalation, encryption is typically complete. The running process is the decryptor UI or C2 beacon — not the active encryptor. Killing it destroys the session key. Always: RAM first, kill process second."}
                ,
                    {"actionText": "Restore the machine from yesterday's backup and return it to the user", "isCorrect": False, "consequence": 'Backup restoration without forensics destroys the IOC trail. Unknown whether lateral movement already occurred.', "nextStageId": 's3_scope', "technicalExplanation": 'Restoring before forensic collection eliminates the ability to identify C2 infrastructure, lateral movement, and persistence mechanisms. Always collect artifacts (memory, disk image, network logs) before any remediation.'},
                    {"actionText": 'Run a full AV scan on the affected machine and quarantine any detections', "isCorrect": False, "consequence": 'AV detects 0 files — the payload uses fileless techniques. Machine remains compromised with a false sense of security.', "nextStageId": 's3_scope', "technicalExplanation": 'Modern ransomware loaders use LOLBins (living-off-the-land binaries) and reflective injection to avoid leaving files on disk. Traditional AV scanning of files will not detect fileless execution chains.'}]
            },
            {
                "stageId": "s3_scope",
                "irPhase": "Containment",
                "prompt": "IOCs from RAM: C2 IP 185.220.101.47 (Tor exit). FILESERVER01 shows 847 files with .encrypted in \\Finance\\ share. Three other workstations accessed FILESERVER01 in the last 30 minutes. Same phishing template sent to 12 Finance/Accounting users. How do you scope the blast radius?",
                "analystContext": "SIEM query available. File modification timestamps on FILESERVER01 queryable remotely. RMM can push IOC-hunting scripts (check svchost32.exe in AppData) to all endpoints.",
                "options": [
                    {"actionText": "Run IOC hunt (svchost32.exe in AppData) on all 12 email recipients via RMM simultaneously AND query FILESERVER01 for .encrypted files modified in the last 2 hours", "isCorrect": True, "consequence": "IOC hunt finds 2 additional infected workstations. FILESERVER01 damage confirmed to Finance share only. All 3 infected workstations isolated simultaneously.", "nextStageId": "s4_eradication", "technicalExplanation": "Scope determination needs two concurrent tracks: (1) file-system IOCs on shared storage to measure data impact, (2) process/execution IOCs on all phishing recipients to find other infected endpoints. Run in parallel — not sequentially."},
                    {"actionText": "Take FILESERVER01 offline immediately to prevent further encryption of shared files", "isCorrect": False, "consequence": "200 active user sessions disconnected. Scope assessment impossible. Two other infected workstations continue operating undetected.", "nextStageId": "s4_eradication", "technicalExplanation": "First determine whether ransomware is executing on the server itself or writing encrypted files across SMB from workstations — they require different responses. Taking the server offline before scope assessment destroys your ability to measure damage."}
                ,
                    {"actionText": 'Scan only the immediately affected subnet for the same email indicators', "isCorrect": False, "consequence": 'Threat actor pivoted across subnets via domain admin credentials harvested from the first machine. Scope was 3x wider.', "nextStageId": 's4_eradication', "technicalExplanation": 'Scoping by subnet is a legacy approach that predates modern credential-based lateral movement. Threat actors use harvested domain credentials to traverse any subnet the DC has access to. Scope by credential access, not network topology.'},
                    {"actionText": "Check only workstations — servers wouldn't be targeted by a phishing email", "isCorrect": False, "consequence": 'Threat actor had already pivoted to a file server via RDP using domain credentials. Server was missed in the scope.', "nextStageId": 's4_eradication', "technicalExplanation": 'Post-phishing lateral movement always targets high-value assets including file servers, backup servers, and domain controllers — not just workstations. A scoping assumption that limits review to workstations will miss the most impactful compromises.'}]
            },
            {
                "stageId": "s4_eradication",
                "irPhase": "Containment, Eradication & Recovery",
                "prompt": "Scope confirmed: 3 workstations infected, 847 encrypted files on FILESERVER01 Finance share. VSS snapshots on FILESERVER01 intact (nightly 02:00 — 7-hour RPO gap). IT asks: can we run AV and clean the machines rather than reimage?",
                "analystContext": "Golden image backups exist for all 3 workstations (2 weeks old, clean). FILESERVER01 VSS snapshot from last night intact. C2 IP blocked at perimeter.",
                "options": [
                    {"actionText": "Reimage all 3 workstations from the golden image. Restore FILESERVER01 Finance share from last night's VSS snapshot. Reset AD credentials for all 3 affected accounts. Verify restoration integrity before reconnecting.", "isCorrect": True, "consequence": "All 3 workstations clean and restored. Finance share recovered with 7-hour data gap. AD credentials rotated. No ransom paid.", "nextStageId": "s5_post_incident", "technicalExplanation": "Reimaging is always preferred: (1) AV cannot detect all persistence mechanisms (WMI subscriptions, scheduled tasks, registry run keys). (2) Rootkit-style implants survive cleaning. (3) A golden image is a known-good state. Credential reset mandatory — Mimikatz (T1003.001) may have run on infected machines."},
                    {"actionText": "Run full AV scan and malware removal tool, reconnect if no threats found", "isCorrect": False, "consequence": "AV clears the ransomware binary but misses a WMI event subscription planted for persistence. Six weeks later the attacker uses the backdoor to deploy a second ransomware payload.", "nextStageId": "s5_post_incident", "technicalExplanation": "Signature AV removal does not address persistence mechanisms. CryptoLocker-class operators commonly establish WMI subscriptions, scheduled tasks, or registry run keys as secondary backdoors before deploying ransomware. The only guaranteed clean state is a verified OS reimage."}
                ,
                    {"actionText": "Change the affected user's password and remove admin rights as the sole remediation", "isCorrect": False, "consequence": 'Credential rotation without reimaging leaves the persistence mechanism (scheduled task + registry run key) active. Malware survives the password reset.', "nextStageId": 's5_post_incident', "technicalExplanation": 'Credential-only remediation assumes the only persistence is credential-based. Ransomware loaders typically establish multiple persistence mechanisms (scheduled tasks, WMI subscriptions, registry run keys) that survive credential rotation.'},
                    {"actionText": 'Disconnect the machine from the network and let the user continue on a loaner', "isCorrect": False, "consequence": 'Compromised machine remains on the network via WiFi. Beacon continues on alternate interface.', "nextStageId": 's5_post_incident', "technicalExplanation": 'Network disconnection must be complete — wired AND wireless. Loaner provisioning without full isolation of the original machine leaves the threat actor with an active C2 channel on the WiFi interface.'}]
            },
            {
                "stageId": "s5_post_incident",
                "irPhase": "Post-Incident Activity",
                "prompt": "Recovery complete without paying ransom. CISO requests top 3 control improvements. Root causes: .docm macros not blocked by email gateway, macros enabled by Office default, no EDR to detect process masquerading. What do you recommend?",
                "analystContext": "Current state: signature AV only, Office macro policy not enforced via GPO, email gateway strips .exe/.js but passes .docm, backup RPO is 24 hours with no immutable copy.",
                "options": [
                    {"actionText": "1) Deploy EDR with behavioral detection (T1036.005, T1059.001, T1490). 2) Enforce Office macro GPO: block macros from internet-sourced files. 3) Reduce backup RPO to 4 hours with immutable WORM off-site copies.", "isCorrect": True, "consequence": "Three controls address the three root causes. Future CryptoLocker-class phishing attacks are blocked at macro execution or detected by EDR before encryption starts.", "nextStageId": None, "technicalExplanation": "EDR targets the specific TTPs from this attack. GPO macro block: Computer Configuration → Admin Templates → Microsoft Office → Block macros from running in Office files from the Internet. Immutable backups: 3-2-1-1-0 rule (3 copies, 2 media, 1 offsite, 1 immutable, 0 errors verified by test restore). These address root causes, not symptoms."},
                    {"actionText": "Send mandatory security awareness training to all employees about phishing and macro risks", "isCorrect": False, "consequence": "Training delivered. Six weeks later a different user clicks a similar phishing email and enables macros. Phishing simulation click rates remain above 8%.", "nextStageId": None, "technicalExplanation": "Security awareness training is necessary but insufficient as the primary control. Click rates rarely drop below 5-10% even with frequent training. Technical controls (macro GPO, EDR, immutable backups) are non-bypassable by individual user decisions."}
                ,
                    {"actionText": 'Send a company-wide phishing awareness email immediately after the incident', "isCorrect": False, "consequence": 'Generic awareness email sent without updating email gateway rules. Same lure arrives the following week and compromises another user.', "nextStageId": None, "technicalExplanation": 'Awareness training is a long-term control — it does not prevent the next attack in the short term. Immediate technical controls (updated email gateway rules, enhanced attachment sandboxing, DMARC enforcement) must precede awareness campaigns.'},
                    {"actionText": 'Close the incident ticket once the affected machine is reimaged', "isCorrect": False, "consequence": 'Root cause analysis never performed. Same phishing campaign compromises a second user 3 weeks later via identical lure.', "nextStageId": None, "technicalExplanation": 'NIST SP 800-61r2 requires post-incident activity including root cause analysis, lessons-learned documentation, and indicator sharing. Closing the ticket at remediation skips the controls that prevent recurrence.'}]
            }
        ],
        "lessonsLearned": [
            "Network isolation via RMM must be the FIRST action — before SIEM review, before calling the user back",
            "Keep the machine powered on — volatile RAM contains the encryption key, C2 connection, and injected code",
            "Order of forensic collection: RAM → network state → processes → prefetch → disk artifacts",
            "VSS snapshots on file servers may survive ransomware that ran only on workstations writing across SMB",
            "Scope determination runs two parallel tracks: file-system IOCs on shared storage AND process IOC hunt on all phishing recipients",
            "Always reimage ransomware-infected endpoints — AV cleaning leaves persistence mechanisms",
            "GPO-enforced macro blocking eliminates the entire phishing-macro delivery class in one policy change"
        ],
        "referenceLinks": ["https://www.cisa.gov/stopransomware/ransomware-guide", "https://attack.mitre.org/techniques/T1566/001/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 2 — WannaCry-class
SCENARIOS.append({
    "name": "Operation: SMB Storm",
    "description": "A self-propagating SMB worm exploits an unpatched Windows vulnerability, spreading autonomously across the network without any user interaction. Contain it before it reaches the Domain Controllers.",
    "initial_prompt": "14:23 Tuesday — SIEM fires 47 simultaneous criticals: 'Mass file rename events on multiple hosts.' Count climbs to 312 in 90 seconds. No user opened anything — infections appear on idle machines. This is a worm. DCs are uninfected but will be in under 3 minutes.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "WannaCry-class (EternalBlue/MS17-010 SMBv1 worm, DoublePulsar ring-0 backdoor, ransomware payload)",
        "irPhase": "Detection & Analysis → Emergency Containment",
        "attackVector": "Autonomous SMBv1 worm exploiting CVE-2017-0144 (EternalBlue). Installs DoublePulsar kernel backdoor, drops ransomware. Scans LAN and random WAN IPs on TCP/445. No user interaction. Initial infection via unpatched VPN-connected laptop.",
        "keyTTPs": ["T1210 — Exploitation of Remote Services (EternalBlue)", "T1543.003 — Create System Service (mssecsvc2.0)", "T1490 — Inhibit System Recovery", "T1486 — Data Encrypted for Impact", "T1016 — Network Configuration Discovery"],
        "simulationContext": "Manufacturing company, 800 workstations. Flat /16 network, no micro-segmentation. Windows patching 4 months behind due to change freeze. SMBv1 enabled everywhere. DCs DC01 and DC02 are unpatched.",
        "decisionTree": [
            {
                "stageId": "s1_emergency",
                "irPhase": "Emergency Containment",
                "prompt": "312 machines show: service 'mssecsvc2.0' created, files renamed .wncry, vssadmin deleting shadows, massive TCP/445 scanning. Broadcast storms on the switch. DCs will be infected in under 3 minutes. What is your single most urgent action?",
                "analystContext": "Available: firewall console (ACLs in ~30 seconds), managed switch console (VLAN changes), AD admin (GPO takes 90+ minutes + reboot), RMM (too slow to scale to 312 machines).",
                "options": [
                    {"actionText": "Block inbound TCP/445 to DC01 and DC02 at the internal firewall, then isolate infected floor segments via VLAN changes on managed switches", "isCorrect": True, "consequence": "DCs protected within 45 seconds. Worm continues on flat network but cannot reach DCs. Active Directory stays operational for coordinated response.", "nextStageId": "s2_killswitch", "technicalExplanation": "EternalBlue spreads to all hosts reachable on TCP/445. DCs are the highest-value target — encrypting them destroys Kerberos authentication, making remote response impossible. Firewall ACLs operate in seconds vs. GPO (90+ minutes + reboot). VLAN isolation simultaneously slows propagation across the flat network."},
                    {"actionText": "Push a GPO via Active Directory to disable SMBv1 on all machines", "isCorrect": False, "consequence": "GPO requires domain connectivity and machine reboot — minimum 90 minutes. DC01 is encrypted 2 minutes later. Domain authentication collapses. Remote response becomes impossible.", "nextStageId": "s2_killswitch", "technicalExplanation": "GPO is the correct long-term fix but is completely ineffective for active worm containment. Computer Configuration settings require a machine restart and 90-minute default refresh interval. Only network-layer controls operate fast enough during active worm events."},
                    {"actionText": "Begin manually shutting down machines floor-by-floor starting with the most infected floor", "isCorrect": False, "consequence": "Physical shutdown of 300 machines takes 25+ minutes. DC01 is infected within 3 minutes. You also destroy volatile forensic evidence on every machine you shut down.", "nextStageId": "s2_killswitch", "technicalExplanation": "Manual physical action is the slowest containment method for a network worm. EternalBlue's automated TCP/445 scanning operates at network speed — far faster than physical response. This approach also destroys RAM evidence on every shutdown."}
                ,
                    {"actionText": 'Shut down all 312 infected machines via the RMM tool to stop the spread', "isCorrect": False, "consequence": 'RMM agent push to 312 machines takes 8+ minutes. DCs infected within 3 minutes. Catastrophic delay during which the worm reaches every DC.', "nextStageId": 's2_killswitch', "technicalExplanation": 'RMM tools require agent communication and sequential queuing — at scale they cannot outpace a worm exploiting an OS-level kernel vulnerability. Network-layer controls (firewall ACLs, VLAN segmentation) are the only sub-60-second containment levers available.'}]
            },
            {
                "stageId": "s2_killswitch",
                "irPhase": "Containment",
                "prompt": "DCs isolated. Worm still propagating. TI confirms WannaCry-variant with a known kill-switch: if a hardcoded domain resolves via DNS, the malware halts. Your proxy blocks that domain. DNS admin can create an internal A record pointing it to 127.0.0.1 (sinkhole). Should you activate it?",
                "analystContext": "Kill-switch domain confirmed by TI feed. Internal DNS can resolve it to loopback in 60 seconds. Internet access to domain is blocked by proxy. New infections occurring every 30 seconds per SIEM.",
                "options": [
                    {"actionText": "Create the internal DNS A record resolving the kill-switch domain to 127.0.0.1 — stops new payload executions on any machine that can still reach DNS", "isCorrect": True, "consequence": "New infections cease within 2 minutes. Already-infected machines are not recovered but no new machines encrypt.", "nextStageId": "s3_doublepulsar", "technicalExplanation": "WannaCry-class performs HTTP GET to a hardcoded domain before executing. If the domain resolves (to any IP), it halts — interpreting it as a sandbox environment. Internal DNS sinkhole triggers this kill switch without changing outbound firewall policy. Containment, not remediation — already encrypted machines still need recovery."},
                    {"actionText": "Open internet access to the kill-switch domain so machines can reach it directly", "isCorrect": False, "consequence": "Opening outbound rules also allows the worm's TCP/445 scanning toward random external WAN IPs — potentially exploiting external machines. Creates legal liability.", "nextStageId": "s3_doublepulsar", "failBranchStageId": "s_dc_breach", "technicalExplanation": "The worm actively scans random external IPs on TCP/445 in addition to LAN scanning. Relaxing outbound firewall rules during an active worm incident risks successful exploitation of external targets. The internal DNS sinkhole achieves the kill-switch effect without any outbound firewall change."}
                ,
                    {"actionText": 'Wait for vendor confirmation before activating the kill-switch — it may be a honeypot', "isCorrect": False, "consequence": 'New infections at 30-second intervals while you wait. 400+ machines fully encrypted before vendor responds in 45 minutes.', "nextStageId": 's3_doublepulsar', "technicalExplanation": 'The WannaCry kill-switch domain was publicly confirmed by Marcus Hutchins within hours of the outbreak. In an active incident with confirmed TI, waiting for vendor confirmation while machines are actively encrypting is not an acceptable risk posture.'},
                    {"actionText": 'Sinkhole the kill-switch domain at the upstream ISP level', "isCorrect": False, "consequence": 'ISP-level DNS changes propagate over minutes to hours. Internal DNS sinkhole would have worked in 60 seconds.', "nextStageId": 's3_doublepulsar', "technicalExplanation": 'External DNS changes involve ISP ticket workflows and propagation delays. The correct action is an internal DNS A record resolving the domain to 127.0.0.1, achievable in under 60 seconds via the DNS admin console.'}]
            },
            {
                "stageId": "s3_doublepulsar",
                "irPhase": "Eradication & Recovery",
                "prompt": "Kill switch activated. No new infections. Final count: 347 workstations encrypted, 8 servers encrypted, DCs intact. Forensics confirms DoublePulsar kernel-mode backdoor on at least 14 machines. Unknown on the other 333. IT asks: can we just patch MS17-010 and reconnect?",
                "analystContext": "DoublePulsar confirmed via memory forensics on 14 hosts. Unknown on 333 others. Offline backups available (48h old). Workstation data mostly on file servers. Reimaging 347 = 4 days IT effort.",
                "options": [
                    {"actionText": "Reimage all 347 workstations from the hardened golden image. Patching MS17-010 without reimaging leaves DoublePulsar in place — you cannot clean a ring-0 backdoor with AV.", "isCorrect": True, "consequence": "All machines confirmed clean. 4 days IT effort but zero risk of persistent kernel backdoor. Servers restored from backup. MS17-010 patched before reconnect.", "nextStageId": None, "technicalExplanation": "DoublePulsar is a ring-0 (kernel-mode) backdoor — it operates below the OS level, persists through reboots, and is not reliably detected or removed by AV. Patching MS17-010 prevents future exploitation but does NOT remove DoublePulsar already installed. Every machine EternalBlue reached must be assumed to have DoublePulsar until forensically cleared — reimage all 347."},
                    {"actionText": "Apply MS17-010 patch, run a DoublePulsar scan, and reimage only the 14 confirmed cases", "isCorrect": False, "consequence": "Three months later an attacker reconnects via DoublePulsar on one of the 333 'unconfirmed' machines and deploys a different ransomware payload.", "nextStageId": None, "technicalExplanation": "DoublePulsar detection tools scan for known signatures that can be modified by the attacker to evade detection. Given EternalBlue successfully exploited 347 machines, assume DoublePulsar is present on all 347. The risk of leaving one active kernel backdoor far outweighs the additional reimaging effort."}
                ,
                    {"actionText": 'Run a DoublePulsar detection scanner and reimage only confirmed-positive machines', "isCorrect": False, "consequence": 'Scanner misses DoublePulsar on 23 machines that evade the signature. Six months later a threat actor reactivates persistent access on those hosts.', "nextStageId": None, "technicalExplanation": 'DoublePulsar detection scanners check for known signatures which can be modified. Given EternalBlue confirmed on 347 machines, the forensic burden is reversed — assume all 347 are compromised. Selective reimaging based on scanner results creates unacceptable residual risk.'},
                    {"actionText": 'Patch MS17-010 via WSUS and mark all patched machines as remediated', "isCorrect": False, "consequence": 'Patching closes the EternalBlue entry point but DoublePulsar already in kernel memory on 333 machines persists through the patch and survives reboot.', "nextStageId": None, "technicalExplanation": 'MS17-010 patches the vulnerability used by EternalBlue — it does not remove DoublePulsar already installed in kernel space. Patching without reimaging leaves a ring-0 backdoor on every machine EternalBlue successfully exploited.'}],
                },
                {
                    "stageId": "s_dc_breach",
                    "irPhase": "Containment",
                    "prompt": "CRITICAL: Ransomware reached the Domain Controller. The DCs are now encrypting shares across the network. Active Directory database at risk. You have minutes before org-wide lockout. What is your IMMEDIATE priority?",
                    "analystContext": "DC encryption in progress. LSASS memory at risk. AD replication spreading malware. 3 other DCs show IOC activity. Backup DCs offline per last known state.",
                    "networkContext": "East-west traffic spiking on 445/TCP between all DC pairs. DNS resolution failing intermittently.",
                    "endpointContext": "EDR shows vssadmin.exe and wbadmin.exe running on DC01 — shadow copies being deleted.",
                    "irLeadContext": "Legal notified. CISO on bridge. Exec team expecting updates every 15 min. Consider declaring major incident.",
                    "options": [
                        {
                            "actionText": "Pull DCs off-line immediately — accept AD outage to stop spread",
                            "isCorrect": True,
                            "consequence": "AD outage causes disruption but halts ransomware propagation. AD can be restored from offline backup within 4 hours.",
                            "nextStageId": "s3_doublepulsar",
                            "technicalExplanation": "Isolating DCs severs the replication channel ransomware uses to spread. AD restoration from clean backup is the recovery path. Each minute online increases encrypted share count exponentially."
                        },
                        {
                            "actionText": "Keep DCs online and attempt live remediation while monitoring",
                            "isCorrect": False,
                            "consequence": "Ransomware completes encryption of the AD database. Full domain rebuild required — 72-hour recovery minimum.",
                            "nextStageId": None,
                            "technicalExplanation": "Live remediation on an actively compromising DC is not viable. The time window to stop DC encryption is 2-3 minutes. Monitoring while ransomware runs is catastrophic.",
                            "failBranchStageId": None
                        }
                    ,
                    {"actionText": 'Run an emergency anti-ransomware tool on the DCs while keeping them online to preserve AD', "isCorrect": False, "consequence": 'AV cannot stop active kernel-level encryption running with SYSTEM privileges. DC AD database fully encrypted. Full domain rebuild required — 72-hour recovery minimum.', "nextStageId": None, "technicalExplanation": 'Ransomware with SYSTEM privileges operates above most security tool capabilities. At DC encryption speeds, AV scanning cannot outpace active file encryption. The window to act is 2-3 minutes — isolation is the only viable response.'},
                    {"actionText": 'Take a VM snapshot of the DCs for forensics before taking any containment action', "isCorrect": False, "consequence": 'Snapshot takes 4 minutes on a loaded DC. AD database fully encrypted during snapshot process. Evidence preserved, but domain is gone.', "nextStageId": None, "technicalExplanation": 'NIST SP 800-61r2: containment takes priority over evidence preservation when active destruction is underway. Snapshots can be taken after isolation. Every second the DC stays online during active ransomware execution increases the encrypted data volume exponentially.'}]
                }
        ],
        "lessonsLearned": [
            "Worm scenarios require network-layer containment (firewall/VLAN) in seconds — manual or GPO actions are too slow",
            "Domain Controllers are the first asset to protect — losing them collapses coordinated response",
            "DNS sinkholes for known malware kill-switch domains are a fast, safe containment tool requiring no firewall changes",
            "DoublePulsar is a kernel-mode backdoor that cannot be cleaned with AV — all EternalBlue-affected machines must be reimaged",
            "Flat /16 networks are force multipliers for worms — micro-segmentation is the architectural fix",
            "SMBv1 has no legitimate use in modern Windows environments — disable globally via GPO"
        ],
        "referenceLinks": ["https://www.cisa.gov/news-events/alerts/2017/05/12/indicators-associated-wannacry-ransomware", "https://attack.mitre.org/techniques/T1210/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 3 — Ryuk/Conti-class
SCENARIOS.append({
    "name": "Operation: Silent Loader",
    "description": "A phishing link dropped BazarLoader three days ago. Cobalt Strike has been beaconing for 72 hours, Mimikatz harvested Domain Admin credentials, and manual ransomware deployment is imminent. You must hunt and contain before deployment.",
    "initial_prompt": "A Tier-1 low-severity alert from 3 days ago was closed: 'Suspicious PowerShell from Outlook.exe on WS-HR-07.' Today a second alert fires: 'Non-system process opened handle to lsass.exe on WS-HR-07.' Correlation reveals: the user opened a Google Drive link in an email 3 days ago. This machine has been beaconing to Cobalt Strike C2 for 72 hours.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "Ryuk/Conti-class (BazarLoader → Cobalt Strike C2 → Mimikatz credential harvesting → manual ransomware deployment planned via PsExec)",
        "irPhase": "Detection & Analysis (pre-ransomware — loader active 72h, ransomware not yet deployed)",
        "attackVector": "Spearphishing link → Google Drive lure → BazarLoader DLL → injected into explorer.exe → Cobalt Strike HTTPS beacon → Mimikatz LSASS dump → Domain Admin compromise → manual PsExec-based Ryuk deployment planned",
        "keyTTPs": ["T1566.002 — Spearphishing Link", "T1059.001 — PowerShell (BazarLoader)", "T1055 — Process Injection", "T1003.001 — LSASS Credential Dumping", "T1021.001 — RDP lateral movement", "T1569.002 — PsExec (planned deployment)"],
        "simulationContext": "Healthcare org, 1,200 endpoints. EDR deployed but Tier-1 alert fatigue closed the initial PowerShell alert. Cobalt Strike beaconing HTTPS every ~60 seconds to Cloudflare-fronted C2 for 72 hours. Threat actor harvested credentials from 4 machines including one Domain Admin account. Ransomware NOT yet deployed.",
        "decisionTree": [
            {
                "stageId": "s1_hunt_or_contain",
                "irPhase": "Detection & Analysis",
                "prompt": "WS-HR-07 beaconing Cobalt Strike C2 for 72 hours. The threat actor is human — they watch their dashboard and will notice if a host goes offline. Do you isolate WS-HR-07 immediately, or hunt for full scope first?",
                "analystContext": "EDR can query all 1,200 endpoints for the same beacon pattern (process injection + consistent HTTPS every ~60s). Lateral hunt: 30-45 minutes. Domain Admin account 'svc_backup' used from WS-HR-07 in last 24 hours. Ransomware deployment takes ~10-15 minutes once the operator decides to execute.",
                "options": [
                    {"actionText": "Run a rapid lateral hunt via EDR for the same Cobalt Strike beacon pattern across all endpoints before isolating anything — understand full scope first", "isCorrect": True, "consequence": "30-minute hunt finds 4 additional compromised hosts including a backup server with Domain Admin credentials cached. Full blast radius known. Simultaneous isolation of all 5 hosts planned.", "nextStageId": "s2_credential_response", "technicalExplanation": "HATR (Human-Operated Ransomware) operators monitor C2 dashboards in real time. Isolating a single host: (1) tips off the attacker who immediately accelerates deployment from remaining beacons, (2) misses the full blast radius. DFIR Report case studies show ransomware deployed within hours of partial containment detection. Simultaneous isolation after a rapid hunt is the correct sequence."},
                    {"actionText": "Isolate WS-HR-07 immediately — active LSASS credential dump means every minute risks more credential exposure", "isCorrect": False, "consequence": "WS-HR-07 isolated. Attacker sees beacon go offline and within 20 minutes deploys Ryuk from their 4 other active beacons. Mass encryption begins on the healthcare network.", "nextStageId": "s2_credential_response", "technicalExplanation": "HATR operators explicitly watch for IR activity as a deployment trigger. Ryuk/Conti playbooks instruct operators to 'deploy immediately' if a compromised host is isolated. Correct: simultaneous containment of all identified hosts after a rapid hunt — never sequential, never partial."}
                ,
                    {"actionText": 'Isolate WS-HR-07 and file a ticket for IT to reimage it next business day', "isCorrect": False, "consequence": 'Threat actor detects isolation, accelerates timeline, deploys ransomware to all 14 already-compromised hosts within 2 hours.', "nextStageId": 's2_credential_response', "technicalExplanation": 'Filing a ticket for next-business-day remediation while an active Cobalt Strike operator is in the environment is operationally equivalent to no response. An active human operator will accelerate their timeline the moment they detect any containment action.'},
                    {"actionText": 'Block the Cobalt Strike C2 domain at the firewall and monitor for further beaconing', "isCorrect": False, "consequence": 'Operator switches to a backup C2 domain within 8 minutes. Cobalt Strike profile rotates. Lateral movement continues.', "nextStageId": 's2_credential_response', "technicalExplanation": "Cobalt Strike profiles support multiple redirectors and backup C2 profiles. Blocking a single domain does not break the operator's access — they pivot to pre-configured backup infrastructure immediately."}]
            },
            {
                "stageId": "s2_credential_response",
                "irPhase": "Containment",
                "prompt": "Lateral hunt complete. 5 compromised hosts total. 'svc_backup' Domain Admin was Mimikatz-dumped. Attacker has DA credentials. Before simultaneous isolation of all 5 hosts, what must you do with Active Directory?",
                "analystContext": "svc_backup is a DA account with no expiry used by a backup script on 40 servers. Resetting it will break nightly backups temporarily. Account authenticated via RDP to 8 servers in last 24 hours. krbtgt not rotated in 2 years.",
                "options": [
                    {"actionText": "Disable ALL Domain Admin accounts except a new break-glass account, rotate krbtgt password TWICE with 10-minute interval (invalidates all Kerberos tickets), then simultaneously isolate all 5 compromised hosts", "isCorrect": True, "consequence": "All attacker Kerberos tickets invalidated. Existing RDP sessions drop. Simultaneous isolation of all 5 hosts completes. No ransomware deployed. Backup script breaks temporarily — acceptable.", "nextStageId": None, "technicalExplanation": "DA compromise enables multiple persistence paths: new DA accounts, golden tickets (T1558.001), DCSync (T1003.006). Rotating a single compromised account is whack-a-mole. Correct sequence: (1) Create break-glass DA unknown to attacker. (2) Disable ALL existing DA accounts. (3) Double-rotate krbtgt with 10-minute interval — first reset invalidates tickets issued after the reset; second reset invalidates tickets between the two resets, eliminating all pre-existing golden tickets. (4) THEN simultaneously isolate all 5 hosts."},
                    {"actionText": "Reset only the svc_backup password to cut off the specific compromised credential, then isolate all 5 hosts", "isCorrect": False, "consequence": "You reset svc_backup. The attacker created shadow DA account 'svc_helpdesk2' 8 hours ago using svc_backup access. They retain DA and deploy Ryuk immediately after credential rotation.", "nextStageId": None, "technicalExplanation": "Single account rotation after 72+ hours of DA access is insufficient. The attacker has had time to create shadow accounts, generate golden tickets, and establish multiple persistence vectors. Full DA disable + krbtgt double rotation is the only approach that holistically invalidates attacker access."}
                ,
                    {"actionText": 'Reset only the credentials that appeared in the Mimikatz output from WS-HR-07', "isCorrect": False, "consequence": 'Operator had already dumped credentials from 3 additional hosts. 6 privileged accounts not reset remain active. Domain compromise proceeds.', "nextStageId": None, "technicalExplanation": "In a 72-hour Cobalt Strike operation, assume credential harvesting happened on every host the operator touched — not just the initially identified machine. Scoping resets to a single machine's dump is systematically incomplete."},
                    {"actionText": 'Force a Kerberos ticket expiration across the domain and reissue via KRBTGT rotation', "isCorrect": False, "consequence": 'KRBTGT rotation forces re-authentication across the domain. Correct action but cannot be done in isolation — operator still has NTLM hashes valid for pass-the-hash without Kerberos.', "nextStageId": None, "technicalExplanation": 'KRBTGT rotation invalidates Kerberos tickets but does not address NTLM hashes already harvested. A full credential response requires rotating all privileged account passwords AND KRBTGT (twice, 10 hours apart) AND ensuring NTLM is restricted where possible.'}]
            }
        ],
        "lessonsLearned": [
            "PowerShell spawning from email clients (Outlook.exe) is a high-fidelity critical IOC — automate escalation via SOAR, never classify as low",
            "HATR operators watch C2 dashboards — partial containment tips them off and accelerates ransomware deployment",
            "Hunt for full scope first, then simultaneously contain all compromised hosts — never sequential, never partial",
            "DA credential theft requires krbtgt double-rotation — single account reset leaves golden tickets and shadow accounts intact",
            "Average HATR dwell time is preventable with automated behavioral correlation: email client → PowerShell → consistent HTTPS beaconing = P1"
        ],
        "referenceLinks": ["https://www.cisa.gov/news-events/cybersecurity-advisories/aa20-302a", "https://attack.mitre.org/software/S0446/", "https://thedfirreport.com/"]
    }
})

# 4 — DarkSide-class
SCENARIOS.append({
    "name": "Operation: Ghost Credential",
    "description": "A leaked VPN credential for a former contractor (no MFA) has been used for 6 nights of silent reconnaissance. The attacker has exfiltrated 80GB via rclone. You detect them during an active session.",
    "initial_prompt": "Monday 07:55 — SIEM: 'VPN login from Eastern European IP for account j.morrison — contractor who left 4 months ago.' Login succeeded. The account has been logging in nightly for 6 days between 02:00-04:00. Today's session is active and has been running 4 hours. Network flow shows connections to file server, backup server, and AD. The attacker is in your network right now.",
    "difficulty_level": "medium",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "DarkSide/BlackMatter-class (stolen VPN credential → silent reconnaissance → rclone exfiltration → double-extortion ransomware planned)",
        "irPhase": "Detection & Analysis (active session — pre-ransomware)",
        "attackVector": "VPN credential from dark web credential dump. No MFA. Former contractor account never deprovisioned. 6-day dwell for reconnaissance and data exfiltration via rclone to cloud storage before planned ransomware deployment.",
        "keyTTPs": ["T1078 — Valid Accounts", "T1133 — External Remote Services (VPN)", "T1046 — Network Service Scanning", "T1083 — File and Directory Discovery", "T1048 — Exfiltration via rclone", "T1486 — Data Encrypted for Impact (planned)"],
        "simulationContext": "Energy sector company, 500 employees. VPN: password-only authentication, no MFA. Contractor offboarding is manual and often incomplete. j.morrison has Domain User privileges and SMB access to 3 shares. DLP shows 80GB transferred to Mega.nz over 6 days. Backup server accessed 45 minutes ago — pre-ransomware preparation indicator.",
        "decisionTree": [
            {
                "stageId": "s1_active_session",
                "irPhase": "Detection & Analysis",
                "prompt": "The j.morrison VPN session is active (4h 12m). Mega.nz DLP alert: 80GB exfiltrated over 6 days. Backup server accessed 45 minutes ago. Do you terminate the session immediately or observe briefly while logging aggressively?",
                "analystContext": "Current session: source IP 185.220.x.x (Eastern European Tor exit). Bytes out this session: 18GB. Backup server access 45 minutes ago is a ransomware preparation indicator — attackers map backup locations before deployment.",
                "options": [
                    {"actionText": "Observe the session for 10 additional minutes while aggressively logging all traffic destinations and file access paths, then terminate and disable the account", "isCorrect": True, "consequence": "10 minutes of observation reveals the attacker cataloguing backup server configuration files. Full 6-day VPN and network logs captured. Session terminated. Complete attack timeline reconstructed.", "nextStageId": "s2_breach_parallel", "technicalExplanation": "A brief observation window while logging aggressively captures critical forensic evidence: what systems were accessed, what was exfiltrated, and whether ransomware deployment is imminent. However: backup server access suggests deployment may be imminent — if you observe active ransomware indicators (mass file renaming, shadow deletion), terminate immediately."},
                    {"actionText": "Terminate the VPN session and disable j.morrison immediately — every second risks further exfiltration and ransomware deployment", "isCorrect": True, "consequence": "Session terminated. Account disabled. 80GB already exfiltrated cannot be recovered but no new data is taken. 6-day logs capture the complete attack timeline.", "nextStageId": "s2_breach_parallel", "technicalExplanation": "Immediate termination is also valid — backup server access is a ransomware preparation indicator suggesting deployment is imminent. Both brief observation and immediate termination are defensible here. The key consideration: backup server access shifts the calculus toward immediate action."}
                ,
                    {"actionText": 'Send the user an email asking them to confirm whether they initiated the session', "isCorrect": False, "consequence": 'Email goes to the compromised mailbox. Threat actor sees the alert, accelerates exfiltration before you can act.', "nextStageId": 's2_breach_parallel', "technicalExplanation": 'Alerting the user via email when their mailbox may be compromised is counterproductive. Threat actors with mailbox access see these emails and use them as a trigger to accelerate their timeline.'},
                    {"actionText": 'Add the source IP to the firewall block list and log the incident', "isCorrect": False, "consequence": 'Attacker pivots to a VPN exit node in a different country. Session continues uninterrupted within 3 minutes.', "nextStageId": 's2_breach_parallel', "technicalExplanation": 'Blocking a single IP is ineffective against an authenticated session — the threat actor simply re-authenticates from a different IP. Session invalidation and credential rotation are the correct containment actions.'}]
            },
            {
                "stageId": "s2_breach_parallel",
                "irPhase": "Detection & Analysis → Containment",
                "prompt": "Session terminated, account disabled. Log analysis confirms 80GB transferred to Mega.nz — engineering schematics, customer PII exports, financial reports. This is a confirmed breach AND a ransomware precursor. What are your parallel workstreams?",
                "analystContext": "Legal/compliance team available. Backup integrity unknown — attacker may have modified backups. Mega.nz is beyond your reach. 23 other former contractor accounts remain active in AD from the same broken offboarding process.",
                "options": [
                    {"actionText": "Three simultaneous workstreams: (1) Verify backup integrity immediately, (2) Begin breach notification assessment with Legal for the 80GB PII exfiltration, (3) Audit all 23 contractor accounts against the same dark web credential dump", "isCorrect": True, "consequence": "Backup integrity confirmed intact. Breach notification process initiated. 3 of 23 contractor accounts found in the same credential dump — all disabled. No further unauthorized access.", "nextStageId": None, "technicalExplanation": "DarkSide-class attacks are double-extortion — data theft creates breach notification obligations regardless of whether ransomware deploys. GDPR: 72-hour notification deadline from awareness. HIPAA: 60 days. These workstreams run in parallel — not sequentially. When one credential from a dark web dump is compromised, treat the entire dump as relevant — all same-dataset accounts are potentially compromised."},
                    {"actionText": "Focus all resources on preventing ransomware deployment — breach notification can wait until after full containment", "isCorrect": False, "consequence": "Ransomware does not deploy but breach notification is delayed past the regulatory deadline. The organization faces regulatory fines on top of the incident costs.", "nextStageId": None, "technicalExplanation": "Breach notification and containment are parallel workstreams. The 80GB PII exfiltration is already a notifiable breach event — it occurred regardless of whether ransomware deploys. Waiting until containment is complete before starting breach assessment is a compliance failure."}
                ,
                    {"actionText": 'Preserve logs for 30 days and close the investigation — the session was short-lived', "isCorrect": False, "consequence": 'Attacker had established a mail forwarding rule to an external address. All email for 6 weeks forwarded before discovery.', "nextStageId": None, "technicalExplanation": 'Short session duration does not equate to limited impact. Sophisticated actors establish persistence (mail forwarding rules, OAuth app grants, delegated access) in the first minutes of a session. Every OAuth grant and mail rule must be audited before closing.'},
                    {"actionText": 'Enable MFA on the affected account only and continue monitoring', "isCorrect": False, "consequence": 'Attacker had already granted OAuth access to a third-party app that bypasses MFA. Access continues despite MFA enablement.', "nextStageId": None, "technicalExplanation": 'MFA protects interactive sign-in but does not revoke existing OAuth tokens or app grants. Post-compromise response must include auditing and revoking all OAuth tokens and app consent grants for the affected account.'}]
            }
        ],
        "lessonsLearned": [
            "Former contractor accounts must be deprovisioned automatically via HR system integration — manual checklists have a persistent failure rate",
            "VPN without MFA equals password-only security — credential dump exposure makes this category trivially exploitable",
            "Backup server access during dwell-time attacks is a pre-ransomware deployment indicator — trigger immediate escalation",
            "rclone execution to cloud storage from workstations is a DarkSide/BlackMatter signature TTP — alert on rclone process and block cloud storage upload endpoints",
            "Breach notification and containment run in parallel — they are not sequential activities",
            "When one account is in a dark web dump, treat all accounts from the same dataset as compromised pending review"
        ],
        "referenceLinks": ["https://www.cisa.gov/stopransomware/ransomware-guide", "https://attack.mitre.org/techniques/T1078/", "https://home.treasury.gov/system/files/126/ofac_ransomware_advisory_10012020_1.pdf"]
    }
})

# 5 — ALPHV/BlackCat-class
SCENARIOS.append({
    "name": "Operation: Hypervisor Lockout",
    "description": "ALPHV/BlackCat targeted VMware ESXi hypervisors via a Python encryptor deployed over SSH, encrypting all 14 VMs simultaneously. The Veeam backup server was also a VM — also encrypted.",
    "initial_prompt": "03:47 — PagerDuty: 'VMware vCenter unreachable.' ESXi direct login shows: all 14 VMs have .bcrypt extensions on their .vmdk files. VMs are all powered off. Ransom note 'RECOVER-HXBE7PQ-FILES.txt' in the datastore root. The Veeam backup server was a VM on ESXi host 1 — also encrypted. Your entire virtual infrastructure is down.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "ALPHV/BlackCat (Rust-based cross-platform RaaS — dedicated ESXi encryptor targets .vmdk, .vmem, .vswp; written in Rust for cross-platform deployment across Windows/Linux/ESXi)",
        "irPhase": "Detection & Analysis → Emergency Recovery Planning",
        "attackVector": "Stolen Citrix Workspace credentials (no MFA) → internal network → ESXi SSH permanently enabled → Python-based ALPHV ESXi encryptor deployed via SSH → encrypts all VMDKs while VMs are running → powers VMs off",
        "keyTTPs": ["T1133 — External Remote Services (Citrix)", "T1078 — Valid Accounts", "T1021.004 — Remote Services: SSH", "T1486 — Data Encrypted for Impact", "T1562.001 — Impair Defenses (ESXi firewall)", "T1490 — Inhibit System Recovery (backup encrypted)"],
        "simulationContext": "Professional services firm, 200 employees. All infrastructure on 2 ESXi hosts (14 VMs). Citrix gateway: no MFA. ESXi SSH permanently enabled since setup. Veeam backup server: a VM on ESXi host 1 (also encrypted). Physical tape backup: last job 5 days ago, at offsite vendor (18-hour retrieval). 3 VMs on ESXi host 2 have intact .vmss snapshot state files (5 days old — ALPHV missed them).",
        "decisionTree": [
            {
                "stageId": "s1_recovery_inventory",
                "irPhase": "Detection & Analysis",
                "prompt": "All 14 VMs encrypted. Veeam server encrypted. Before deciding recovery path, what recoverable assets do you catalog?",
                "analystContext": "ESXi host 1: 8 VMs encrypted including Veeam server. ESXi host 2: 6 VMs encrypted, but 3 have intact .vmss snapshot files in the datastore. Tape at offsite: 5 days old, covers all 14 VMs, 18-hour retrieval.",
                "options": [
                    {"actionText": "Catalog all unencrypted files: .vmss snapshot files on ESXi host 2, any OVA exports on isolated storage, and confirm tape availability and retrieval timeline with the offsite vendor", "isCorrect": True, "consequence": "3 VMs have 5-day-old snapshots intact on ESXi host 2. 11 VMs have no local recovery option. Tape vendor confirms availability — 18-hour retrieval. Recovery strategy: snapshots for critical VMs now, tape for full restore.", "nextStageId": "s2_entry_closure", "technicalExplanation": "ALPHV's ESXi encryptor targets .vmdk, .vmem, .vswp. The .vmss (suspended state) format is sometimes missed. Offline/offsite backups are completely unaffected by in-environment encryption. Enumerating recovery assets before any restore determines the entire recovery strategy and timeline."},
                    {"actionText": "Attempt to power on the encrypted VMs — maybe only disk headers are encrypted and they might partially boot", "isCorrect": False, "consequence": "Attempting to boot encrypted VMDKs causes ESXi to throw disk read errors and the guest OS to attempt filesystem recovery operations that overwrite encrypted sectors — potentially damaging future decryption.", "nextStageId": "s2_entry_closure", "technicalExplanation": "ALPHV encrypts VMDKs from the very beginning of the file including partition tables and filesystem superblocks. Attempting to boot causes guest OS filesystem recovery operations that overwrite encrypted sectors. This can permanently prevent decryption even if a key is later obtained. Never attempt to boot an encrypted VM."}
                ,
                    {"actionText": 'Attempt to decrypt the hypervisor using a publicly available decryptor tool', "isCorrect": False, "consequence": 'No public decryptor exists for this variant. 6 hours wasted. Recovery via backup is delayed.', "nextStageId": 's2_entry_closure', "technicalExplanation": 'Decryptors are only available for ransomware families where key material has been shared or seized by law enforcement. Without a confirmed decryptor, attempting decryption wastes critical recovery time. Begin backup restoration immediately.'},
                    {"actionText": 'Pay the ransom to recover the hypervisor encryption key', "isCorrect": False, "consequence": 'Payment made. No decryption key received. Threat actor ghosts. Complete rebuild required anyway.', "nextStageId": 's2_entry_closure', "technicalExplanation": 'CISA and FBI advise against ransom payment — it does not guarantee key delivery, funds further criminal activity, and does not address the root compromise. Recovery via clean backups is always preferable when available.'}]
            },
            {
                "stageId": "s2_entry_closure",
                "irPhase": "Containment — Close Entry Vector Before Recovery",
                "prompt": "Recovery options confirmed (snapshots + tape). ESXi auth logs show SSH login from Citrix gateway VIP at 01:23 using account 'r.santos'. Citrix logs show r.santos logged in from a foreign IP at 01:14 — stolen credential confirmed. r.santos normally authenticates during UK business hours. What must you do BEFORE beginning VM restoration?",
                "analystContext": "Citrix gateway logs on a separate physical server (not encrypted). r.santos is a current employee — credential stolen per threat intel. ESXi SSH enabled on both hosts. ALPHV affiliates are documented to re-enter during recovery to deploy a second payload.",
                "options": [
                    {"actionText": "Disable r.santos Citrix account, disable SSH on both ESXi hosts, change all ESXi root passwords, enforce MFA on Citrix for ALL accounts — BEFORE beginning any VM restoration", "isCorrect": True, "consequence": "Entry vector closed. r.santos disabled. ESXi SSH disabled. Attacker cannot re-enter during recovery. Restoration begins in isolated VLAN.", "nextStageId": None, "technicalExplanation": "ALPHV affiliates are documented to re-enter victim environments during recovery to deploy second payloads or delete backups being restored. CISA ALPHV advisory explicitly warns about this. Closing ALL entry vectors before restoration is mandatory — not optional. ESXi SSH should only be enabled for specific maintenance windows and disabled immediately after."},
                    {"actionText": "Begin VM restoration immediately — close the entry vector in parallel to save time", "isCorrect": False, "consequence": "During recovery, the attacker re-enters via Citrix (r.santos credential still valid), uses retained ESXi SSH access to delete the snapshot files and corrupt the tape restore jobs in progress. Recovery fails.", "nextStageId": None, "technicalExplanation": "This is the most documented ALPHV recovery failure mode. ALPHV operators explicitly monitor victims during recovery and re-enter to maximize damage. Entry vector closure must precede recovery. Not in parallel — before."}
                ,
                    {"actionText": 'Change the hypervisor admin password and re-enable remote management', "isCorrect": False, "consequence": 'Threat actor re-enters via the same IAM vulnerability that granted initial access. Second deployment within 48 hours.', "nextStageId": None, "technicalExplanation": 'Credential rotation without closing the initial access vector (unpatched CVE, misconfigured IAM role, or exposed management interface) guarantees reinfection. Root cause must be fully addressed before restoring remote management access.'},
                    {"actionText": 'Restore from the most recent backup regardless of its age', "isCorrect": False, "consequence": "Most recent backup is 3 days old and was taken after the attacker's initial access. Backdoor restored along with the backup.", "nextStageId": None, "technicalExplanation": 'Backup selection requires verifying the backup predates the initial compromise timestamp (from forensics). Restoring from a backup taken after compromise may restore attacker persistence mechanisms along with the legitimate data.'}]
            }
        ],
        "lessonsLearned": [
            "ALPHV ESXi encryptor encrypts .vmdk/.vmem/.vswp in a single SSH session — all VMs go down simultaneously",
            "Veeam backup server as a VM on the same ESXi it backs up is a single point of failure — backup infrastructure must be physically isolated",
            "ESXi SSH must be disabled by default — permanent SSH access to hypervisors is a critical attack surface",
            "ALPHV affiliates re-enter during recovery — close ALL entry vectors before beginning any restoration",
            "Restore into isolated VLAN before reconnecting to production — prevent re-infection of clean systems",
            "Offsite tape or S3 Object Lock backups are the last line of defense when all on-premises backup systems are encrypted"
        ],
        "referenceLinks": ["https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-353a", "https://attack.mitre.org/software/S1068/", "https://www.nist.gov/publications/guide-cybersecurity-event-recovery"]
    }
})

# 6 — Clop/MOVEit-class
SCENARIOS.append({
    "name": "Operation: Silent Exfiltration",
    "description": "A zero-day SQL injection in your internet-facing managed file transfer software was exploited 3 weeks ago. No encryption. An extortion demand arrives claiming 3,400 sensitive documents were stolen.",
    "initial_prompt": "Vulnerability management vendor issues emergency advisory: 'Critical zero-day SQL injection in your MFT software — CVE-XXXX-XXXX — actively exploited in the wild. Patch immediately and assume breach.' You've run this MFT software 3 years for partner file exchanges. No encrypted files, no visible impact. But the advisory says attackers may have been inside for weeks.",
    "difficulty_level": "medium",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "Clop-class (SQL injection zero-day in MFT software → web shell → data theft only → pure extortion without encryption)",
        "irPhase": "Detection & Analysis (no encryption — pure data theft extortion)",
        "attackVector": "SQL injection zero-day in internet-facing MFT application → ASPX web shell at /aspnet_client/system_web/x.aspx → database queries extract file transfer records → HTTPS exfiltration. No ransomware deployed.",
        "keyTTPs": ["T1190 — Exploit Public-Facing Application", "T1505.003 — Web Shell", "T1074.001 — Data Staged Locally", "T1048.002 — Exfiltration Over HTTPS", "T1657 — Financial Theft (extortion)"],
        "simulationContext": "Legal firm handling M&A transactions, 150 employees. MFT server internet-facing (TCP/443), no WAF. IIS logs retained 7 days (short rotation). Web shell /aspnet_client/system_web/x.aspx uploaded day of exploitation ~3 weeks ago. No FIM on application directory.",
        "decisionTree": [
            {
                "stageId": "s1_patch_vs_forensics",
                "irPhase": "Detection & Analysis",
                "prompt": "Vendor patch available. Applying it restarts IIS and overwrites the application directory — destroying any web shells and clearing application logs. MFT server is live processing partner transfers. Do you patch immediately or preserve forensic evidence first?",
                "analystContext": "IIS log rotation: 7 days. Vendor patch overwrites /aspnet_client/ directory. Disk imaging tool available. Legal team wants breach scope before regulatory notifications.",
                "options": [
                    {"actionText": "Parallel workstreams: take MFT offline, immediately image the disk to preserve web shells and logs, export all available IIS/application logs — then apply the patch", "isCorrect": True, "consequence": "Disk image captured before patching. Web shell preserved. IIS logs reveal 47 SQL injection requests and HTTP POST commands starting 21 days ago. Full attack timeline reconstructed.", "nextStageId": "s2_scope_sql", "technicalExplanation": "Vendor patches for web application zero-days typically overwrite application directories, removing web shells and clearing logs. Preservation before patching is critical for breach scope determination, regulatory evidence, and verifying extortion claims. Add a WAF virtual patch rule first to immediately block the SQL injection — closes the active exploit vector while preserving the system state for imaging."},
                    {"actionText": "Apply the patch immediately to close the vulnerability — every minute the zero-day exists risks more exploitation", "isCorrect": False, "consequence": "Patch applied. Web shell and SQL injection evidence overwritten. You cannot determine breach scope. Three weeks later an extortion email arrives — you have no forensic basis to verify or dispute the 3,400 file claim.", "nextStageId": "s2_scope_sql", "technicalExplanation": "The zero-day exploitation occurred weeks ago — 24 hours of additional exposure while imaging is negligible risk compared to permanently losing all forensic evidence. Add WAF virtual patch first (immediate protection), then image, then apply vendor patch."}
                ,
                    {"actionText": 'Immediately patch the SQL injection vulnerability and close the investigation', "isCorrect": False, "consequence": 'Patch applied. No forensics performed. Scope of exfiltration unknown. Regulatory notification deadlines missed.', "nextStageId": 's2_scope_sql', "technicalExplanation": 'Patching the entry point without forensic collection means you cannot determine what data was accessed, how long access was maintained, or whether persistence was established. GDPR Article 33 and equivalent regulations require a breach investigation — patching alone does not satisfy notification obligations.'},
                    {"actionText": 'Take the SQL server offline immediately to stop any ongoing access', "isCorrect": False, "consequence": 'Server offline halts access but also destroys volatile memory containing query history and active session data needed for forensics.', "nextStageId": 's2_scope_sql', "technicalExplanation": 'Hard power-off destroys volatile memory (RAM), which may contain active database sessions, query caches, and attacker tool artifacts. Memory acquisition must precede any shutdown action.'}]
            },
            {
                "stageId": "s2_scope_sql",
                "irPhase": "Detection & Analysis",
                "prompt": "Forensics: web shell received 47 command sequences over 21 days. Database query logs show SELECT statements extracting file paths and metadata for ~3,400 documents. How do you determine exactly which files were stolen?",
                "analystContext": "MFT database contains metadata for all files transferred in 3 years: filename, hash, sender, recipient, transfer date, content category. The 47 SQL SELECT queries are logged. Attacker exfiltrated via HTTPS to 77.88.x.x.",
                "options": [
                    {"actionText": "Reconstruct the 47 SQL SELECT queries from database query logs and cross-reference against the file metadata database — produce exact list of stolen documents with content categories, senders, and recipients", "isCorrect": True, "consequence": "Reconstruction identifies: 1,847 M&A client documents, 612 files with client PII, 941 financial due diligence reports. Breach notification targeted to actually affected parties — not a blanket all-clients notification.", "nextStageId": None, "technicalExplanation": "SQL query reconstruction from database logs is the definitive forensic method for web application data breaches. It serves: (1) Targeted regulatory notification (GDPR/CCPA require notifying only affected data subjects), (2) Legal evidence chain, (3) Verification of attacker extortion claims — if they claim 10,000 files but forensics shows only 3,400 were accessible, their claims are demonstrably overstated."}
                ,
                    {"actionText": 'Review only the tables that contain the most sensitive PII and check for SELECT queries', "isCorrect": False, "consequence": 'Attacker exfiltrated financial data from tables not flagged as high-sensitivity. Breach scope understated by 40%.', "nextStageId": None, "technicalExplanation": "Scoping exfiltration review to 'most sensitive' tables is a risk-based shortcut that produces an incomplete picture. SQL injection enables access to all tables the database user account can reach — the forensic scope must cover all accessible objects."},
                    {"actionText": 'Check network flow logs for large outbound transfers in the last 24 hours only', "isCorrect": False, "consequence": 'Exfiltration occurred over 3 weeks in small 50KB increments. 24-hour window misses 97% of the stolen data.', "nextStageId": None, "technicalExplanation": "Sophisticated actors throttle exfiltration to avoid anomaly detection thresholds. Slow-and-low exfiltration over weeks is specifically designed to evade short-window log reviews. Full database query log analysis covering the injection vulnerability's existence window is required."},
                    {"actionText": 'Check the WAF logs for the last hour to identify what the attacker accessed', "isCorrect": False, "consequence": "WAF logs show blocked requests only. Successful SQL injection that bypassed WAF rules is not logged — attacker's actual queries invisible.", "nextStageId": None, "technicalExplanation": 'WAF logs capture blocked and flagged requests. SQL injection that bypasses WAF rules (e.g., via encoding, parameter pollution) produces no WAF log entry. Database-side query logs (if enabled) are the only authoritative record of what the attacker executed.'}]
            }
        ],
        "lessonsLearned": [
            "Data theft extortion without encryption is the primary Clop-class model — no encrypted files does not mean no ransomware incident",
            "Forensic evidence preservation must occur BEFORE vendor patching — patches overwrite web shells and application logs",
            "Add WAF virtual patching first (immediate protection), then image, then apply vendor patch — this sequence protects and preserves",
            "SQL database query logging is the definitive forensic method for determining breach scope in MFT attacks",
            "FIM on web application directories detects web shell uploads within seconds of creation — alerting the missing control in this scenario",
            "Paying data extortion to OFAC-sanctioned groups is a federal violation — law enforcement notification is the required response"
        ],
        "referenceLinks": ["https://www.cisa.gov/stopransomware/ransomware-guide", "https://attack.mitre.org/techniques/T1190/", "https://attack.mitre.org/techniques/T1505/003/"]
    }
})

# 7 — Scattered Spider/Social Engineering
SCENARIOS.append({
    "name": "Operation: Impersonation Call",
    "description": "Your IT help desk receives a vishing call from someone impersonating a senior executive. The attacker researched their target on LinkedIn. One wrong decision grants full VPN access.",
    "initial_prompt": "You are the Tier-1 help desk analyst. A call comes in: 'Hi, I'm the VP of Finance — I'm travelling and locked out of my VPN and email. Board presentation in 2 hours. My employee ID is 884421.' The caller sounds authoritative and frustrated. Your colleague says 'just reset it — sounds real.' Your SOP requires callback to the corporate mobile on file.",
    "difficulty_level": "medium",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "Scattered Spider / Social Engineering-class (vishing → help desk MFA bypass → ALPHV/BlackCat deployment)",
        "irPhase": "Preparation (active social engineering attack — testing whether controls hold)",
        "attackVector": "Voice phishing (vishing) targeting IT help desk. Attacker researches target on LinkedIn (name, employee ID format, manager, department). Urgency + authority pressure tactics used to bypass MFA reset verification.",
        "keyTTPs": ["T1598 — Phishing for Information (LinkedIn recon)", "T1656 — Impersonation", "T1621 — MFA Request Generation", "T1133 — External Remote Services (VPN post-bypass)"],
        "simulationContext": "Technology company, 800 employees. MFA enforced on VPN and email. Help desk SOP inconsistently followed under time pressure. Attacker found VP's name, employee ID format (6-digit), manager's name, and department on LinkedIn before calling. Real VP reachable via internal Slack.",
        "decisionTree": [
            {
                "stageId": "s1_vishing_call",
                "irPhase": "Preparation (active attack — testing controls)",
                "prompt": "Caller provides employee ID 884421, knows manager's name and department (all findable on LinkedIn). Says they can't receive callback on corporate mobile because 'that's the device they're locked out of.' Your SOP: callback to corporate number OR manager approval via separate channel. Your colleague is about to reset. What do you do?",
                "analystContext": "Directory confirms VP of Finance with similar name exists. 884421 matches 6-digit ID format. SOP verification options: (1) callback to corporate mobile, OR (2) manager approval via internal Slack/Teams. Caller has provided name, employee ID, department — all discoverable via LinkedIn in 10 minutes.",
                "options": [
                    {"actionText": "Stop the reset. Message the VP's manager directly via internal Slack using their name from the directory — ask them to confirm the VP is locked out and requesting a reset", "isCorrect": True, "consequence": "Manager replies via Slack within 3 minutes: 'I haven't heard from the VP today — do not reset anything.' Manager calls VP's personal mobile. Real VP is in a meeting and never called the help desk. Attack blocked.", "nextStageId": "s2_post_call_hardening", "technicalExplanation": "Key principle: verify through a channel the caller cannot control. The caller may have provided the corporate phone number they know — but they cannot intercept your internal Slack message to the manager. Manager verification via authenticated internal messaging is the correct backup when primary callback fails. Urgency + authority = red flags requiring more verification, not less."},
                    {"actionText": "Ask the caller to provide additional verification: manager's full name and office location", "isCorrect": False, "consequence": "Attacker already knows the manager's name (LinkedIn) and office address (company website). They answer correctly. Colleague resets the account. Attacker now has VPN and email access.", "nextStageId": "s2_post_call_hardening", "technicalExplanation": "Any publicly available information (LinkedIn, company websites, professional directories) cannot be used as identity verification — attackers research all of it before calling. Valid verification requires physical possession (hardware token) or a trusted internal channel the caller cannot intercept."},
                    {"actionText": "Reset the account — blocking a senior executive creates political risk for the help desk team", "isCorrect": False, "consequence": "Account reset and access granted. Within 3 hours the attacker deploys ransomware using the VP's domain permissions and SSO access to the M365 admin portal.", "nextStageId": "s2_post_call_hardening", "technicalExplanation": "Political pressure from apparent seniority is a primary Scattered Spider social engineering technique. Security policy must apply equally to all employees — 'senior executive' status should trigger MORE verification because high-privilege accounts are higher-value targets."}
                ,
                    {"actionText": 'Ask the caller to email their request so you have it in writing before proceeding', "isCorrect": False, "consequence": "Attacker sends a spoofed email that appears to match the caller's claimed identity. Credentials provisioned based on email confirmation.", "nextStageId": 's2_post_call_hardening', "technicalExplanation": 'Email is trivially spoofed. Using email as a verification mechanism for a vishing call does not add security — it provides a false sense of verification that an attacker can exploit with a spoofed message.'},
                    {"actionText": 'Reset the password as requested since the caller knew internal project names', "isCorrect": False, "consequence": 'Internal project names were harvested from LinkedIn and a prior phishing email. Credentials handed to the attacker.', "nextStageId": 's2_post_call_hardening', "technicalExplanation": 'OSINT from LinkedIn, company websites, and prior phishing campaigns gives threat actors convincing internal vocabulary. Knowledge of project names, team structures, or internal jargon is not a valid authentication factor.'}]
            },
            {
                "stageId": "s2_post_call_hardening",
                "irPhase": "Post-Incident Activity",
                "prompt": "Attack was blocked (or succeeded). Help desk SOP was nearly bypassed by publicly-available information. CISO asks: what is the single technical control that makes voice impersonation impossible regardless of what information an attacker knows?",
                "analystContext": "Current verification methods: callback to corporate mobile (bypassable if caller claims device unavailable), employee ID (bypassable via LinkedIn). Goal: verification that cannot be researched, guessed, or socially engineered.",
                "options": [
                    {"actionText": "Implement hardware FIDO2 security key verification for all help desk MFA resets: no reset occurs without the physical key. Add a 24-hour cooling period for all MFA re-enrollments.", "isCorrect": True, "consequence": "Physical FIDO2 verification is impossible to bypass via phone — attacker cannot produce a hardware token they don't possess. 24-hour cooldown prevents urgency-driven bypasses.", "nextStageId": None, "technicalExplanation": "FIDO2/WebAuthn keys are hardware-bound — they require physical possession, cannot be socially engineered, and cannot be transferred over a phone call. Alternative: require manager approval via SSO-authenticated Slack/Teams (identity verified by authenticated session, not by what they say). These controls defeat Scattered Spider's entire operational model."}
                ,
                    {"actionText": "Add a note to the affected user's file warning future helpdesk agents", "isCorrect": False, "consequence": 'Note is not checked by an agent 2 weeks later. Same attacker calls again with a different pretext and succeeds.', "nextStageId": None, "technicalExplanation": 'Manual notes in user files are not a reliable control — they depend on agents checking them for every call. A systematic control (callback verification policy, manager approval for sensitive resets, out-of-band verification) is required.'},
                    {"actionText": 'Suspend the targeted account temporarily and require in-person verification', "isCorrect": False, "consequence": 'Account suspended but no policy updated. Next vishing target for a different account succeeds because the helpdesk procedure is unchanged.', "nextStageId": None, "technicalExplanation": 'Individual account remediation without policy change leaves the rest of the organization vulnerable. Vishing is a process attack — the helpdesk procedure itself must be updated with callback verification for ALL sensitive requests.'},
                    {"actionText": "Disable the targeted user's account entirely until an investigation is complete", "isCorrect": False, "consequence": 'Account disabled without policy change. Next vishing call targets a different account. Helpdesk agent follows the same flawed procedure and complies.', "nextStageId": None, "technicalExplanation": 'Individual account remediation without updating the helpdesk callback verification procedure leaves every other account equally vulnerable. Vishing exploits process gaps — the process must change, not just the individual account status.'}]
            }
        ],
        "lessonsLearned": [
            "Urgency and authority are the primary social engineering levers — they should trigger MORE verification, not less",
            "Anything on LinkedIn, company websites, or professional directories cannot be used as identity verification",
            "Verify through a channel the caller cannot control: physical hardware token or manager approval via authenticated internal chat",
            "Impossible-travel login detection (reset → immediate foreign VPN login) should trigger automated SOAR session termination",
            "FIDO2 hardware keys are the only verification method physically impossible to bypass via voice call"
        ],
        "referenceLinks": ["https://www.cisa.gov/stopransomware/ransomware-guide", "https://attack.mitre.org/techniques/T1656/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 8 — NotPetya-class
SCENARIOS.append({
    "name": "Operation: Poisoned Update",
    "description": "A routine software update delivers a destructive wiper masquerading as ransomware. There is NO decryption key. The wiper spreads via EternalBlue and Mimikatz-harvested credentials simultaneously.",
    "initial_prompt": "Finance team applied an accounting software update this morning per vendor notification. 30 minutes later: 15 machines show 'Repairing file system' on boot then go permanently dark. No ransom note. No payment demand. Just unbootable machines. SIEM shows massive internal TCP/445 scanning from machines that received the update. A wiper is spreading.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "NotPetya-class (state-sponsored wiper disguised as ransomware — trojanized supply chain update, MBR/MFT destruction, EternalBlue + credential-based spread, NO decryption path)",
        "irPhase": "Detection & Analysis → Emergency Containment",
        "attackVector": "Trojanized software update from compromised vendor server. Delivers MBR/MFT-destroying wiper masquerading as ransomware. Spreads via EternalBlue (SMBv1/TCP/445) AND Mimikatz-harvested credentials via WMIC/PsExec — two independent propagation paths.",
        "keyTTPs": ["T1195.002 — Supply Chain Compromise", "T1485 — Data Destruction (MBR/MFT)", "T1210 — EternalBlue lateral spread", "T1569.002 — PsExec", "T1003 — OS Credential Dumping"],
        "simulationContext": "Manufacturing firm, 600 workstations, 40 servers. 28 machines received the accounting update. 15 are unbootable. 13 still running and spreading. 3 DCs not yet affected. NO decryption key exists — this is a wiper, not ransomware. Every machine it reaches is a permanent total loss.",
        "decisionTree": [
            {
                "stageId": "s1_wiper_identification",
                "irPhase": "Detection & Analysis",
                "prompt": "15 machines unbootable. 13 running and spreading. Your colleague says 'should we check for a payment demand and consider paying?' You suspect this is a wiper. What technical evidence confirms wiper vs. ransomware in 60 seconds?",
                "analystContext": "One running machine shows: fake 'chkdsk' repair message in console, MBR/MFT write operations in disk I/O logs, NO outbound C2 connections, NO ransom note, scheduled reboot in 8 minutes.",
                "options": [
                    {"actionText": "Confirm wiper: (1) No C2 = no key exchange = no decryption possible, (2) MBR write ops confirm disk destruction, (3) No ransom note = not designed for payment. Shift ALL resources to protection immediately — no recovery path exists.", "isCorrect": True, "consequence": "Wiper confirmed. Response strategy shifts from 'recover' to 'protect the unaffected.' All resources redirected to containing the 13 running infected machines and protecting the 3 DCs.", "nextStageId": "s2_dual_vector_containment", "technicalExplanation": "Ransomware requires C2 communication for key exchange. No C2 = no encryption key = no decryption possible = wiper. NotPetya-class: (1) fake CHKDSK (MBR already overwritten), (2) scheduled reboot to trigger MBR bootloader destruction, (3) no payment infrastructure. This identification takes 60 seconds. Every minute spent looking for a payment demand that does not exist is permanent data loss."},
                    {"actionText": "Spend time searching for a payment demand and ransom contact — maybe we can pay to stop the spread", "isCorrect": False, "consequence": "25 minutes searching for a nonexistent payment system. Wiper spreads from 15 to 89 machines via credential-based lateral movement. The 3 DCs are now affected.", "nextStageId": "s2_dual_vector_containment", "technicalExplanation": "This is the critical decision error in wiper response. Time is the only resource that limits damage — every minute spent on impossible ransom negotiation is permanent data loss. Wiper identification takes 60 seconds. Once identified, 100% of resources go to containment."}
                ,
                    {"actionText": 'Restore all affected systems from the most recent backup immediately', "isCorrect": False, "consequence": 'Most recent backup was taken 4 hours after the poisoned update — wiper artifacts restored along with legitimate data.', "nextStageId": 's2_dual_vector_containment', "technicalExplanation": "Backup restoration must use a backup predating the compromise timestamp, confirmed via forensic analysis. Blind restoration from 'most recent' backup frequently reintroduces malware if the compromise predates the backup window."},
                    {"actionText": 'Run a hash comparison of all update binaries against known-good vendor hashes', "isCorrect": False, "consequence": 'Hash comparison identifies the poisoned binary, but by the time it completes, the second stage payload has already executed on 80% of affected hosts.', "nextStageId": 's2_dual_vector_containment', "technicalExplanation": 'Hash verification is a useful forensic step but not an emergency containment action. Network segmentation and process termination must occur in parallel with forensic identification to stop ongoing execution.'}]
            },
            {
                "stageId": "s2_dual_vector_containment",
                "irPhase": "Emergency Containment",
                "prompt": "Wiper confirmed. DCs not yet affected. Wiper spreads via TWO paths: (1) EternalBlue TCP/445, AND (2) Mimikatz-harvested DA credentials via WMIC/PsExec. Blocking TCP/445 alone is insufficient. How do you contain BOTH vectors simultaneously?",
                "analystContext": "3 DCs in dedicated server VLAN but connected to same firewall. All DA accounts were logged into at least one infected machine in the last 2 hours. 13 infected machines spread across 3 floors. Managed switch and firewall available.",
                "options": [
                    {"actionText": "Three simultaneous actions: (1) Firewall: block TCP/445 AND TCP/135+WMI ports inbound to all DCs. (2) Active Directory: disable ALL Domain Admin accounts immediately (create break-glass first). (3) Switches: disable ports for all 13 infected machines.", "isCorrect": True, "consequence": "Both spread vectors blocked simultaneously. DCs survive. 13 infected machines contained. Total wiper damage: 15 machines (permanent loss). All servers and 587 workstations protected.", "nextStageId": None, "technicalExplanation": "NotPetya-class dual-vector spread requires dual-vector containment: (1) Network blocking stops EternalBlue (TCP/445) and WMIC execution (TCP/135). (2) DA account disabling renders all harvested Kerberos tickets and NTLM hashes useless for PsExec/WMIC lateral movement. (3) Switch port isolation removes network connectivity from infected machines. All three must happen simultaneously — the wiper uses whichever vector remains open."}
                ,
                    {"actionText": 'Block the update server domain at the perimeter firewall', "isCorrect": False, "consequence": 'Perimeter block stops new downloads but payloads already distributed and executing internally are unaffected.', "nextStageId": None, "technicalExplanation": 'Blocking external update domains prevents new downloads but has no effect on payloads already cached locally and executing. Internal containment (network segmentation, endpoint isolation) is required to stop active execution.'},
                    {"actionText": 'Notify the software vendor and wait for their official response before acting', "isCorrect": False, "consequence": '30-minute wait for vendor response. Wiper completes destruction of critical systems during the delay.', "nextStageId": None, "technicalExplanation": 'Vendor notification is appropriate but must happen in parallel with containment — not instead of it. Active wiper execution cannot wait for vendor communication cycles.'},
                    {"actionText": 'Restore only the servers that have confirmed wiper activity from the most recent backup', "isCorrect": False, "consequence": 'Most recent backup was taken 2 hours after initial compromise — wiper persistence restored along with clean data.', "nextStageId": None, "technicalExplanation": "Selective restoration from 'most recent' backup requires first confirming that backup predates the initial compromise. In a supply chain attack, the compromise window may span days before destructive payload activation — restore from a backup confirmed clean via forensic timeline analysis."}]
            }
        ],
        "lessonsLearned": [
            "No C2 + MBR write operations + no ransom note = wiper, not ransomware — 60-second identification changes the entire response",
            "Wiper scenarios have NO recovery path for affected machines — every second of delay is permanent irreversible data loss",
            "Dual-vector spread requires dual-vector containment: network blocking (EternalBlue) AND DA credential invalidation (credential-based)",
            "Software update staging with change management delays creates a threat intelligence window before production deployment",
            "SHA-256 hash verification against vendor-published checksums detects supply chain tampering even with valid digital signatures",
            "Application allowlisting prevents legitimate software from performing out-of-character operations like MBR writes"
        ],
        "referenceLinks": ["https://attack.mitre.org/techniques/T1195/002/", "https://www.cisa.gov/stopransomware/ransomware-guide", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 9 — LockBit-class
SCENARIOS.append({
    "name": "Operation: RDP Breach",
    "description": "An attacker brute-forced an internet-exposed RDP port, escalated via pass-the-hash, and modified the Default Domain Policy GPO to auto-deploy LockBit at next reboot. Windows Update auto-reboot is scheduled for 03:00.",
    "initial_prompt": "22:17 Friday — EDR: 'Mass file encryption on WS-LEGAL-03, 847 files in 45 seconds.' Simultaneously SIEM: 'Default Domain Policy GPO modified — new startup script added.' You check the GPO: a malicious executable will run at startup on ALL domain machines. Windows Update reboots all machines at 03:00. You have 4 hours 43 minutes before 199 machines execute ransomware.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "LockBit-class (RDP brute-force → pass-the-hash DA escalation → GPO-based auto-spread → 80-120 files/second encryption)",
        "irPhase": "Detection & Analysis → Emergency Containment",
        "attackVector": "Internet-exposed RDP TCP/3389 brute-forced over 48 hours. Local admin obtained. Pass-the-hash using shared local admin credential to escalate to DA. Default Domain Policy modified with ransomware startup script. Patient zero manually triggered.",
        "keyTTPs": ["T1110.001 — RDP Brute Force", "T1550.002 — Pass the Hash", "T1484.001 — Domain Policy Modification (GPO)", "T1486 — Data Encrypted for Impact", "T1490 — Inhibit System Recovery"],
        "simulationContext": "Law firm, 200 workstations. RDP exposed directly on TCP/3389 (no VPN). All workstations share the same local admin password ('legaladmin' — never rotated). LockBit encrypts at 80-120 files/second. Patient zero (WS-LEGAL-03) is encrypting. 199 machines have the malicious GPO but have not rebooted yet.",
        "decisionTree": [
            {
                "stageId": "s1_gpo_priority",
                "irPhase": "Emergency Containment",
                "prompt": "One machine is actively encrypting (WS-LEGAL-03 — a completed loss in ~1-2 minutes regardless of your action). 199 machines have the malicious startup script in the Default Domain Policy GPO. Windows Update reboots all 199 at 03:00 — 4h 43m away. What is your SINGLE most urgent action in the next 60 seconds?",
                "analystContext": "Group Policy Management Console available — can edit Default Domain Policy immediately. WSUS controls auto-reboot schedule. WS-LEGAL-03 will complete encryption in 1-2 minutes regardless. The 199 other machines are currently safe but will execute ransomware at 03:00 if GPO payload is not removed.",
                "options": [
                    {"actionText": "Remove the malicious startup script from Default Domain Policy via GPMC immediately, then disable WSUS auto-reboot for tonight", "isCorrect": True, "consequence": "GPO payload removed. WSUS reboot disabled. 199 machines safe. Time to isolate patient zero and conduct full investigation without the 03:00 deadline.", "nextStageId": "s2_rdp_close", "technicalExplanation": "WS-LEGAL-03 will complete encryption in 1-2 minutes — it's a completed loss regardless of when you isolate it. The 199 machines represent preventable future loss. GPO removal in GPMC takes 30 seconds and protects 199 machines. Important: remove the script from Default Domain Policy, do NOT delete the GPO itself — deleting Default Domain Policy breaks domain authentication."},
                    {"actionText": "Isolate WS-LEGAL-03 first to stop the active encryption, then deal with the GPO", "isCorrect": False, "consequence": "You isolate WS-LEGAL-03 in 3 minutes. At 03:00, Windows Update reboots all 199 machines. Each executes the startup script. 199 machines encrypt simultaneously. Total encrypted: 200 machines.", "nextStageId": "s2_rdp_close", "technicalExplanation": "Patient zero will complete encryption in 1-2 minutes regardless. The GPO represents 199 machines you can still save. Isolating patient zero (a completed loss) while 199 preventable infections advance toward 03:00 is the wrong priority. GPO removal is 30 seconds in GPMC vs. 4 hours 43 minutes of safety margin for 199 machines."}
                ,
                    {"actionText": 'Block RDP at the endpoint firewall on all workstations via GPO', "isCorrect": False, "consequence": 'GPO requires domain connectivity and propagation — takes 90 minutes. Attacker pivots to 3 more servers via RDP before the policy applies.', "nextStageId": 's2_rdp_close', "technicalExplanation": 'GPO-based firewall rules require successful policy application on each endpoint — dependent on domain connectivity, propagation interval, and machine reboots. This is too slow for active lateral movement. Direct perimeter/internal firewall rules are the immediate control.'},
                    {"actionText": 'Change the RDP port from 3389 to a non-standard port across the environment', "isCorrect": False, "consequence": 'Attacker already has valid credentials. Port change is irrelevant — they scan for the new port and reconnect within minutes.', "nextStageId": 's2_rdp_close', "technicalExplanation": "Port obfuscation ('security through obscurity') provides no meaningful protection against an attacker with valid credentials. A simple port scan identifies the relocated service within minutes."}]
            },
            {
                "stageId": "s2_rdp_close",
                "irPhase": "Eradication",
                "prompt": "GPO cleaned. WSUS reboot disabled. Patient zero isolated. The attacker used shared local admin account 'legaladmin' (same password on all 200 workstations) and escalated via pass-the-hash. How do you close the attack vector and prevent credential reuse on the rest of the estate?",
                "analystContext": "Attacker source: 185.220.x.x (Tor exit). Authenticated as 'legaladmin'. The legaladmin NTLM hash is identical on all 200 workstations — compromising one gives pass-the-hash access to all. Internet-exposed TCP/3389 still open. LAPS not deployed.",
                "options": [
                    {"actionText": "Block all inbound TCP/3389 at the perimeter firewall immediately, rotate the legaladmin password on all 200 machines via script, then deploy LAPS (unique per-machine local admin passwords)", "isCorrect": True, "consequence": "RDP blocked. Shared credential invalidated across all machines. LAPS deployment planned. Attacker cannot re-enter via RDP or reuse legaladmin via pass-the-hash.", "nextStageId": None, "technicalExplanation": "Shared local admin passwords enable pass-the-hash (T1550.002) across the entire estate — compromising one machine compromises all. LAPS (built-in Windows, free) generates unique automatically-rotating local admin passwords stored in AD. Direct internet RDP exposure is the most common LockBit initial access vector per CISA advisories — it must be removed and replaced with VPN + MFA."}
                ,
                    {"actionText": 'Enable RDP Network Level Authentication (NLA) as the sole mitigation', "isCorrect": False, "consequence": 'NLA requires authentication before session establishment but the attacker already has valid credentials — NLA does not block them.', "nextStageId": None, "technicalExplanation": 'NLA is a credential-strength control, not a compromise response tool. It prevents unauthenticated attacks but has no effect when an attacker possesses valid credentials.'},
                    {"actionText": 'Install a third-party RDP rate-limiting tool to slow brute force attempts', "isCorrect": False, "consequence": 'Rate limiting irrelevant — attacker is not brute-forcing. They have valid credentials. RDP access continues.', "nextStageId": None, "technicalExplanation": 'Rate limiting controls target credential guessing attacks. An attacker with legitimately acquired credentials (via phishing, credential stuffing, or credential theft) bypasses rate limiting entirely.'},
                    {"actionText": "Add the attacker's source IP to the RDP firewall allowlist exception with enhanced logging", "isCorrect": False, "consequence": 'Logging the attacker rather than blocking them. They continue lateral movement with full logging — evidence collected but damage ongoing.', "nextStageId": None, "technicalExplanation": 'Passive monitoring of an active intrusion requires explicit approval and risk acceptance. An attacker performing lateral movement via RDP with valid credentials will achieve significant persistence and data access during any observation window. Containment must take priority.'}]
            }
        ],
        "lessonsLearned": [
            "LockBit GPO auto-spread: GPO payload removal is the highest-priority action when auto-reboot is imminent — not patient zero isolation",
            "Remove malicious scripts FROM Default Domain Policy; never DELETE the Default Domain Policy GPO itself — deletion breaks domain authentication",
            "Internet-exposed RDP TCP/3389 is the most common LockBit initial access vector — remove and replace with VPN + MFA",
            "Shared local admin passwords enable pass-the-hash across the entire estate — LAPS eliminates this at zero cost",
            "RDP brute-force detection: >5 failed attempts from same source IP in 5 minutes = SIEM alert + automated firewall block"
        ],
        "referenceLinks": ["https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-165a", "https://attack.mitre.org/techniques/T1484/001/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 10 — Conti-class ProxyShell
SCENARIOS.append({
    "name": "Operation: Exchange Breach",
    "description": "An unpatched Exchange server was exploited via ProxyShell. A web shell deployed, Cobalt Strike beaconed for 47 minutes, rclone exfiltrated 2.3GB to Mega.nz, and Conti ransomware is being staged. The Exchange service account is a Domain Admin.",
    "initial_prompt": "EDR fires on your Exchange server: 'w3wp.exe spawned cmd.exe then PowerShell 47 minutes ago.' TI confirms this is the ProxyShell exploit chain (the ProxyShell RCE vulnerability). Web shell active at /aspnet_client/system_web/x.aspx. Cobalt Strike beaconing 47 minutes. rclone ran this morning and transferred 2.3GB to api.mega.nz. Exchange service account 'svc_exchange' is a Domain Admin. Conti deployment appears imminent.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "Conti-class (ProxyShell Exchange RCE → web shell → Cobalt Strike C2 → rclone exfiltration to Mega.nz → Conti deployment via PsExec)",
        "irPhase": "Detection & Analysis → Containment (47 minutes of active access, pre-ransomware)",
        "attackVector": "ProxyShell (CVE-2021-34473/34523/31207) — unauthenticated RCE via Exchange URL normalization bypass. ASPX web shell uploaded. Cobalt Strike deployed. rclone to Mega.nz. svc_exchange DA allows full AD access.",
        "keyTTPs": ["T1190 — Exploit Public-Facing Application (ProxyShell)", "T1505.003 — Web Shell", "T1071.001 — HTTPS C2 (Cobalt Strike)", "T1048 — Exfiltration rclone → Mega.nz", "T1003.003 — NTDS Credential Dumping", "T1486 — Data Encrypted for Impact (imminent)"],
        "simulationContext": "Financial services firm. On-premises Exchange server, unpatched for ProxyShell. svc_exchange is a Domain Admin (long-standing misconfiguration). EDR deployed on Exchange. 400 users rely on Exchange. 47 minutes of Cobalt Strike with DA credentials enables full AD compromise.",
        "decisionTree": [
            {
                "stageId": "s1_surgical_vs_offline",
                "irPhase": "Containment",
                "prompt": "Web shell confirmed. Cobalt Strike in w3wp.exe for 47 minutes. rclone exfiltrated 2.3GB this morning. Ransomware deployment imminent. Exchange serves 400 users. Do you take Exchange completely offline or apply surgical remediation (WAF block + web shell deletion + patch)?",
                "analystContext": "Option A: Take Exchange offline (stop IIS) — maximum containment, zero email for 400 users until patched and verified. Option B: Block /aspnet_client/ at WAF (immediate), delete x.aspx web shell, apply ProxyShell patch, restart IIS — brief interruption but service continues. Both options require credential rotation.",
                "options": [
                    {"actionText": "Surgical remediation: block /aspnet_client/ at WAF immediately (closes re-exploitation), delete x.aspx web shell, apply ProxyShell patch, restart IIS — then conduct full forensic scope assessment", "isCorrect": True, "consequence": "Web shell removed. ProxyShell patched. WAF blocks the attack path. Exchange continues serving email. Forensic analysis confirms 47-minute attack timeline. Ransomware not deployed — intervention timely.", "nextStageId": "s2_credential_rotation", "technicalExplanation": "Surgical remediation on critical business services is appropriate when: (1) you can close the initial access vector immediately (WAF virtual patch + ProxyShell patch), (2) you can remove the persistence mechanism (web shell deletion). Taking Exchange offline for extended periods when surgical options exist causes unnecessary business disruption."},
                    {"actionText": "Monitor the web shell and Cobalt Strike beacon to gather more intelligence on attacker intentions before acting", "isCorrect": False, "consequence": "Over 3 hours the attacker uses Cobalt Strike to harvest all AD credentials, exfiltrates 50GB additional data, and stages Conti for weekend deployment when staffing is minimal.", "nextStageId": "s2_credential_rotation", "technicalExplanation": "Passive monitoring of an active Cobalt Strike operator with DA access is surrendering your environment. Every minute of monitoring is additional credential harvesting and exfiltration. Immediate surgical remediation closes the threat without extended downtime."}
                ,
                    {"actionText": 'Force a password reset for all ~200 mailboxes as an emergency measure', "isCorrect": False, "consequence": "Mass password reset disrupts business operations for 4 hours. Attacker had OAuth delegated access — resets don't revoke it.", "nextStageId": 's2_credential_rotation', "technicalExplanation": 'Mass password resets cause significant operational disruption and do not address OAuth-based access. A surgical, targeted approach — resetting only confirmed compromised accounts and revoking OAuth tokens — is more effective with less business impact.'},
                    {"actionText": 'Take Exchange offline completely while forensics are conducted', "isCorrect": False, "consequence": 'Email unavailable for 6 hours. Critical business communications blocked. Scope of compromise still unknown.', "nextStageId": 's2_credential_rotation', "technicalExplanation": 'Taking Exchange offline is a high-impact action that stops legitimate business use. Targeted account suspension and forwarding rule audits achieve containment without full service outage.'}]
            },
            {
                "stageId": "s2_credential_rotation",
                "irPhase": "Eradication",
                "prompt": "Exchange patched, web shell removed. svc_exchange (Domain Admin) was Mimikatz-dumped during the 47-minute window. Attacker accessed DC01 via WMI once, 31 minutes ago, running only AD reconnaissance commands. No persistence found on DCs. How do you handle the svc_exchange DA privilege issue?",
                "analystContext": "svc_exchange has been a DA for 4 years 'because Exchange setup required it.' It actually only needs specific Exchange permissions, not DA. Removing DA requires Exchange permission audit. krbtgt not rotated.",
                "options": [
                    {"actionText": "Remove Domain Admin from svc_exchange, assign only minimum Exchange-required permissions, rotate krbtgt twice (invalidate all Kerberos tickets), and audit all service accounts for unnecessary DA membership", "isCorrect": True, "consequence": "svc_exchange reduced to least-privilege. All attacker Kerberos tickets invalidated. Service account audit finds 4 others with unnecessary DA — all reduced. Future Exchange web shell gives only Exchange-level access, not DA.", "nextStageId": None, "technicalExplanation": "The Conti/ProxyShell pattern exploits Exchange = Domain Admin misconfiguration. Web shell gives IIS/SYSTEM level. Escalation to DA occurs only because svc_exchange has DA rights. Microsoft Exchange needs Exchange Organization Admin roles — not Domain Admin. This single misconfiguration transformed a web app compromise into full domain compromise. Principle of Least Privilege is the architectural fix."}
                ,
                    {"actionText": 'Enable conditional access policies and consider the incident closed', "isCorrect": False, "consequence": 'Conditional access enabled but existing OAuth grants remain valid. Mail forwarding rules still active. Data still leaking.', "nextStageId": None, "technicalExplanation": 'Conditional access policies govern future authentication but do not revoke existing OAuth tokens or mail transport rules established before the policy was applied. Post-compromise response must include explicit OAuth token revocation and mail rule auditing.'},
                    {"actionText": 'Run Microsoft Secure Score recommendations and implement all high-priority items', "isCorrect": False, "consequence": 'Secure Score improvements are valuable but take days. During implementation, mail forwarding rules continue exfiltrating data.', "nextStageId": None, "technicalExplanation": 'Security posture improvement programs are strategic — they operate on a days-to-weeks timeline. An active breach requires tactical, immediate actions (revoke tokens, remove forwarding rules) that cannot wait for a scored recommendation program to complete.'},
                    {"actionText": 'Enable multi-factor authentication on the compromised mailboxes and monitor for re-access', "isCorrect": False, "consequence": "MFA enabled on interactive sign-in but existing OAuth app grants remain valid. Attacker's mail forwarding rules continue exfiltrating data via delegated access that bypasses MFA.", "nextStageId": None, "technicalExplanation": 'MFA protects new interactive authentication but does not revoke existing OAuth tokens or app permission grants. Post-Exchange compromise response must include explicit OAuth token revocation, mail rule audits, and delegation reviews — MFA alone is insufficient.'}]
            }
        ],
        "lessonsLearned": [
            "w3wp.exe spawning cmd.exe/PowerShell is a definitive P1 indicator of Exchange exploitation — automate alerting for this pattern",
            "Exchange service accounts should never be Domain Admins — they need Exchange-specific roles only",
            "rclone transfers to cloud storage from server-class machines are always anomalous — DLP/proxy should alert on rclone process and block mega.nz uploads",
            "WAF virtual patching should be the FIRST action — provides immediate protection while preserving the system state for forensics",
            "47 minutes of Cobalt Strike with DA = mandatory krbtgt double-rotation after any DA compromise",
            "Audit all service account DA memberships quarterly against actual permission requirements"
        ],
        "referenceLinks": ["https://media.defense.gov/2021/Sep/22/2002859507/-1/-1/0/CSA_CONTI_RANSOMWARE_20210922.PDF", "https://attack.mitre.org/techniques/T1505/003/", "https://www.cisa.gov/stopransomware/ransomware-guide"]
    }
})

# 11 — GandCrab/REvil-class
SCENARIOS.append({
    "name": "Operation: Cracked Software",
    "description": "An employee downloads pirated software containing a GandCrab-class ransomware payload. The analyst triages the infection, identifies the variant via NoMoreRansom.org, and recovers without paying ransom or losing data.",
    "initial_prompt": "09:32 — helpdesk: 'A Marketing employee downloaded what they thought was a free video editing tool from a third-party site. Now all their files show a .KRAB extension and there is a ransom note. The machine is still running.' You recognise .KRAB as GandCrab v5. Single workstation. No lateral movement detected.",
    "difficulty_level": "easy",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "GandCrab/REvil-class (RaaS, malicious download delivery, .KRAB extension — free decryptors available for multiple versions via NoMoreRansom.org)",
        "irPhase": "Detection & Analysis → Recovery",
        "attackVector": "Malicious download — pirated software installer (VideoEditorPro_crack.exe) from a warez site. Installer drops GandCrab DLL, injects into explorer.exe, encrypts local files, drops ransom note KRAB-DECRYPT.txt.",
        "keyTTPs": ["T1204.002 — User Execution: Malicious File", "T1059.003 — Windows Command Shell", "T1055.001 — Process Injection: DLL Injection", "T1486 — Data Encrypted for Impact", "T1490 — Inhibit System Recovery"],
        "simulationContext": "Marketing agency, 60 employees. Signature AV only — no EDR. Users have local admin rights. WS-MKT-09 infected. Files locally stored — no mapped drives affected. GandCrab v5.0.4 confirmed by extension and ransom note format. NoMoreRansom.org carries a free decryptor for this exact variant.",
        "decisionTree": [
            {
                "stageId": "s1_variant_check",
                "irPhase": "Detection & Analysis",
                "prompt": "Single workstation infected. .KRAB extension confirms GandCrab v5. Encryption appears complete. Before deciding on recovery path, what do you do first?",
                "analystContext": "NoMoreRansom.org (Europol + Dutch Police + security vendors) has free decryptors for GandCrab v1, v4, v5.0–v5.2. Submitting the ransom note and one small encrypted file to id-ransomware.malwarehunterteam.com confirms the exact variant. Last backup: yesterday at 17:00 (16-hour gap).",
                "options": [
                    {"actionText": "Isolate the machine, then upload the ransom note and a small encrypted sample to NoMoreRansom.org to confirm variant and check for a free decryptor — BEFORE considering backup restoration", "isCorrect": True, "consequence": "NoMoreRansom confirms GandCrab v5.0.4 — free decryptor available. You can recover ALL files with zero data loss and zero ransom payment.", "nextStageId": "s2_decryption_sequence", "technicalExplanation": "NoMoreRansom.org has free decryptors for hundreds of ransomware variants. GandCrab v5.0.4 is covered. Checking before restoring from backup avoids the 16-hour data loss RPO gap. Decision priority: (1) NoMoreRansom check → (2) vendor EDR decryptor → (3) backup restore → (4) pay (last resort). This 5-minute check can prevent all data loss."},
                    {"actionText": "Restore from yesterday's backup immediately — it's proven and reliable", "isCorrect": False, "consequence": "Backup restores successfully. 16 hours of Marketing work lost. The free GandCrab v5.0.4 decryptor would have recovered everything with zero data loss in 20 minutes.", "nextStageId": "s2_decryption_sequence", "technicalExplanation": "Backup restoration is valid but should never be the first option when a free decryptor may exist. You can still restore from backup if no decryptor exists — but you cannot un-overwrite encrypted files you already replaced. Always check NoMoreRansom.org first."},
                    {"actionText": "Pay the ransom — it's cheaper than the productivity loss", "isCorrect": False, "consequence": "Ransom paid. Decryptor received, files recovered. But a free official decryptor was available from Europol — you funded criminal infrastructure for zero reason.", "nextStageId": "s2_decryption_sequence", "technicalExplanation": "Paying ransom when a free official decryptor exists is unnecessary, funds criminals, and in some cases may violate OFAC sanctions regulations. Always check NoMoreRansom.org before any payment decision."}
                ,
                    {"actionText": 'Reimage the machine and restore from backup without collecting any forensic artifacts', "isCorrect": False, "consequence": 'No artifacts collected. Scope of compromise unknown. Same cracked software installed by another user the following week.', "nextStageId": 's2_decryption_sequence', "technicalExplanation": 'Reimaging without forensics eliminates evidence needed to determine full scope (what data was accessed, whether the malware phoned home, whether other machines were affected). Collect memory and disk images before any remediation.'},
                    {"actionText": 'Quarantine only the specific cracked application files and continue operations', "isCorrect": False, "consequence": 'Ransomware payload had already dropped a persistence mechanism in a separate directory. Quarantine missed it. Encryption triggers 12 hours later.', "nextStageId": 's2_decryption_sequence', "technicalExplanation": 'Quarantining only the known-malicious file assumes the payload has not already executed and established persistence. If the cracked software has been installed for any length of time, assume execution has occurred and treat the full machine as compromised.'}]
            },
            {
                "stageId": "s2_decryption_sequence",
                "irPhase": "Eradication & Recovery",
                "prompt": "Free decryptor confirmed for GandCrab v5.0.4. Before running it, what must you do to ensure the malware cannot immediately re-encrypt the decrypted files?",
                "analystContext": "GandCrab injected into explorer.exe. Windows Defender removed the dropper but the injection may still be active. If ransomware is still running when the decryptor runs, it may re-encrypt the output.",
                "options": [
                    {"actionText": "Reimage the workstation OS from a clean baseline, restore the encrypted files to the clean machine, THEN run the official decryptor on the clean OS", "isCorrect": True, "consequence": "Clean OS. Encrypted files restored. Decryptor runs on the verified clean system. All files decrypted. Zero data loss. Zero ransom paid.", "nextStageId": "s3_post_incident", "technicalExplanation": "Correct decryption sequence: (1) Preserve encrypted files to clean storage. (2) Reimage the infected OS — eliminates any residual process or persistence mechanism. (3) Run the decryptor on the clean machine against preserved encrypted files. Running a decryptor on an active infection risks immediate re-encryption."},
                    {"actionText": "Run the decryptor directly on the infected machine after killing explorer.exe", "isCorrect": False, "consequence": "Explorer.exe killed. Decryptor starts running. Seconds later the GandCrab injected shellcode re-spawns in a new svchost.exe and begins re-encrypting the decrypted files.", "nextStageId": "s3_post_incident", "technicalExplanation": "GandCrab persistence mechanisms survive process kills. The only guaranteed clean execution environment is a reimaged OS. Never run decryptors on active infections."}
                ,
                    {"actionText": 'Attempt to recover files using Windows Shadow Copy before trying any decryptor', "isCorrect": False, "consequence": 'Ransomware deleted shadow copies as its first action. VSS recovery not possible.', "nextStageId": 's3_post_incident', "technicalExplanation": 'vssadmin.exe and wbadmin.exe are called by almost all modern ransomware as the first step before encryption begins. Shadow copy availability should not be assumed after a ransomware event — check for deletion before attempting recovery.'},
                    {"actionText": 'Pay for a commercial data recovery service to attempt file reconstruction', "isCorrect": False, "consequence": 'Commercial recovery service cannot decrypt AES-256 without the key. $8,000 spent on an unsuccessful recovery attempt.', "nextStageId": 's3_post_incident', "technicalExplanation": 'Modern ransomware uses cryptographically secure encryption (AES-256 + RSA-2048). Without the decryption key, commercial data recovery services cannot reconstruct encrypted files. Decryptors only work for specific families where key material has been publicly released.'}]
            },
            {
                "stageId": "s3_post_incident",
                "irPhase": "Post-Incident Activity",
                "prompt": "Recovery complete. Zero data loss, zero ransom paid. Root cause: employee executed a pirated software installer. CISO asks for the technical control that prevents this class of attack entirely.",
                "analystContext": "Current state: users have local admin rights, no software restriction policy, no AppLocker/WDAC, no DLP. The cracked installer ran from the Downloads folder.",
                "options": [
                    {"actionText": "Remove local admin rights from standard users + deploy AppLocker/WDAC to block execution from user-writable directories (Downloads, AppData, Temp) + enforce software procurement policy", "isCorrect": True, "consequence": "GandCrab dropped to AppData — AppLocker rule blocking execution from AppData/Downloads would have stopped this infection before a single file was encrypted.", "nextStageId": None, "technicalExplanation": "Standard user accounts without local admin rights prevent system-level installs. But ransomware can execute from user-writable locations (Downloads, AppData, Temp) without admin rights. AppLocker/WDAC execution policies block this: executables in user-writable directories are denied unless explicitly allowlisted. This is Microsoft's recommended defense against malicious download execution."}
                ,
                    {"actionText": 'Implement an acceptable use policy and send it to all staff', "isCorrect": False, "consequence": 'Policy sent but no technical control enforces it. Same cracked software downloaded by a different employee 6 weeks later.', "nextStageId": None, "technicalExplanation": 'Acceptable use policies are an administrative control — they create legal accountability but do not prevent the behavior. Technical controls (application whitelisting, download filtering, endpoint privilege restrictions) are required to make the policy effective.'},
                    {"actionText": 'Block the specific torrent site used to download the cracked software', "isCorrect": False, "consequence": 'User switches to one of 200 other torrent sites. Same behavior continues unimpeded.', "nextStageId": None, "technicalExplanation": 'Single-site blocking is trivially bypassed — there are hundreds of equivalent torrent sites. Category-based web filtering (block all torrent/P2P categories) combined with endpoint controls is the effective technical countermeasure.'},
                    {"actionText": 'Implement application whitelisting on all endpoints to prevent future cracked software installation', "isCorrect": False, "consequence": 'Whitelisting deployed without a software inventory baseline. Legitimate applications begin breaking. IT overwhelmed with exceptions. Policy rolled back within 2 weeks.', "nextStageId": None, "technicalExplanation": 'Application whitelisting is an effective control but requires extensive baselining of all legitimate software before deployment. Deploying whitelisting reactively without an approved software inventory produces massive operational disruption and is typically reversed, leaving the environment unprotected.'}]
            }
        ],
        "lessonsLearned": [
            "Always check NoMoreRansom.org BEFORE restoring from backup — free decryptors exist for hundreds of variants including multiple GandCrab versions",
            "Run decryptors only on clean reimaged OS — never on the active infection",
            "AppLocker/WDAC blocking execution from user-writable directories (AppData, Downloads, Temp) stops drive-by and download-based ransomware",
            "Local admin rights on standard workstations enable malicious installer execution — remove and use endpoint management for software deployment",
            "Pirated software sites are a primary GandCrab/REvil delivery vector — software procurement policy is the business control"
        ],
        "referenceLinks": ["https://www.nomoreransom.org/", "https://attack.mitre.org/techniques/T1204/002/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 12 — Preparation phase
SCENARIOS.append({
    "name": "Operation: Ready State",
    "description": "No active incident — but an IR readiness audit reveals critical gaps across detection, backup, and response capability. The analyst must prioritise a limited budget to build the highest-impact defences before an attack occurs.",
    "initial_prompt": "You are the newly appointed IR Lead at a logistics company. First task: a ransomware readiness assessment. Review identifies — signature AV only, backups to an online NAS on the same network, no SIEM, no MFA on any system, flat /16 network, no documented IR playbook. The CISO gives you $150,000 and 90 days. Where do you invest first?",
    "difficulty_level": "medium",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "Prevention-focused (Preparation phase — NIST SP 800-61r2 Phase 1)",
        "irPhase": "Preparation",
        "attackVector": "N/A — this scenario focuses exclusively on building controls before an attack occurs",
        "keyTTPs": ["NIST SP 800-61r2 — Phase 1: Preparation", "CIS Control 11 — Data Recovery Capabilities", "CIS Control 13 — Network Monitoring and Defense", "CIS Control 17 — Incident Response Management"],
        "simulationContext": "Logistics company, 400 employees, 350 endpoints, 20 servers. Signature AV only (no EDR), NAS backups on the production network, no SIEM, no MFA, flat /16 subnet, RDP exposed for 12 remote employees, no documented IR playbook. Budget: $150,000. Timeframe: 90 days.",
        "decisionTree": [
            {
                "stageId": "s1_budget_priority",
                "irPhase": "Preparation",
                    "prompt": "Your security budget has been approved for ransomware risk reduction. Rank the following controls by priority: EDR with behavioral detection, immutable offsite backups, MFA for all remote access, SIEM deployment, security awareness training, network micro-segmentation. Which three deliver the highest combined risk reduction?",
                "analystContext": "Risk factors: (1) Online NAS = ransomware can encrypt backups. (2) No MFA = credential theft = full access via VPN/RDP. (3) No EDR = no behavioral detection. (4) Flat network = any infection spreads everywhere.",
                "options": [
                    {"actionText": "Priority: (1) Immutable offsite backups — guarantees recovery regardless of attack outcome. (2) MFA for all remote access — blocks credential-based initial access entirely. (3) EDR with behavioral detection — catches ransomware precursor activity before encryption begins.", "isCorrect": True, "consequence": "All three controls address the three primary ransomware risk factors: immutable backups guarantee recovery, MFA eliminates credential-based initial access, EDR detects precursor behavior. This combination provides coverage across recovery, prevention, and detection.", "nextStageId": "s2_backup_arch", "technicalExplanation": "Priority rationale: (1) Immutable backups are the only control that guarantees recovery regardless of whether prevention fails. (2) MFA is the highest-ROI prevention control — it blocks VPN/RDP credential reuse entirely. (3) EDR behavioral detection catches T1490 (VSS deletion), T1055 (process injection), and T1059 (PowerShell abuse) in real time, enabling pre-encryption containment."},
                    {"actionText": "Deploy a SIEM first — visibility is the foundation of everything else before investing in other controls", "isCorrect": False, "consequence": "SIEM deployed but generates alerts that EDR cannot enrich. Online NAS backups remain vulnerable. Next ransomware attack encrypts both production data AND the backup NAS. You can watch the attack happen but have no recovery path.", "nextStageId": "s2_backup_arch", "technicalExplanation": "A SIEM without endpoint telemetry has poor signal quality. More critically, a SIEM provides zero recovery capability. Order of operations for ransomware readiness: (1) Guarantee recovery (immutable backups), (2) Reduce initial access (MFA), (3) Improve detection (EDR → SIEM)."}
                ,
                    {"actionText": 'Invest the entire budget in endpoint detection tools — they catch everything', "isCorrect": False, "consequence": 'No backup infrastructure purchased. Ransomware hits 8 months later. No clean restore point exists. Operational for 3 weeks.', "nextStageId": 's2_backup_arch', "technicalExplanation": 'A layered defense requires investment across all NIST framework functions (Identify, Protect, Detect, Respond, Recover). Over-investing in detection at the expense of recovery capability creates a single point of failure when prevention fails.'},
                    {"actionText": 'Defer all security investments to next fiscal year — no incidents have occurred recently', "isCorrect": False, "consequence": 'Ransomware attack 4 months later. No detection capability, no offline backups, no playbooks. Recovery takes 6 weeks and costs 40x the deferred budget.', "nextStageId": 's2_backup_arch', "technicalExplanation": "Security investment decisions based on recent incident history (the 'nothing has happened yet' fallacy) ignore the threat landscape. The cost of a single unmitigated ransomware event typically exceeds years of prevention investment."}]
            },
            {
                "stageId": "s2_backup_arch",
                "irPhase": "Preparation",
                "prompt": "Budget approved. IT proposes keeping the existing online NAS and adding AWS S3 as a secondary backup. Your security architect recommends S3 with Object Lock enabled. What architecture satisfies the 3-2-1-1-0 rule?",
                "analystContext": "AWS S3 Object Lock (WORM): prevents deletion or modification for a defined retention period — even by the bucket owner. The existing NAS is reachable by any domain user with backup permissions. 3-2-1-1-0 rule: 3 copies, 2 media types, 1 offsite, 1 immutable, 0 errors (verified by test restore).",
                "options": [
                    {"actionText": "Keep NAS for fast operational recovery (hardware failures, accidental deletions) + add S3 with Object Lock as the immutable offsite copy + implement quarterly test restores from both sources", "isCorrect": True, "consequence": "3-2-1-1-0 satisfied. NAS handles fast recovery for non-ransomware incidents. S3 Object Lock handles ransomware scenarios where NAS may be encrypted. Quarterly test restores confirm zero errors.", "nextStageId": None, "technicalExplanation": "3-2-1-1-0: 3 copies (production + NAS + S3), 2 media types (disk + cloud), 1 offsite (S3), 1 immutable (S3 Object Lock), 0 errors (quarterly test restore verified). S3 Object Lock WORM prevents deletion even with full AWS credentials — a compromised backup admin cannot delete Object Lock objects during the retention period."}
                ,
                    {"actionText": 'Implement cloud-synced backups so data is always current and accessible', "isCorrect": False, "consequence": 'Cloud sync immediately replicates encrypted files to the backup. Both source and backup are encrypted simultaneously.', "nextStageId": None, "technicalExplanation": 'Continuous cloud sync (OneDrive, Dropbox, Google Drive) is not a backup — it is a sync. Ransomware encryption propagates to the sync destination within seconds. A true backup requires immutability (write-once) and air-gapping or versioning that prevents overwrite by malware.'},
                    {"actionText": 'Back up only critical servers — workstations can be reimaged from a golden image', "isCorrect": False, "consequence": 'Local user data on 40 workstations is permanently lost. Users had saved work locally despite policy. Significant productivity impact.', "nextStageId": None, "technicalExplanation": 'Despite policies, users frequently save work locally. A backup strategy that excludes workstations assumes perfect user compliance — an unreliable assumption. Backup scope should be determined by data classification analysis, not by device type assumptions.'},
                    {"actionText": 'Configure RAID across primary storage — data redundancy prevents ransomware loss', "isCorrect": False, "consequence": 'RAID protects against disk failure, not ransomware. All RAID members encrypt simultaneously. No clean restore point exists.', "nextStageId": None, "technicalExplanation": 'RAID is a hardware redundancy technology designed to survive disk failures. It provides no protection against ransomware — all RAID members are encrypted simultaneously as they share the same filesystem. RAID is not a backup.'}]
            }
        ],
        "lessonsLearned": [
            "Immutable backups (S3 Object Lock, WORM tape) are the single highest-priority ransomware readiness investment",
            "Online NAS backups on the production network are vulnerable to encryption — immutability or physical separation is required",
            "3-2-1-1-0 backup rule: 3 copies, 2 media types, 1 offsite, 1 immutable, 0 errors verified by test restore",
            "MFA on all remote access eliminates the largest category of ransomware initial access vectors",
            "IR playbooks must be action-oriented checklists starting with isolation — not documents to read during an incident"
        ],
        "referenceLinks": ["https://www.nist.gov/publications/computer-security-incident-handling-guide", "https://www.cisa.gov/stopransomware/ransomware-guide", "https://www.cisecurity.org/controls/"]
    }
})

# 13 — REvil-class MSP supply chain (RMM tool zero-day)
SCENARIOS.append({
    "name": "Operation: MSP Cascade",
    "description": "A zero-day in the MSP's RMM platform is actively exploited. The vendor issues an emergency shutdown advisory. Every minute of delay risks ransomware deployment across all 85 managed client networks simultaneously.",
    "initial_prompt": "You are the security analyst at an MSP serving 85 small business clients. Saturday 14:00 — your RMM vendor sends an emergency alert: 'Critical zero-day in VSA server actively exploited in the wild. Shut down your VSA server immediately.' Your VSA server manages 3,200 endpoints across 85 clients. Shutting down means losing remote management for 24–48 hours.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "REvil/Sodinokibi-class (MSP supply chain via VSA RMM zero-day → malicious monitoring task pushed to all managed client endpoints simultaneously)",
        "irPhase": "Preparation → Emergency Response",
        "attackVector": "Zero-day SQL injection + authentication bypass in internet-facing VSA RMM server. Attacker gains VSA admin panel, creates a monitoring task that deploys ransomware PowerShell script with SYSTEM privileges to ALL managed endpoints simultaneously. Timed for holiday weekend.",
        "keyTTPs": ["T1195.002 — Supply Chain Compromise: Software Supply Chain", "T1059.001 — PowerShell (ransomware delivery via VSA task)", "T1486 — Data Encrypted for Impact", "T1190 — Exploit Public-Facing Application (VSA zero-day)"],
        "simulationContext": "MSP managing 85 small business clients, 3,200 total endpoints. VSA server is internet-facing. Saturday holiday weekend — minimal staffing. Vendor alert arrived 12 minutes ago. VSA is the sole remote management platform for all clients. Mass client encryption would be commercially fatal for the MSP.",
        "decisionTree": [
            {
                "stageId": "s1_shutdown_decision",
                "irPhase": "Emergency Response",
                "prompt": "Vendor confirms active exploitation in the wild. Every minute VSA stays online, a zero-day remains exploitable and a malicious task could be pushed to 3,200 client endpoints. Every minute offline, you cannot remotely support 85 clients. Your SLA is 4-hour response time. Do you shut down VSA immediately?",
                "analystContext": "VSA shutdown: 1 click, immediate, loses remote management 24–48 hours. Investigating first: 15–20 minutes minimum. Risk: (3,200 encrypted endpoints × catastrophic client impact × HIGH probability) vs. (85 clients × 24–48h remote management loss × SLA penalty).",
                "options": [
                    {"actionText": "Shut down VSA immediately — vendor confirms active exploitation. 24–48 hours without remote management is recoverable; mass client ransomware is not.", "isCorrect": True, "consequence": "VSA offline. Clients lose remote monitoring. 12 clients already show partial encryption (infected before shutdown). 73 clients are clean and protected. Recovery begins with the 12 affected clients.", "nextStageId": "s2_client_notification", "technicalExplanation": "Risk calculus: (probability of attack in next 20 minutes with confirmed active exploitation) × (cost of 3,200 endpoint mass encryption across 85 clients) > (certainty of SLA impact) × (cost of 24–48h without remote management). With a vendor-confirmed active exploitation zero-day, probability is extremely high. Vendor emergency advisories must be followed immediately."},
                    {"actionText": "Investigate the VSA logs first to confirm if your specific instance has been compromised — 10–15 minute investigation", "isCorrect": False, "consequence": "During your 15-minute investigation, the attacker uses the zero-day to create a VSA admin account and push a malicious monitoring task to all 3,200 client endpoints. Mass encryption begins across all 85 clients.", "nextStageId": "s2_client_notification", "technicalExplanation": "Zero-day exploitation in an internet-facing management platform can occur in seconds. 15 minutes of log investigation while the zero-day is exploitable is trading a guaranteed SLA impact for a catastrophic client-wide ransomware event. Vendor emergency shutdown advisories are issued because the threat is imminent and active — follow them immediately."}
                ,
                    {"actionText": 'Notify all clients via the MSP platform before taking any containment action', "isCorrect": False, "consequence": 'Notification sent via the compromised RMM platform. Attacker sees the alert and accelerates deployment to 6 more clients.', "nextStageId": 's2_client_notification', "technicalExplanation": 'Using a compromised platform to send notifications is counterproductive — the attacker has full visibility. Out-of-band communication (phone, separate email system) is required when the primary platform is compromised.'},
                    {"actionText": 'Patch the MSP RMM vulnerability and restart the service — the risk is now mitigated', "isCorrect": False, "consequence": 'Patch applied to RMM but ransomware already deployed to 4 client environments via prior access. Patching after initial access does not undo the damage.', "nextStageId": 's2_client_notification', "technicalExplanation": 'Patching an entry vector after initial access prevents future exploitation but does not address persistence already established. A forensic sweep of all client environments touched during the compromised period is mandatory.'}]
            },
            {
                "stageId": "s2_client_notification",
                "irPhase": "Containment",
                "prompt": "VSA offline. 12 clients showing ransomware activity. 73 clients appear clean. The malicious task may have been queued to all 73 'clean' client VSA agents BEFORE you shut down — agents may execute the task from local cache at a scheduled time. Do you notify only the 12 affected clients, or all 85?",
                "analystContext": "VSA agents can cache and execute monitoring tasks locally even after the server goes offline. The malicious task may be queued on all 85 agents. Without VSA connectivity, you cannot check agent task queues remotely.",
                "options": [
                    {"actionText": "Contact all 85 clients immediately — advise all 73 'clean' clients to check locally for queued PowerShell tasks matching the attack signature and disable their VSA agent service if found", "isCorrect": True, "consequence": "All 85 clients contacted. 8 of the 73 'clean' clients find queued malicious tasks in their local VSA agent cache — tasks removed before execution. Total affected: 12 (not 20). Proactive communication preserves client trust.", "nextStageId": None, "technicalExplanation": "VSA-class supply chain attacks commonly stage malicious tasks across all agents before the server is shut down. Agents can execute from local cache. Treating all 85 clients as potentially affected limits further damage and preserves trust. This is proactive incident handling — don't wait for additional clients to discover their own infection."}
                ,
                    {"actionText": 'Notify clients only after internal legal review — liability exposure requires caution', "isCorrect": False, "consequence": 'Legal review takes 4 hours. Two more clients fully encrypted during the delay. Regulatory deadline missed in 3 jurisdictions.', "nextStageId": None, "technicalExplanation": 'Regulatory frameworks (GDPR 72h, CCPA, etc.) mandate notification timelines that do not accommodate extended legal review before client notification. Legal counsel should be engaged in parallel with notification, not as a prerequisite.'},
                    {"actionText": "Send a generic 'we are investigating an issue' email without specifics to avoid panic", "isCorrect": False, "consequence": 'Vague notification does not give clients enough information to implement their own containment. 3 clients delay their incident response waiting for specific guidance.', "nextStageId": None, "technicalExplanation": 'Effective breach notification must include actionable information: what was compromised, what clients should do immediately, and what the MSP is doing to contain the breach. Vague notifications delay client response and increase total damage.'},
                    {"actionText": 'Post a public security advisory on the MSP website before directly contacting affected clients', "isCorrect": False, "consequence": 'Public disclosure before direct client notification reaches clients via media reports. Clients learn of their compromise from journalists, not their MSP. Irreparable trust damage.', "nextStageId": None, "technicalExplanation": 'Affected clients must be notified directly and privately before any public disclosure. Public advisories before direct notification violate incident response best practices and may breach contractual notification obligations.'}]
            }
        ],
        "lessonsLearned": [
            "Vendor emergency shutdown advisories for internet-facing management platforms must be followed immediately — do not delay for log investigation",
            "MSP supply chain attacks affect all managed clients through a single compromise — VSA instance segmentation by client tier limits blast radius",
            "VSA agent tasks may be queued and execute from local cache after server shutdown — treat all managed clients as potentially affected",
            "MSPs must ensure all managed clients have immutable backups as a service baseline",
            "Anomaly detection on RMM admin actions (bulk task creation to all agents) is a critical detective control for supply chain attacks"
        ],
        "referenceLinks": ["https://www.cisa.gov/stopransomware/ransomware-guide", "https://attack.mitre.org/techniques/T1195/002/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 14 — Conti/Zerologon
SCENARIOS.append({
    "name": "Operation: Zero Privilege",
    "description": "An unmanaged device on the internal network exploited Zerologon (the MS-NRPC authentication bypass vulnerability) against an unpatched Domain Controller, achieving Domain Admin in seconds with no credentials. Conti ransomware is staged for deployment.",
    "initial_prompt": "03:22 — SIEM critical: 'Zerologon exploitation attempt detected — DC01 — the MS-NRPC authentication bypass vulnerability.' Your patching records show DC01 has not received the patch for this vulnerability. Zerologon allows an unauthenticated attacker to reset a DC's computer account password, achieving Domain Admin in approximately 3 seconds. The alert fired 4 minutes ago. If it succeeded, the attacker has been Domain Admin for 4 minutes.",
    "difficulty_level": "hard",
    "max_attempts": 2,
    "scenario_structure": {
        "ransomwareFamily": "Conti-class (Zerologon CVE-2020-1472 → instant Domain Admin → Cobalt Strike C2 → Conti deployment via PsExec + rclone exfiltration)",
        "irPhase": "Detection & Analysis → Emergency Containment",
        "attackVector": "Zerologon (CVE-2020-1472) — unauthenticated domain controller computer account password reset via MS-NRPC cryptographic vulnerability. Requires only TCP/135 access to the DC. Exploits in ~3 seconds. Attacker reaches DC from an unmanaged personal laptop plugged into a conference room network port.",
        "keyTTPs": ["T1210 — Exploitation of Remote Services (Zerologon)", "T1098 — Account Manipulation (DC computer account reset)", "T1484.001 — Domain Policy Modification", "T1021.002 — Remote Services: SMB", "T1486 — Data Encrypted for Impact (planned)"],
        "simulationContext": "Local government agency, 800 employees, 3 domain controllers (DC01, DC02, DC03). DC01 is unpatched for the MS-NRPC authentication bypass vulnerability. DC02 and DC03 are patched. Alert source: internal IP 10.10.44.201 — an unmanaged personal laptop plugged into a conference room Ethernet port (802.1X not enforced on conference room ports). Cobalt Strike, Conti binary, and rclone found on the attacking device.",
        "decisionTree": [
            {
                "stageId": "s1_confirm_exploitation",
                "irPhase": "Detection & Analysis",
                "prompt": "Alert fired 4 minutes ago. If Zerologon succeeded, the attacker has been Domain Admin for 4 minutes. How do you confirm in 60 seconds whether the exploit SUCCEEDED or was merely ATTEMPTED?",
                "analystContext": "DC01 Event Viewer accessible remotely. Key events: Event ID 4742 (Computer Account Changed) on DC01 for DC01's own account = Zerologon SUCCEEDED. Normal computer account password changes are scheduled by AD every 30 days and appear as internal changes — not from an external workstation IP.",
                "options": [
                    {"actionText": "Query DC01 Security Event Log for Event ID 4742 (Computer Account Changed) for DC01's own computer account in the last 5 minutes — this is the definitive Zerologon success indicator", "isCorrect": True, "consequence": "Event ID 4742 found — DC01's computer account was modified 4 minutes ago by source IP 10.10.44.201. Exploit confirmed successful. Attacker has been Domain Admin for 4 minutes. Emergency response initiated.", "nextStageId": "s2_emergency_containment", "technicalExplanation": "Zerologon resets the DC's own computer account password to null, then authenticates as the DC computer to gain DA access. This generates Event ID 4742 (Computer Account Changed) on the DC for its own account — anomalous because: (1) legitimate changes are scheduled by AD every 30 days and do not appear as external source changes, (2) they originate from the DC itself, not from a workstation IP. Event 4742 from external source IP = Zerologon confirmed."}
                ,
                    {"actionText": 'Restart the affected server to clear any in-memory exploitation artifacts', "isCorrect": False, "consequence": 'Restart destroys volatile memory evidence. Attacker had already established disk-based persistence — they reconnect after reboot.', "nextStageId": 's2_emergency_containment', "technicalExplanation": 'Rebooting clears RAM (destroying volatile forensic evidence) but does not remove disk-based persistence mechanisms established after successful exploitation. If exploitation is confirmed, memory acquisition must precede any restart.'},
                    {"actionText": 'Apply the CVE patch immediately before doing anything else', "isCorrect": False, "consequence": "Patch closes the vulnerability but attacker's existing session and persistence survive the patch. They are already inside.", "nextStageId": 's2_emergency_containment', "technicalExplanation": 'Patching an exploited vulnerability after the fact is analogous to changing the lock after the intruder is already inside. Containment of the existing session must happen first; patching prevents future exploitation but has no effect on the current compromise.'},
                    {"actionText": 'Place a honeypot on the network segment and see if the attacker interacts with it to confirm exploitation', "isCorrect": False, "consequence": 'Honeypot deployment takes 2 hours. During that time the attacker achieves Domain Admin via Zerologon and begins lateral movement. Confirmation comes after the damage is done.', "nextStageId": 's2_emergency_containment', "technicalExplanation": 'Honeypot-based confirmation is appropriate for stealthy, long-dwell threat hunting — not for a suspected privilege escalation exploit with a 2-minute exploitation window. When exploitation indicators are present, treat as confirmed and contain immediately.'}]
            },
            {
                "stageId": "s2_emergency_containment",
                "irPhase": "Emergency Containment",
                "prompt": "Zerologon confirmed. Attacker has DA for 4 minutes from source 10.10.44.201. Cobalt Strike, Conti binary, and rclone found on the attacking device. DC01's computer account is corrupted. You must simultaneously address the source device, the compromised DC, and the DA credential exposure — before ransomware deploys. What is your containment sequence?",
                "analystContext": "DC01 computer account is corrupted — FSMO roles should be seized to DC02 before taking DC01 offline. The attacker at 10.10.44.201 has DA credentials and may have created new accounts, golden tickets, or DCSync'd the NTDS.dit in 4 minutes. DC02 and DC03 are patched and healthy.",
                "options": [
                    {"actionText": "Three simultaneous actions: (1) Isolate 10.10.44.201 via switch port disable. (2) Seize FSMO roles to DC02, take DC01 offline. (3) Disable ALL Domain Admin accounts except a new break-glass account, audit for new accounts created in the last 5 minutes, rotate krbtgt twice.", "isCorrect": True, "consequence": "Source device isolated. DC01 offline (FSMO moved to DC02). All DA accounts disabled. New account 'svc_helpdesk2' found created 3 minutes ago — disabled. krbtgt rotated twice — all attacker Kerberos tickets invalidated. No ransomware deployed.", "nextStageId": None, "technicalExplanation": "Zerologon response requires simultaneous multi-track containment: (1) Source isolation removes attacker's physical access. (2) FSMO seizure to DC02 and DC01 offline removes the corrupted DC before it replicates. (3) DA account audit for newly created accounts (4-minute window is sufficient to create backdoor accounts). krbtgt double rotation invalidates all existing Kerberos tickets including any golden tickets generated. FSMO seizure before DC01 offline; DA audit before krbtgt rotation."}
                ,
                    {"actionText": "Enable enhanced logging on the server and monitor the attacker's activity passively", "isCorrect": False, "consequence": 'Passive monitoring gives the attacker time to escalate privileges, establish persistence, and move laterally before containment.', "nextStageId": None, "technicalExplanation": 'Passive monitoring of an active intrusion is occasionally appropriate when gathering intelligence on a long-term operation, but requires executive approval and careful risk assessment. In a Zerologon/privilege escalation scenario, the attacker can achieve Domain Admin in minutes — passive monitoring is not appropriate.'},
                    {"actionText": 'Isolate only the domain controller and allow other systems to continue operating', "isCorrect": False, "consequence": 'Attacker pivots to a member server with cached domain admin credentials and continues operating with full AD access.', "nextStageId": None, "technicalExplanation": 'DC isolation without addressing cached credentials on member servers leaves the attacker with multiple persistence paths. All systems where the compromised credentials may be cached must be included in the containment scope.'},
                    {"actionText": 'Force a KRBTGT password reset to invalidate all Kerberos tickets domain-wide', "isCorrect": False, "consequence": 'KRBTGT rotation (must be done twice, 10h apart) invalidates Kerberos but attacker has NTLM hashes and can pass-the-hash without Kerberos. Access continues.', "nextStageId": None, "technicalExplanation": 'KRBTGT rotation is a necessary step but not sufficient alone. Zerologon gives the attacker the DC machine account hash which enables NTLM-based authentication independent of Kerberos. Full remediation requires KRBTGT double-rotation AND resetting all privileged account passwords AND addressing NTLM.'}]
            }
        ],
        "lessonsLearned": [
            "Event ID 4742 for a DC's own computer account from an external source IP = definitive Zerologon exploitation indicator — create a specific SIEM rule",
            "Zerologon succeeds in 3 seconds — 4-minute containment window requires pre-built runbooks, not ad-hoc investigation",
            "Unmanaged devices on internal networks are a primary threat vector — 802.1X NAC on all switch ports prevents unauthorized device network access",
            "Domain Controllers must be in a dedicated VLAN — workstations should not be able to initiate direct TCP/135 connections to DC RPC endpoints",
            "Critical CVEs on Domain Controllers (CVSS 9.0+) require emergency patching within 72 hours — not standard monthly cycle",
            "FSMO role seizure to a healthy DC before taking a compromised DC offline maintains domain continuity"
        ],
        "referenceLinks": ["https://media.defense.gov/2021/Sep/22/2002859507/-1/-1/0/CSA_CONTI_RANSOMWARE_20210922.PDF", "https://attack.mitre.org/techniques/T1210/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# 15 — Threat Hunt (Cobalt Strike beacon 19-day dwell)
SCENARIOS.append({
    "name": "Operation: Threat Hunt",
    "description": "No active incident — but proactive threat hunting discovers a Cobalt Strike beacon that has been running silently for 19 days. The analyst must identify, scope, and eradicate the threat before ransomware is deployed.",
    "initial_prompt": "It is a quiet Tuesday. Your security manager asks you to run a 4-hour proactive threat hunt using the newly deployed EDR. Your hypothesis: 'Cobalt Strike is present on at least one host in our environment.' Where do you start?",
    "difficulty_level": "medium",
    "max_attempts": 3,
    "scenario_structure": {
        "ransomwareFamily": "Cobalt Strike C2 (ransomware precursor — active threat hunting before ransomware is deployed)",
        "irPhase": "Post-Incident Activity / Preparation (proactive threat hunting — NIST 800-61r2 recommends hunting as part of preparation)",
        "attackVector": "BazarLoader delivered via phishing link 19 days ago → Cobalt Strike Beacon injected into svchost.exe → HTTPS beaconing every ~60 seconds to Cloudflare-fronted C2 → LSASS credential dumping → lateral movement via RDP to 4 other hosts → rclone data staging for 4 hours 3 days ago (47GB exfiltrated to Mega.nz)",
        "keyTTPs": ["T1566.002 — Phishing: Spearphishing Link (initial BazarLoader delivery)", "T1055 — Process Injection (Cobalt Strike in svchost.exe)", "T1071.001 — HTTPS C2 beaconing", "T1003.001 — OS Credential Dumping: LSASS", "T1048 — Exfiltration: rclone to Mega.nz"],
        "simulationContext": "Insurance company, 300 employees. EDR recently deployed — 19 days ago (BazarLoader infection pre-dated EDR by 1 day). Cobalt Strike has been beaconing for 19 days without alerting — EDR captured the data but no automated rule fired. 5 hosts compromised (4 workstations + 1 file server). 47GB exfiltrated 3 days ago. No ransomware deployed yet.",
        "decisionTree": [
            {
                "stageId": "s1_hunt_query",
                "irPhase": "Preparation (proactive hunting)",
                "prompt": "You have 4 hours and EDR query access to all 300 endpoints. Hunting for Cobalt Strike. What is the highest-fidelity starting query?",
                "analystContext": "EDR has process telemetry for all endpoints for 19 days. Key Cobalt Strike behavioral signatures: (1) Non-browser processes making consistent outbound HTTPS connections at regular intervals (beacon jitter: ~60s ±10%), (2) svchost.exe with parent process other than services.exe, (3) Named pipes matching Cobalt Strike defaults.",
                "options": [
                    {"actionText": "Query: non-browser processes making outbound HTTPS connections at consistent intervals (45–120 second spacing with ±10% jitter) for 7+ days — this detects the Cobalt Strike beacon timing signature", "isCorrect": True, "consequence": "Query returns: svchost.exe on WS-FIN-22 making HTTPS connections to 104.21.x.x (Cloudflare IP) every 58–62 seconds for 19 days. Cobalt Strike beacon identified on one host.", "nextStageId": "s2_lateral_scope", "technicalExplanation": "Cobalt Strike's default beacon uses configurable sleep and jitter intervals. A 60-second sleep with 10% jitter produces connections every 54–66 seconds — a consistent near-regular pattern distinct from both random traffic and genuine business traffic. Querying for non-browser processes with this timing pattern against external HTTPS endpoints is one of the highest-yield Cobalt Strike detection queries. The Cloudflare IP is suspicious — legitimate services use named domains, not Cloudflare worker IPs used to mask C2."},
                    {"actionText": "Start by checking for new admin accounts created in the last 30 days — attackers create persistence accounts before deploying ransomware", "isCorrect": False, "consequence": "New account check finds nothing suspicious. 45 minutes spent on account analysis. The Cobalt Strike beacon continues operating. With 3 hours 15 minutes remaining, you switch to beaconing analysis and find it — but the full scope hunt takes the rest of your time.", "nextStageId": "s2_lateral_scope", "technicalExplanation": "New account creation is a later-stage Cobalt Strike indicator — it occurs near ransomware deployment. Beacon communication pattern is the first and most fundamental Cobalt Strike indicator. Hunting beaconing patterns gives you the most lead time to respond."}
                ,
                    {"actionText": 'Run a full AV scan across all endpoints to find the threat', "isCorrect": False, "consequence": 'AV scan completes with 0 detections. Fileless attacker not detected. Hunt terminated with false confidence.', "nextStageId": 's2_lateral_scope', "technicalExplanation": 'Proactive threat hunting targets sophisticated actors who operate below AV detection thresholds using LOLBins, memory-only execution, and legitimate admin tools. AV scanning is a reactive control that will not find what a threat hunt is looking for.'},
                    {"actionText": 'Review only the last 24 hours of firewall logs for anomalies', "isCorrect": False, "consequence": 'Threat actor has been present for 3 weeks. 24-hour window misses the initial access and all lateral movement.', "nextStageId": 's2_lateral_scope', "technicalExplanation": 'Threat hunts must be scoped to the full potential dwell time — typically 30-90 days based on threat intelligence. A 24-hour window is appropriate for incident response but not for proactive hunting designed to find persistent actors.'}]
            },
            {
                "stageId": "s2_lateral_scope",
                "irPhase": "Detection & Analysis",
                "prompt": "WS-FIN-22 confirmed with Cobalt Strike for 19 days. EDR shows: LSASS handle opens (credential dumping), RDP connections from WS-FIN-22 to 8 other hosts, rclone.exe ran for 4 hours 3 days ago transferring 47GB to Mega.nz. Is WS-FIN-22 the only compromised host?",
                "analystContext": "RDP connections from WS-FIN-22 went to 8 hosts over 19 days. The same Cobalt Strike beacon pattern query can be run against those 8 hosts. rclone logs show Mega.nz as destination — 47GB is a significant breach event.",
                "options": [
                    {"actionText": "Run the same Cobalt Strike beaconing pattern query against the 8 RDP destination hosts, then hunt for rclone execution across all 300 endpoints to find full scope", "isCorrect": True, "consequence": "Hunt finds: 4 additional hosts with Cobalt Strike beacons (same Cloudflare C2 IP). 1 file server among the 5 compromised. rclone confirmed only on WS-FIN-22. Total scope: 5 compromised hosts. 47GB breach confirmed — breach notification required.", "nextStageId": "s3_simultaneous_contain", "technicalExplanation": "19 days of attacker dwell time with RDP lateral movement means WS-FIN-22 is unlikely to be the only compromised host. Hunting the lateral movement targets (RDP destinations) for the same beacon pattern is the correct scope expansion. The rclone execution represents a confirmed data breach event — breach notification obligations apply regardless of whether ransomware deploys."}
                ,
                    {"actionText": 'Isolate all machines flagged by the hunt immediately', "isCorrect": False, "consequence": 'Mass isolation before full scoping causes business disruption and tips off the attacker who then accelerates their timeline.', "nextStageId": 's3_simultaneous_contain', "technicalExplanation": 'Premature, piecemeal containment during a hunt alerts sophisticated actors. Full scope must be established first, then a coordinated simultaneous containment action is executed across all affected systems at once to prevent attacker pivoting.'},
                    {"actionText": 'Share the hunt findings with the CISO and defer containment planning to next week', "isCorrect": False, "consequence": 'Attacker detects hunt activity (excessive EDR queries trigger their own alerting), accelerates to ransomware deployment before next week.', "nextStageId": 's3_simultaneous_contain', "technicalExplanation": 'Threat hunts that detect an active actor create a race condition. The actor may have tripwires alerting on IR activity. Containment must be planned and executed within hours of scope confirmation, not deferred to the following week.'},
                    {"actionText": 'Build a network diagram of the suspected compromised hosts and present it to the CISO before acting', "isCorrect": False, "consequence": 'CISO briefing takes 2 hours. Threat actor detects increased EDR query activity (their tripwire), deploys ransomware across 9 confirmed hosts before containment is authorized.', "nextStageId": 's3_simultaneous_contain', "technicalExplanation": 'Documentation and executive briefing are necessary but must happen in parallel with containment planning, not sequentially before it. In an active intrusion, sophisticated actors monitor for IR activity. The containment plan must be ready to execute immediately upon scope confirmation.'}]
            },
            {
                "stageId": "s3_simultaneous_contain",
                "irPhase": "Containment, Eradication & Recovery",
                "prompt": "5 compromised hosts identified. 47GB breach confirmed. Ransomware NOT deployed — you caught the attacker 19 days into their dwell before the ransomware stage. What is the correct simultaneous containment action?",
                "analystContext": "Cobalt Strike operator is watching their C2 dashboard. The attacker has Domain User credentials from LSASS dumps. No Domain Admin access confirmed. The file server compromise means shared business data was accessed. Breach notification process must start in parallel.",
                "options": [
                    {"actionText": "Simultaneously isolate all 5 hosts via EDR network quarantine, reset credentials for all affected accounts, block the C2 Cloudflare domain at the proxy, and initiate breach notification assessment for the 47GB Mega.nz exfiltration — all in parallel", "isCorrect": True, "consequence": "All 5 hosts isolated simultaneously. C2 blocked. Attacker loses all 5 beacons at once. Ransomware never deploys. Breach notification process begins. Proactive threat hunting prevented the ransomware stage entirely.", "nextStageId": None, "technicalExplanation": "Simultaneous isolation of all 5 hosts is critical — sequential isolation tips off the Cobalt Strike operator who will use remaining beacons to accelerate deployment. The 47GB Mega.nz exfiltration is a breach event regardless of ransomware status — breach notification deadlines run from when you became aware. This scenario represents the ideal threat hunting outcome: stopping the attacker before ransomware deployment."}
                ,
                    {"actionText": 'Contain one system at a time to avoid overwhelming the IR team', "isCorrect": False, "consequence": 'Sequential containment takes 45 minutes. Attacker detects first isolation, deploys ransomware on remaining 8 compromised hosts before they are contained.', "nextStageId": None, "technicalExplanation": 'Sequential containment is the most common failure mode in multi-host incidents. Threat actors with monitoring detect the first isolation and immediately act on remaining footholds. Simultaneous containment — all hosts isolated within a 2-minute window — is the required approach.'},
                    {"actionText": 'Notify department heads to warn their teams before containment to minimize disruption', "isCorrect": False, "consequence": 'Notification leaks to a compromised Slack channel. Attacker sees the message and deploys final payload 20 minutes before planned containment.', "nextStageId": None, "technicalExplanation": 'Pre-containment notifications create operational security risk in an active intrusion. Compromised communication channels (email, Slack, Teams) may be monitored by the threat actor. Containment must be executed first; business communication follows.'},
                    {"actionText": 'Quarantine the endpoints via EDR and let the network team handle server isolation separately', "isCorrect": False, "consequence": 'EDR quarantine and network isolation done in separate waves 20 minutes apart. Attacker pivots from a server to a workstation missed in the first wave. Second wave never happens.', "nextStageId": None, "technicalExplanation": 'Split-team containment with different timelines undermines simultaneous containment. All teams must execute their isolation actions within the same 2-minute window. Staggered containment gives a sophisticated actor time to pivot between the waves.'}]
            }
        ],
        "lessonsLearned": [
            "Proactive threat hunting for Cobalt Strike beacon timing patterns (non-browser HTTPS at ~60s intervals) is one of the highest-yield detection queries available",
            "19 days of attacker dwell time with RDP lateral movement means patient zero is never the only compromised host — always hunt lateral movement targets",
            "rclone execution on workstations for 4+ hours = confirmed data exfiltration — breach notification obligations apply immediately",
            "EDR without behavioral analytics tuning generates noise that buries real alerts — compound rules reduce false positives",
            "Proactive threat hunting prevented the ransomware stage entirely — the best incident response is stopping the attack before ransomware deploys",
            "Simultaneous isolation of all compromised hosts is mandatory — sequential isolation alerts the operator who uses remaining beacons to accelerate deployment"
        ],
        "referenceLinks": ["https://www.cisa.gov/stopransomware/ransomware-guide", "https://attack.mitre.org/software/S0154/", "https://www.nist.gov/publications/computer-security-incident-handling-guide"]
    }
})

# ─────────────────────────────────────────────────────────────────────────────
# Seed runner
# ─────────────────────────────────────────────────────────────────────────────

async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        existing = await session.execute(select(Scenario.name))
        existing_names = {row[0] for row in existing.fetchall()}
        added, skipped = 0, 0
        updated = 0
        for data in SCENARIOS:
            if data["name"] in existing_names:
                # Update scenario_structure so expanded options take effect
                await session.execute(
                    __import__('sqlalchemy').update(Scenario)
                    .where(Scenario.name == data["name"])
                    .values(
                        scenario_structure=data["scenario_structure"],
                        initial_prompt=data["initial_prompt"],
                        difficulty_level=data["difficulty_level"],
                        max_attempts=data["max_attempts"],
                    )
                )
                print(f"  🔄  Updated: {data['name']}")
                updated += 1
                skipped += 1
                continue
            session.add(Scenario(
                name=data["name"], description=data["description"],
                initial_prompt=data["initial_prompt"], difficulty_level=data["difficulty_level"],
                max_attempts=data["max_attempts"], scenario_structure=data["scenario_structure"],
                created_by=None,
            ))
            print(f"  ✅  Adding: {data['name']}")
            added += 1
        await session.commit()
        print(f"\n🎯 Seed complete — {added} added, {skipped} skipped.")
        print("\nScenarios loaded:")
        for s in SCENARIOS:
            phase = s["scenario_structure"]["irPhase"][:50]
            print(f"  [{s['difficulty_level'].upper():6}] {s['name']} — {phase}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
