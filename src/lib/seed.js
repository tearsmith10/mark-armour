// Executive seed board: 30 tasks for a multi-global CEO office
// (meetings, deals to close, conferences across Oct / Nov / Dec 2026).
// Loaded as the default board on first run (see lib/storage.js) and
// re-loadable anytime via the "CEO board" toolbar button.

const sid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

function card({ title, description, priority, dueDate, tags, subtasks = [] }) {
  const category = tags.includes('deal')
    ? 'Deal'
    : tags.includes('conference')
      ? 'Conference'
      : 'Meeting'
  return {
    id: sid(),
    title,
    description,
    category,
    completed: false,
    priority,
    dueDate,
    tags,
    subtasks: subtasks.map((t) => ({ id: sid(), title: t, done: false })),
    createdAt: Date.now(),
  }
}

const OCTOBER = [
  card({
    title: 'Board meeting: Dangote Cement Q3 results review (Lagos)',
    description: 'Approve Q3 financials, dividend guidance and Pan-Africa volume targets. Pre-read: CFO pack due Sep 30.',
    priority: 'high',
    dueDate: '2026-10-02',
    tags: ['meeting', 'october', 'board'],
    subtasks: ['Review CFO pre-read pack', 'Sign off dividend guidance note'],
  }),
  card({
    title: 'CLOSE DEAL: $1.2B cement offtake — Ethiopian distributor consortium',
    description: 'Multi-year offtake covering Ethiopia + Djibouti corridor. Open items: FX clause, take-or-pay volume. Target signature this week.',
    priority: 'high',
    dueDate: '2026-10-06',
    tags: ['deal', 'october', 'cement'],
    subtasks: ['Legal: clear FX adjustment clause', 'Final call with consortium lead', 'Signing ceremony logistics'],
  }),
  card({
    title: 'Africa CEO Forum prep call with chief of staff',
    description: 'Confirm plenary topic, bilateral requests and delegation list.',
    priority: 'medium',
    dueDate: '2026-10-08',
    tags: ['meeting', 'october'],
  }),
  card({
    title: 'CLOSE DEAL: Fertiliser supply MOU — Ministry of Agriculture, Senegal',
    description: '300,000 MT urea over 3 years. Government guarantee structure under review.',
    priority: 'high',
    dueDate: '2026-10-10',
    tags: ['deal', 'october', 'fertiliser'],
    subtasks: ['Confirm sovereign guarantee wording', 'Schedule ministerial signing'],
  }),
  card({
    title: 'Refinery turnaround review with EPC contractors (Lekki)',
    description: '650,000 bpd refinery: maintenance window, PMS evacuation, contractor KPIs.',
    priority: 'high',
    dueDate: '2026-10-13',
    tags: ['meeting', 'october', 'refinery'],
    subtasks: ['Operations dashboard review', 'Approve turnaround budget tranche'],
  }),
  card({
    title: 'KEYNOTE: West Africa Energy Summit, Accra',
    description: 'Keynote on African refining independence + downstream investment. 25-min address, panel to follow. Speech draft from comms team.',
    priority: 'high',
    dueDate: '2026-10-15',
    tags: ['conference', 'october', 'speaking'],
    subtasks: ['Approve speech draft', 'Confirm bilateral with Ghana energy minister'],
  }),
  card({
    title: 'CLOSE DEAL: Sugar backward-integration JV — Nasarawa State',
    description: '50,000-hectare BIP expansion with state equity participation. Land titles verification in progress.',
    priority: 'medium',
    dueDate: '2026-10-17',
    tags: ['deal', 'october', 'sugar'],
  }),
  card({
    title: 'Audit committee + group risk review',
    description: 'Quarterly audit, FX exposure, refinery insurance renewal.',
    priority: 'medium',
    dueDate: '2026-10-20',
    tags: ['meeting', 'october', 'governance'],
  }),
  card({
    title: 'PANEL: Global Commodity Outlook — Lagos Business School',
    description: 'Evening executive panel on commodities and African manufacturing. 40 minutes.',
    priority: 'low',
    dueDate: '2026-10-23',
    tags: ['conference', 'october', 'speaking'],
  }),
  card({
    title: 'CLOSE DEAL: $800M port logistics PPP — Lekki Deep Sea Port',
    description: 'Bulk-handling concession for cement/clinker exports. NPA approvals pending.',
    priority: 'high',
    dueDate: '2026-10-28',
    tags: ['deal', 'october', 'logistics'],
    subtasks: ['NPA approval follow-up', 'Financial close checklist'],
  }),
]

