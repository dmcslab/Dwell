/**
 * siemLogs.ts
 * -----------
 * Generates contextually relevant fake SIEM log lines based on the current
 * scenario's ransomware family, TTPs, and IR phase.
 *
 * Log lines reference real Windows Event IDs, EDR event types, and realistic
 * process/hostname patterns to maximise immersion.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | 'WARN'
export type LogSource   = 'EDR' | 'WinEvent' | 'Firewall' | 'DNS' | 'SIEM' | 'Sysmon' | 'AV' | 'Proxy'

export interface SiemLogLine {
  id:        number
  ts:        string         // HH:MM:SS.mmm
  severity:  LogSeverity
  source:    LogSource
  host:      string
  eventId:   string
  message:   string
}

// ── Hostname pools ─────────────────────────────────────────────────────────────

const WS_HOSTS  = ['WS-FIN-04', 'WS-ACCT-11', 'WS-HR-07', 'WS-MKT-09', 'WS-MGT-03', 'WS-ACCT-15', 'WS-ENG-22', 'WS-OPS-31']
const SRV_HOSTS = ['SRV-DC01', 'SRV-DC02', 'SRV-FILE01', 'SRV-EXCH01', 'SRV-BACKUP01', 'SRV-WSUS01', 'SRV-SQL01']
const ALL_HOSTS = [...WS_HOSTS, ...SRV_HOSTS]

const INTERNAL_IPS  = ['10.10.1', '10.10.2', '10.10.5', '10.20.1', '192.168.10', '192.168.20']
const EXTERNAL_IPS  = ['185.220.101', '94.102.49', '45.142.212', '91.108.56', '176.113.115', '198.51.100']
const TOR_IPS       = ['185.220.101.47', '94.102.49.193', '23.129.64.218', '199.249.230.87']
const CLOUDFLARE    = ['104.21.8.1', '172.67.184.1', '104.16.249.1']

const PROCESS_LEGIT = ['svchost.exe', 'explorer.exe', 'lsass.exe', 'wininit.exe', 'services.exe', 'csrss.exe', 'winlogon.exe', 'spoolsv.exe']
const PROCESS_SUSP  = ['powershell.exe', 'cmd.exe', 'wscript.exe', 'cscript.exe', 'mshta.exe', 'regsvr32.exe', 'certutil.exe', 'bitsadmin.exe', 'wmic.exe', 'rundll32.exe']
const PROCESS_TOOLS = ['psexec.exe', 'psexesvc.exe', 'mimikatz.exe', 'cobalt_strike.exe', 'vssadmin.exe', 'wevtutil.exe', 'net.exe', 'nltest.exe', 'bloodhound.exe', 'rclone.exe', 'adfind.exe']

// ── Helpers ───────────────────────────────────────────────────────────────────

let _logId = 0
const nextId = () => ++_logId

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function fmtTs(offsetMs = 0): string {
  const now  = new Date(Date.now() - offsetMs)
  const hh   = String(now.getHours()).padStart(2, '0')
  const mm   = String(now.getMinutes()).padStart(2, '0')
  const ss   = String(now.getSeconds()).padStart(2, '0')
  const ms   = String(now.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function randIp(pool: string[]): string {
  const base = pick(pool)
  return `${base}.${randInt(2, 254)}`
}

function randPort(): number {
  const ports = [443, 445, 80, 8080, 4444, 4443, 53, 135, 139, 3389, 5985, 1337, 8443]
  return pick(ports)
}

function randHash(len = 8): string {
  return Math.random().toString(16).slice(2, 2 + len).toUpperCase()
}

// ── Log templates organised by TTP category ───────────────────────────────────

type LogTemplate = () => Omit<SiemLogLine, 'id' | 'ts'>

const TEMPLATES: Record<string, LogTemplate[]> = {

  // ── Phishing / Initial Access ───────────────────────────────────────────────
  phishing: [
    () => ({ severity: 'HIGH',     source: 'Proxy',    host: pick(WS_HOSTS), eventId: 'PROXY-1045', message: `Blocked download: suspicious .docm from domain registered ${randInt(1,6)} days ago — sha256: ${randHash(16)}` }),
    () => ({ severity: 'HIGH',     source: 'WinEvent', host: pick(WS_HOSTS), eventId: '4688',       message: `Process creation: OUTLOOK.EXE spawned powershell.exe -NoP -NonI -W Hidden -Enc ${randHash(32)}` }),
    () => ({ severity: 'MEDIUM',   source: 'Proxy',    host: pick(WS_HOSTS), eventId: 'PROXY-1012', message: `Outbound HTTPS to newly registered domain (${randInt(1,5)}d old): ${randHash(8).toLowerCase()}.xyz — 1.2MB response` }),
    () => ({ severity: 'HIGH',     source: 'Sysmon',   host: pick(WS_HOSTS), eventId: 'SYSMON-11',  message: `File creation in APPDATA\\Roaming: svchost${randInt(10,99)}.exe — parent: powershell.exe` }),
    () => ({ severity: 'MEDIUM',   source: 'Sysmon',   host: pick(WS_HOSTS), eventId: 'SYSMON-3',   message: `Network connection: powershell.exe → ${randIp(EXTERNAL_IPS)}:443 (initiated by macro execution)` }),
    () => ({ severity: 'INFO',     source: 'Proxy',    host: pick(WS_HOSTS), eventId: 'PROXY-100',  message: `User-agent anomaly: WinHTTP/1.0 (not browser) to Cloudflare IP ${pick(CLOUDFLARE)} — possible beacon` }),
    () => ({ severity: 'HIGH',     source: 'EDR',      host: pick(WS_HOSTS), eventId: 'EDR-5510',   message: `Macro execution detected: WINWORD.EXE → cmd.exe → wscript.exe — file: Invoice_${randInt(1000,9999)}.docm` }),
  ],

  // ── Lateral Movement ───────────────────────────────────────────────────────
  lateral: [
    () => ({ severity: 'HIGH',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4624',      message: `Successful logon — Account: svc_backup — LogonType: 3 (Network) — Source: ${randIp(INTERNAL_IPS)}` }),
    () => ({ severity: 'CRITICAL', source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4648',      message: `Explicit credential logon — svc_backup used on ${pick(SRV_HOSTS)} by process PsExec — anomalous` }),
    () => ({ severity: 'HIGH',     source: 'Firewall', host: pick(SRV_HOSTS), eventId: 'FW-4501',   message: `Allow TCP/445 ${randIp(INTERNAL_IPS)} → ${pick(SRV_HOSTS)} — unusual source workstation` }),
    () => ({ severity: 'HIGH',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '7045',      message: `New service installed: PSEXESVC — started by: Administrator — binary: %SYSTEMROOT%\\PSEXESVC.EXE` }),
    () => ({ severity: 'MEDIUM',   source: 'Sysmon',   host: pick(ALL_HOSTS), eventId: 'SYSMON-1',  message: `Process: nltest.exe /domain_trusts — parent: cmd.exe — user: ${pick(['DOMAIN\\svc_backup', 'DOMAIN\\Administrator', 'DOMAIN\\helpdesk'])}` }),
    () => ({ severity: 'HIGH',     source: 'EDR',      host: pick(SRV_HOSTS), eventId: 'EDR-7720',  message: `RDP session from ${randIp(INTERNAL_IPS)} — account: Administrator — outside business hours` }),
    () => ({ severity: 'MEDIUM',   source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4732',      message: `User added to local Administrators group: ${pick(['svc_update2', 'helpdesk_temp', 'svc_monitor'])} — by: Administrator` }),
  ],

  // ── Credential Access ──────────────────────────────────────────────────────
  credential: [
    () => ({ severity: 'CRITICAL', source: 'EDR',      host: pick(WS_HOSTS),  eventId: 'EDR-9001',  message: `LSASS memory access detected — PID ${randInt(1000,9999)}: ${pick(['mim.exe','svchost32.exe','WerFault.exe'])} — Mimikatz pattern` }),
    () => ({ severity: 'CRITICAL', source: 'Sysmon',   host: pick(ALL_HOSTS), eventId: 'SYSMON-10', message: `Process access: lsass.exe (PID 772) — source: ${pick(PROCESS_SUSP)} — granted: PROCESS_VM_READ` }),
    () => ({ severity: 'HIGH',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4625',      message: `Failed logon × ${randInt(12,47)} in 60s — Account: Administrator — Source: ${randIp(INTERNAL_IPS)} — spray pattern` }),
    () => ({ severity: 'HIGH',     source: 'EDR',      host: pick(SRV_HOSTS), eventId: 'EDR-8820',  message: `Kerberoastable service ticket requested for: HTTP/SRV-EXCH01 — unusual source account` }),
    () => ({ severity: 'MEDIUM',   source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4769',      message: `Kerberos TGS request: krbtgt — encryption: RC4-HMAC (DES_CBC_MD5) — anomalous downgrade` }),
    () => ({ severity: 'CRITICAL', source: 'Sysmon',   host: pick(SRV_HOSTS), eventId: 'SYSMON-10', message: `Possible DCSync: ${pick(WS_HOSTS)} calling DRSGetNCChanges on DC — non-DC initiating replication` }),
  ],

  // ── Ransomware / Encryption ────────────────────────────────────────────────
  encryption: [
    () => ({ severity: 'CRITICAL', source: 'EDR',      host: pick(WS_HOSTS),  eventId: 'EDR-9900',  message: `Mass file rename: ${randInt(800,4000)} files renamed with extension .LOCKED in ${randInt(8,30)}s — encryption in progress` }),
    () => ({ severity: 'CRITICAL', source: 'Sysmon',   host: pick(ALL_HOSTS), eventId: 'SYSMON-11', message: `vssadmin.exe created: args "delete shadows /all /quiet" — ransomware VSS deletion (T1490)` }),
    () => ({ severity: 'CRITICAL', source: 'WinEvent', host: pick(WS_HOSTS),  eventId: '4688',      message: `Process: vssadmin.exe delete shadows /all — parent: svchost32.exe (AppData) — shadow copy destruction` }),
    () => ({ severity: 'CRITICAL', source: 'EDR',      host: pick(ALL_HOSTS), eventId: 'EDR-9910',  message: `Ransom note dropped: YOUR_FILES_ARE_ENCRYPTED.txt — ${randInt(50,400)} directories — decryption key C2-dependent` }),
    () => ({ severity: 'CRITICAL', source: 'Sysmon',   host: pick(WS_HOSTS),  eventId: 'SYSMON-13', message: `Registry: HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon — LegalNoticeText modified` }),
    () => ({ severity: 'HIGH',     source: 'Firewall', host: pick(WS_HOSTS),  eventId: 'FW-9901',   message: `Outbound C2 beacon: ${pick(TOR_IPS)}:${randPort()} — HTTPS — 847 bytes (RSA public key exchange pattern)` }),
    () => ({ severity: 'CRITICAL', source: 'SIEM',     host: 'SIEM-CORE',     eventId: 'SIEM-CORR', message: `Correlation: ${randInt(200,600)} simultaneous mass-rename events across ${randInt(5,20)} hosts — ransomware worm propagation` }),
  ],

  // ── SMB Worm / Exploit ─────────────────────────────────────────────────────
  smb_worm: [
    () => ({ severity: 'CRITICAL', source: 'Firewall', host: 'SRV-FW01',      eventId: 'FW-4510',   message: `Allow TCP/445 ${randIp(INTERNAL_IPS)} → ${randIp(INTERNAL_IPS)} — internal SMBv1 lateral sweep (EternalBlue pattern)` }),
    () => ({ severity: 'CRITICAL', source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '7045',      message: `Service installed: mssecsvc2.0 — binary: C:\\WINDOWS\\mssecsvc.exe — WannaCry-class worm service` }),
    () => ({ severity: 'CRITICAL', source: 'SIEM',     host: 'SIEM-CORE',     eventId: 'SIEM-CORR', message: `TCP/445 sweep: ${pick(WS_HOSTS)} scanning /16 — ${randInt(500,3000)} probes/sec — autonomous worm propagation` }),
    () => ({ severity: 'CRITICAL', source: 'Sysmon',   host: pick(SRV_HOSTS), eventId: 'SYSMON-3',  message: `DoublePulsar ring-0 backdoor: kernel-mode implant confirmed — process injection into system PID 4` }),
    () => ({ severity: 'HIGH',     source: 'EDR',      host: pick(WS_HOSTS),  eventId: 'EDR-6610',  message: `MS17-010 exploit attempt received — SMBv1 exploit frame detected — no EDR intercept (pre-patch)` }),
    () => ({ severity: 'CRITICAL', source: 'Sysmon',   host: pick(ALL_HOSTS), eventId: 'SYSMON-1',  message: `Process: mssecsvc.exe spawning additional mssecsvc.exe children — worm self-replication` }),
  ],

  // ── C2 Beaconing ───────────────────────────────────────────────────────────
  c2: [
    () => ({ severity: 'HIGH',     source: 'Proxy',    host: pick(WS_HOSTS),  eventId: 'PROXY-2201', message: `Jitter beacon: explorer.exe → ${pick(CLOUDFLARE)} every ${randInt(55,65)}s ±${randInt(2,8)}s — Cobalt Strike CS pattern` }),
    () => ({ severity: 'HIGH',     source: 'DNS',      host: pick(ALL_HOSTS), eventId: 'DNS-3301',   message: `DNS query: ${randHash(12).toLowerCase()}.${pick(['cdn','assets','static','api'])}.cloudflare.com — domain-fronting suspected` }),
    () => ({ severity: 'HIGH',     source: 'Firewall', host: pick(WS_HOSTS),  eventId: 'FW-2201',    message: `HTTPS established: ${pick(TOR_IPS)}:443 — SNI: google.com — IP resolves to Tor exit — domain-front` }),
    () => ({ severity: 'MEDIUM',   source: 'Sysmon',   host: pick(WS_HOSTS),  eventId: 'SYSMON-3',   message: `explorer.exe outbound connection — unusual: explorer should not initiate network connections` }),
    () => ({ severity: 'HIGH',     source: 'EDR',      host: pick(WS_HOSTS),  eventId: 'EDR-4401',   message: `Process injection: explorer.exe (PID ${randInt(1000,9000)}) — injected DLL: ${randHash(8).toLowerCase()}.dll from TEMP` }),
    () => ({ severity: 'MEDIUM',   source: 'Proxy',    host: pick(WS_HOSTS),  eventId: 'PROXY-2202', message: `HTTP/S beacon consistent 60s interval — VPN source — outside business hours 02:${randInt(10,59).toString().padStart(2,'0')} UTC` }),
  ],

  // ── Defence Evasion ────────────────────────────────────────────────────────
  evasion: [
    () => ({ severity: 'HIGH',     source: 'WinEvent', host: pick(WS_HOSTS),  eventId: '1102',      message: `Audit log cleared — Security event log wiped — actor: ${pick(['SYSTEM','Administrator','NT AUTHORITY\\SYSTEM'])}` }),
    () => ({ severity: 'HIGH',     source: 'Sysmon',   host: pick(ALL_HOSTS), eventId: 'SYSMON-12', message: `Registry: HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest — UseLogonCredential = 1 (forced plaintext)` }),
    () => ({ severity: 'MEDIUM',   source: 'EDR',      host: pick(WS_HOSTS),  eventId: 'EDR-3310',  message: `Process masquerading: svchost${randInt(10,99)}.exe in AppData\\Roaming — mimics system process from user path` }),
    () => ({ severity: 'HIGH',     source: 'Sysmon',   host: pick(WS_HOSTS),  eventId: 'SYSMON-11', message: `Timestomping: ${randHash(8).toLowerCase()}.exe — $STANDARD_INFORMATION modified to match system files` }),
    () => ({ severity: 'MEDIUM',   source: 'WinEvent', host: pick(ALL_HOSTS), eventId: '4698',      message: `Scheduled task created: MicrosoftEdge${randHash(4)} — action: powershell -WindowStyle hidden -NoProfile` }),
    () => ({ severity: 'HIGH',     source: 'EDR',      host: pick(ALL_HOSTS), eventId: 'EDR-3320',  message: `AMSI bypass: PowerShell loaded amsi.dll then patched AmsiScanBuffer — detected by EDR memory scanner` }),
  ],

  // ── Exfiltration ───────────────────────────────────────────────────────────
  exfil: [
    () => ({ severity: 'HIGH',     source: 'Proxy',    host: pick(WS_HOSTS),  eventId: 'PROXY-5501', message: `Anomalous upload: rclone.exe → storage.googleapis.com — ${randInt(2,18)}GB in ${randInt(10,60)}min — not a managed tool` }),
    () => ({ severity: 'HIGH',     source: 'Firewall', host: pick(ALL_HOSTS), eventId: 'FW-5501',    message: `Egress data: ${randInt(5,80)}GB outbound → ${randIp(EXTERNAL_IPS)} over 72h — exfil via non-standard port ${randPort()}` }),
    () => ({ severity: 'MEDIUM',   source: 'DNS',      host: pick(WS_HOSTS),  eventId: 'DNS-5501',   message: `DNS exfil: ${randInt(200,800)} TXT queries to ${randHash(6)}.${randHash(8)}.burpcollaborator.net — data in subdomain labels` }),
    () => ({ severity: 'HIGH',     source: 'Proxy',    host: pick(WS_HOSTS),  eventId: 'PROXY-5502', message: `Cloud storage upload: OneDrive/mega.nz — ${randInt(500,5000)}MB — process: rclone.exe — no business justification` }),
  ],

  // ── Normal / Baseline noise ────────────────────────────────────────────────
  baseline: [
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(ALL_HOSTS), eventId: '4624',      message: `Successful logon — Account: ${pick(['jdoe','msmith','awhite','rjohnson'])}@domain.local — LogonType: 2 (Interactive)` }),
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(ALL_HOSTS), eventId: '4688',      message: `Process: MsMpEng.exe — parent: services.exe — Windows Defender signature update` }),
    () => ({ severity: 'INFO',     source: 'Proxy',    host: pick(WS_HOSTS),  eventId: 'PROXY-100', message: `Allow HTTPS microsoft.com — Office telemetry — 4.2KB` }),
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4776',      message: `NTLM authentication — Account: DOMAIN\\svc_print — Source: ${randIp(INTERNAL_IPS)}` }),
    () => ({ severity: 'INFO',     source: 'AV',       host: pick(ALL_HOSTS), eventId: 'AV-1001',   message: `Scan complete — 0 threats found — ${randInt(8000,60000)} files scanned — engine: ${randHash(4)}` }),
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4634',      message: `Logoff — Account: DOMAIN\\${pick(['svc_backup','svc_wsus','svc_monitor'])} — Session ended normally` }),
    () => ({ severity: 'INFO',     source: 'DNS',      host: pick(WS_HOSTS),  eventId: 'DNS-100',   message: `Query: windowsupdate.microsoft.com → 23.218.212.69 — routine update check` }),
    () => ({ severity: 'WARN',     source: 'WinEvent', host: pick(WS_HOSTS),  eventId: '4625',      message: `Failed logon — Account: ${pick(['jdoe','msmith'])}@domain.local — wrong password — LogonType: 2` }),
  ],

  // ── Recovery / Post-incident ───────────────────────────────────────────────
  recovery: [
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4720',      message: `User account created: IR_BreakGlass_${randInt(10,99)} — by: IR_Analyst — emergency response account` }),
    () => ({ severity: 'INFO',     source: 'SIEM',     host: 'SIEM-CORE',     eventId: 'SIEM-IR01', message: `Containment confirmed: ${randInt(3,8)} hosts isolated — no new encryption events in last 300s` }),
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4723',      message: `Password change: krbtgt — second rotation complete — all Kerberos tickets invalidated` }),
    () => ({ severity: 'INFO',     source: 'WinEvent', host: pick(SRV_HOSTS), eventId: '4740',      message: `Account disabled: svc_backup — by: IR_BreakGlass_01 — incident response lockdown` }),
    () => ({ severity: 'INFO',     source: 'EDR',      host: pick(ALL_HOSTS), eventId: 'EDR-0001',  message: `Host cleared: no active threats detected — cleared by IR analyst for reimaging` }),
    () => ({ severity: 'INFO',     source: 'SIEM',     host: 'SIEM-CORE',     eventId: 'SIEM-IR02', message: `Firewall rule applied: BLOCK inbound TCP/445 to SRV-DC01, SRV-DC02 — containment rule active` }),
  ],
}

// ── TTP → template category mapping ───────────────────────────────────────────

const TTP_CATEGORY_MAP: Record<string, string[]> = {
  'T1566': ['phishing', 'c2'],
  'T1059': ['phishing', 'evasion', 'c2'],
  'T1055': ['c2', 'evasion', 'credential'],
  'T1003': ['credential'],
  'T1078': ['lateral', 'c2'],
  'T1021': ['lateral'],
  'T1210': ['smb_worm', 'lateral'],
  'T1486': ['encryption'],
  'T1490': ['encryption', 'evasion'],
  'T1048': ['exfil'],
  'T1041': ['exfil', 'c2'],
  'T1133': ['c2', 'lateral'],
  'T1543': ['smb_worm', 'evasion'],
  'T1014': ['smb_worm', 'evasion'],
  'T1083': ['encryption', 'lateral'],
  'T1046': ['smb_worm', 'lateral'],
  'T1036': ['evasion'],
  'T1027': ['evasion', 'phishing'],
  'T1656': ['phishing'],
  'T1621': ['phishing', 'lateral'],
  'T1569': ['lateral', 'encryption'],
}

// ── IR Phase → weighted category mix ──────────────────────────────────────────

const PHASE_WEIGHTS: Record<string, { categories: string[]; baselineRatio: number }> = {
  'Preparation':                  { categories: ['baseline', 'evasion'],                          baselineRatio: 0.7 },
  'Detection & Analysis':         { categories: ['phishing', 'c2', 'evasion', 'credential'],      baselineRatio: 0.3 },
  'Containment':                  { categories: ['lateral', 'smb_worm', 'encryption', 'c2'],      baselineRatio: 0.15 },
  'Containment, Eradication & Recovery': { categories: ['encryption', 'lateral', 'recovery'],    baselineRatio: 0.2 },
  'Eradication & Recovery':       { categories: ['recovery', 'baseline'],                         baselineRatio: 0.4 },
  'Post-Incident Activity':       { categories: ['recovery', 'baseline'],                         baselineRatio: 0.6 },
}

function getPhaseKey(irPhase: string): string {
  for (const key of Object.keys(PHASE_WEIGHTS)) {
    if (irPhase.toLowerCase().includes(key.toLowerCase())) return key
  }
  return 'Detection & Analysis'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a batch of log lines appropriate for the given scenario context.
 * `keyTTPs` are parsed to weight towards relevant attack categories.
 */