const NOVEMBER = [
  card({
    title: 'Board strategy retreat: FY2027 capex approvals (Abuja)',
    description: 'Two-day retreat. Approve group capex envelope, refinery expansion phase 2, new grinding plants.',
    priority: 'high',
    dueDate: '2026-11-03',
    tags: ['meeting', 'november', 'board'],
    subtasks: ['Review strategy office deck', 'Pre-align with committee chairs'],
  }),
  card({
    title: 'CLOSE DEAL: Dangote Salt export contracts — Ghana & Côte d’Ivoire',
    description: 'NASCON regional expansion: distributor agreements + pricing in CFA/USD.',
    priority: 'medium',
    dueDate: '2026-11-05',
    tags: ['deal', 'november', 'salt'],
  }),
  card({
    title: 'KEYNOTE: Africa Investment Forum, Rabat',
    description: 'Presidential boardroom session + keynote on industrialising Africa. Meet DFIs on blended finance.',
    priority: 'high',
    dueDate: '2026-11-08',
    tags: ['conference', 'november', 'speaking'],
    subtasks: ['Approve keynote deck', 'Shortlist DFI bilaterals'],
  }),
  card({
    title: 'CLOSE DEAL: Refinery PMS export contract — European trader',
    description: 'Spot + term PMS cargoes ex-Lekki. Pricing benchmark and shipping terms under negotiation.',
    priority: 'high',
    dueDate: '2026-11-11',
    tags: ['deal', 'november', 'refinery'],
    subtasks: ['Trading desk: lock benchmark formula', 'Legal: charterparty review'],
  }),
  card({
    title: 'Meeting: CBN Governor on FX repatriation window',
    description: 'Resolve outstanding FX repatriation for Pan-African subsidiaries; propose standing facility.',
    priority: 'high',
    dueDate: '2026-11-13',
    tags: ['meeting', 'november', 'government'],
  }),
  card({
    title: 'COP30 business delegation side event — Belém, Brazil',
    description: 'Private-sector roundtable on green industrialisation; Dangote green cement showcase.',
    priority: 'medium',
    dueDate: '2026-11-16',
    tags: ['conference', 'november', 'sustainability'],
  }),
  card({
    title: 'CLOSE DEAL: $450M clinker grinding plant — Cameroon',
    description: 'Douala grinding facility: land lease, EPC award, government incentives package.',
    priority: 'high',
    dueDate: '2026-11-18',
    tags: ['deal', 'november', 'cement'],
    subtasks: ['EPC final bid comparison', 'Investment incentives letter'],
  }),
  card({
    title: 'Town hall: Group leadership summit (all business units)',
    description: 'Annual address to GMs and directors: FY2027 priorities, culture, performance awards.',
    priority: 'medium',
    dueDate: '2026-11-21',
    tags: ['meeting', 'november', 'leadership'],
  }),
  card({
    title: 'CLOSE DEAL: Rice outgrower expansion — Kebbi & Jigawa',
    description: 'Additional 20,000 outgrowers for Dangote Rice; state government counterpart funding.',
    priority: 'medium',
    dueDate: '2026-11-24',
    tags: ['deal', 'november', 'rice'],
  }),
  card({
    title: 'Year-end stakeholder dinner: guest list + invitations',
    description: 'Ministers, regulators, bankers, traditional rulers. Venue: Lagos. Protocol office lead.',
    priority: 'low',
    dueDate: '2026-11-27',
    tags: ['meeting', 'november', 'protocol'],
  }),
]

const DECEMBER = [
  card({
    title: 'CLOSE DEAL: Year-end cement price-lock contracts — distributors',
    description: 'National distributor price-lock for Q1 2027. Volumes, rebates and credit limits.',
    priority: 'high',
    dueDate: '2026-12-01',
    tags: ['deal', 'december', 'cement'],
    subtasks: ['Commercial: finalise rebate tiers', 'Credit: approve distributor limits'],
  }),
  card({
    title: 'Board meeting: FY2027 budget sign-off (Lagos)',
    description: 'Approve group budget, dividend policy and board calendar for 2027.',
    priority: 'high',
    dueDate: '2026-12-03',
    tags: ['meeting', 'december', 'board'],
  }),
  card({
    title: 'End-of-year press conference & media parley (Lagos)',
    description: 'Annual media briefing: refinery milestones, group outlook, foundation impact report.',
    priority: 'medium',
    dueDate: '2026-12-06',
    tags: ['conference', 'december', 'media'],
    subtasks: ['Approve press kit', 'Confirm attending editors'],
  }),
  card({
    title: 'Refinery dividend + profit repatriation review',
    description: 'Treasury review of refinery cash flows, debt service and upstream dividend declarations.',
    priority: 'high',
    dueDate: '2026-12-09',
    tags: ['meeting', 'december', 'refinery', 'finance'],
  }),
  card({
    title: 'CLOSE DEAL: $300M urea export — Brazilian buyers',
    description: 'Term urea shipments to Brazil for 2027 planting season. LOIs converted to firm contracts.',
    priority: 'high',
    dueDate: '2026-12-11',
    tags: ['deal', 'december', 'fertiliser'],
    subtasks: ['Convert LOIs to firm offtake', 'Freight: secure vessel slots'],
  }),
  card({
    title: 'Meeting: Presidential industrial council session (Aso Villa)',
    description: 'Private-sector council: manufacturing incentives, power tariffs, backward integration policy.',
    priority: 'high',
    dueDate: '2026-12-14',
    tags: ['meeting', 'december', 'government'],
    subtasks: ['Policy memo from strategy office', 'Confirm 3 priority asks'],
  }),
  card({
    title: 'PANEL JUDGE: Africa Business Heroes grand finale',
    description: 'Guest judge at the entrepreneurship finale. 2-hour commitment + award presentation.',
    priority: 'low',
    dueDate: '2026-12-16',
    tags: ['conference', 'december', 'philanthropy'],
  }),
  card({
    title: 'Sign off: staff bonus + 13th-month approvals (Group)',
    description: 'HR proposal for year-end bonuses across all business units. Sign before payroll run.',
    priority: 'medium',
    dueDate: '2026-12-18',
    tags: ['meeting', 'december', 'hr'],
  }),
  card({
    title: 'CLOSE DEAL: Lekki port warehouse concession',
    description: 'Long-lease warehouse concession for fertiliser + sugar storage at the port corridor.',
    priority: 'medium',
    dueDate: '2026-12-21',
    tags: ['deal', 'december', 'logistics'],
  }),
  card({
    title: 'Year-end review: family office + Aliko Dangote Foundation',
    description: 'Foundation 2026 impact (health, nutrition, education) + 2027 grant approvals. Private session.',
    priority: 'low',
    dueDate: '2026-12-28',
    tags: ['meeting', 'december', 'foundation'],
  }),
]

// Active negotiations / imminent items start In Progress; the rest in To Do.
const IN_PROGRESS_TITLES = new Set([
  'CLOSE DEAL: $1.2B cement offtake — Ethiopian distributor consortium',
  'CLOSE DEAL: Fertiliser supply MOU — Ministry of Agriculture, Senegal',
  'CLOSE DEAL: Refinery PMS export contract — European trader',
  'CLOSE DEAL: $450M clinker grinding plant — Cameroon',
  'CLOSE DEAL: Year-end cement price-lock contracts — distributors',
  'CLOSE DEAL: $300M urea export — Brazilian buyers',
])

export function executiveBoard() {
  const all = [...OCTOBER, ...NOVEMBER, ...DECEMBER]
  return [
    {
      id: sid(),
      title: 'To Do',
      cards: all.filter((c) => !IN_PROGRESS_TITLES.has(c.title)),
    },
    {
      id: sid(),
      title: 'In Progress',
      cards: all.filter((c) => IN_PROGRESS_TITLES.has(c.title)),
    },
    { id: sid(), title: 'Done', cards: [] },
  ]
}

export const EXECUTIVE_TASK_COUNT = 30