export function generateLogBatch(
  irPhase:   string,
  keyTTPs:   string[],
  count      = 6,
): SiemLogLine[] {
  const phaseKey   = getPhaseKey(irPhase)
  const config     = PHASE_WEIGHTS[phaseKey] ?? PHASE_WEIGHTS['Detection & Analysis']

  // Build category pool from phase defaults + TTP mappings
  const ttpCategories = keyTTPs
    .map(t => t.split(' ')[0].split('.')[0])                 // extract e.g. "T1566"
    .flatMap(t => TTP_CATEGORY_MAP[t] ?? [])

  const allCategories = [...config.categories, ...ttpCategories]
  const uniqueCategories = [...new Set(allCategories)]

  const lines: SiemLogLine[] = []

  for (let i = 0; i < count; i++) {
    const isBaseline = Math.random() < config.baselineRatio
    const category   = isBaseline ? 'baseline' : pick(uniqueCategories)
    const pool       = TEMPLATES[category] ?? TEMPLATES['baseline']
    const template   = pick(pool)
    const entry      = template()

    lines.push({
      id:  nextId(),
      ts:  fmtTs(Math.random() < 0.3 ? randInt(0, 5000) : 0),
      ...entry,
    })
  }

  // Sort by time descending (newest first)
  return lines.sort((a, b) => b.ts.localeCompare(a.ts))
}

/**
 * Generate a single new log line (used for streaming).
 */
export function generateLogLine(
  irPhase: string,
  keyTTPs: string[],
): SiemLogLine {
  return generateLogBatch(irPhase, keyTTPs, 1)[0]
}

// ── Severity styling helpers ─────────────────────────────────────────────────

export const SEVERITY_CLASSES: Record<LogSeverity, string> = {
  CRITICAL: 'text-red-400 font-bold',
  HIGH:     'text-orange-400 font-semibold',
  WARN:     'text-amber-400',
  MEDIUM:   'text-yellow-400',
  INFO:     'text-gray-400',
}

export const SEVERITY_DOT: Record<LogSeverity, string> = {
  CRITICAL: 'bg-red-500 animate-pulse',
  HIGH:     'bg-orange-500',
  WARN:     'bg-amber-500',
  MEDIUM:   'bg-yellow-600',
  INFO:     'bg-gray-600',
}

export const SOURCE_CLASSES: Record<LogSource, string> = {
  EDR:      'text-violet-400',
  WinEvent: 'text-blue-400',
  Firewall: 'text-cyan-400',
  DNS:      'text-teal-400',
  SIEM:     'text-pink-400',
  Sysmon:   'text-indigo-400',
  AV:       'text-green-400',
  Proxy:    'text-sky-400',
}
