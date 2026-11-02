/**
 * Job categories, job titles and search keywords.
 *
 * Categories are scored from evidence (skills, credentials, past job titles,
 * employers, field of study). Titles that need a credential (CNA, CDL,
 * security license …) are only suggested when the resume shows it.
 */
import { CREDENTIALS } from './skills-dictionary'
import type { DetectedCredential, DetectedSkill } from './skills'
import type { ApplicantProfile, CategorySuggestion, JobCategory, ResumeData } from './types'

type Weights = Partial<Record<JobCategory, number>>

/** Past job titles → categories. */
const TITLE_SIGNALS: { re: RegExp; w: Weights }[] = [
  { re: /\b(crew (member|trainer|lead)|drive[- ]?thru|fast food|quick service|team member)\b/i, w: { 'Fast Food': 6 } },
  { re: /\bcashier\b/i, w: { 'Fast Food': 4, Retail: 5 } },
  { re: /\b(sales (associate|clerk|representative|floor)|retail|store associate|stock(er| associate)|merchandiser|key ?holder|bagger|cart attendant|courtesy clerk|grocery)\b/i, w: { Retail: 6 } },
  { re: /\b(server|waiter|waitress|host(ess)?|busser|food runner|line cook|prep cook|cook|dishwasher|barista|bartender|chef|kitchen)\b/i, w: { Restaurants: 6 } },
  { re: /\b(warehouse|picker|packer|material handler|forklift|shipping|receiving|loader|unloader|package handler|fulfillment|inventory (associate|clerk))\b/i, w: { Warehouse: 6 } },
  { re: /\b(customer service|call center|customer support|client service|contact center|customer care)\b/i, w: { 'Customer Service': 6 } },
  { re: /\bintern(ship)?\b/i, w: { Internships: 6 } },
  { re: /\b(administrative|office (assistant|clerk|manager)|receptionist|secretary|data entry|file clerk|clerical|front desk)\b/i, w: { Office: 6 } },
  { re: /\b(cna|nursing assistant|caregiver|home health|medical (assistant|receptionist|scribe)|patient|pharmacy|phlebotom|hospital|clinic|dental|emt|nurse)\b/i, w: { Healthcare: 6 } },
  { re: /\b(security|guard|loss prevention|asset protection|patrol)\b/i, w: { Security: 6 } },
  { re: /\b(apprentice|electrician|plumber|carpenter|welder|hvac|mechanic|technician|laborer|construction|maintenance|landscap|painter|roofer|installer)\b/i, w: { 'Skilled Trades': 5 } },
  { re: /\b(developer|programmer|software|engineer|it support|help desk|web|data analyst|computer|tech support|qa)\b/i, w: { Technology: 6 } },
  { re: /\b(city|county|state|federal|government|public|municipal|clerk of court|legislative|census|usps|postal)\b/i, w: { Government: 5 } },
  { re: /\b(tutor|teacher|teaching|instructor|camp counselor|counselor|coach|aide|childcare|daycare|nanny|babysitter|paraprofessional)\b/i, w: { Education: 6 } },
  { re: /\b(hotel|housekeep|front desk agent|bellhop|valet|concierge|guest service|resort|banquet|event staff|usher|lifeguard)\b/i, w: { Hospitality: 6 } },
  { re: /\b(driver|delivery|courier|dasher|shopper)\b/i, w: { Delivery: 6 } },
]

/** Well-known employers → categories. Only used when the name appears as an employer in the resume. */
const EMPLOYER_SIGNALS: { re: RegExp; w: Weights }[] = [
  { re: /\b(mcdonald'?s|burger king|wendy'?s|chick-?fil-?a|taco bell|subway|popeyes|kfc|sonic|dunkin'?|arby'?s|jack in the box|five guys|wingstop|chipotle|panda express|zaxby'?s|culver'?s|whataburger|jersey mike'?s|firehouse subs|domino'?s|pizza hut|papa john'?s|little caesars|dairy queen|raising cane'?s|in-n-out|carl'?s jr|hardee'?s|checkers|rally'?s|white castle|shake shack|panera)\b/i, w: { 'Fast Food': 6 } },
  { re: /\b(starbucks|dutch bros)\b/i, w: { 'Fast Food': 3, Restaurants: 3 } },
  { re: /\b(walmart|target|publix|kroger|costco|sam'?s club|home depot|lowe'?s|best buy|cvs|walgreens|dollar general|dollar tree|family dollar|aldi|winn-?dixie|whole foods|trader joe'?s|ross|tj ?maxx|marshalls|old navy|gap|macy'?s|kohl'?s|jcpenney|ulta|sephora|petsmart|petco|gamestop|bath & body works|h-?e-?b|safeway|albertsons|meijer|five below|hobby lobby|michaels|staples|office depot|dick'?s sporting goods|academy sports)\b/i, w: { Retail: 6 } },
  { re: /\b(olive garden|applebee'?s|chili'?s|red lobster|outback|texas roadhouse|ihop|denny'?s|waffle house|cracker barrel|buffalo wild wings|longhorn|red robin|tgi friday'?s|bj'?s restaurant|cheesecake factory)\b/i, w: { Restaurants: 6 } },
  { re: /\b(amazon (fulfillment|warehouse)|fedex ground|ups (warehouse|hub)|xpo|dhl|uline|chewy fulfillment)\b/i, w: { Warehouse: 6 } },
  { re: /\b(fedex|ups|usps|amazon flex|doordash|uber ?eats|grubhub|instacart|shipt)\b/i, w: { Delivery: 4 } },
  { re: /\b(marriott|hilton|hyatt|holiday inn|hampton inn|disney|universal|six flags|sheraton|westin|best western|wyndham|embassy suites)\b/i, w: { Hospitality: 6 } },
  { re: /\b(hospital|medical center|health system|urgent care|nursing home|assisted living|senior living|clinic)\b/i, w: { Healthcare: 6 } },
  { re: /\b(school district|elementary|middle school|ymca|boys (&|and) girls club|kumon|sylvan|mathnasium|daycare|learning center)\b/i, w: { Education: 5 } },
]

/** Field of study / coursework → categories. */
const FIELD_SIGNALS: { re: RegExp; w: Weights }[] = [
  { re: /\b(computer science|information technology|software|computer engineering|cybersecurity|data science|information systems|programming|web development|computer programming)\b/i, w: { Technology: 6 } },
  { re: /\b(nursing|biology|health ?(care|science)|pre-?med|medical|kinesiology|public health|pharmacy|exercise science|allied health|psychology)\b/i, w: { Healthcare: 4 } },
  { re: /\b(education|early childhood|child development|teaching)\b/i, w: { Education: 5 } },
  { re: /\b(business|accounting|finance|management|marketing|economics|administration|office administration)\b/i, w: { Office: 4 } },
  { re: /\b(criminal justice|criminology|law enforcement|homeland security)\b/i, w: { Security: 4, Government: 3 } },
  { re: /\b(political science|public administration|public policy|government|international relations|social work)\b/i, w: { Government: 5 } },
  { re: /\b(culinary|food service|baking and pastry)\b/i, w: { Restaurants: 5 } },
  { re: /\b(hospitality|hotel management|tourism|event management)\b/i, w: { Hospitality: 5 } },
  { re: /\b(construction|electrical|hvac|plumbing|welding|automotive|carpentry|building trades|mechanical|engineering technology|diesel)\b/i, w: { 'Skilled Trades': 5 } },
  { re: /\b(supply chain|logistics)\b/i, w: { Warehouse: 3, Office: 2 } },
  { re: /\b(communications?|english|journalism)\b/i, w: { Office: 2, 'Customer Service': 1 } },
]

interface TitleDef {
  title: string
  /** Suggested whenever the category is suggested. */
  base?: boolean
  /** Suggested when any of these skills was detected. */
  skills?: string[]
  /** Only suggested if one of these credentials is present … */
  credentials?: string[]
  /** … or a past job title matches this. */
  heldTitle?: RegExp
  /** Requires a completed bachelor's degree or higher. */
  needsDegree?: boolean
}

const TITLES: Record<JobCategory, TitleDef[]> = {
  'Fast Food': [
    { title: 'Crew Member', base: true },
    { title: 'Cashier', skills: ['Cash handling', 'POS systems'] },
    { title: 'Team Member', base: true },
    { title: 'Food Service Worker', skills: ['Food preparation', 'Food safety', 'Cooking'] },
    { title: 'Drive-Thru Attendant', skills: ['Drive-thru service', 'Customer service'] },
    { title: 'Barista', skills: ['Barista / coffee preparation'] },
    { title: 'Shift Leader', skills: ['Leadership'], heldTitle: /lead|supervis|manager|trainer/i },
  ],
  Retail: [
    { title: 'Sales Associate', base: true },
    { title: 'Cashier', skills: ['Cash handling', 'POS systems'] },
    { title: 'Retail Associate', base: true },
    { title: 'Stock Associate', skills: ['Stocking shelves', 'Inventory management'] },
    { title: 'Customer Service Associate', skills: ['Customer service'] },
    { title: 'Visual Merchandiser', skills: ['Merchandising'] },
    { title: 'Key Holder', skills: ['Leadership'], heldTitle: /lead|supervis|manager|key ?holder/i },
  ],
  Restaurants: [
    { title: 'Food Service Worker', skills: ['Food preparation', 'Food safety'] },
    { title: 'Prep Cook', skills: ['Food preparation'] },
    { title: 'Line Cook', skills: ['Cooking'] },
    { title: 'Server', skills: ['Table service'] },
    { title: 'Host / Hostess', skills: ['Customer service', 'Reservations'] },
    { title: 'Food Runner', base: true },
    { title: 'Busser', base: true },
    { title: 'Dishwasher', skills: ['Dishwashing', 'Cleaning / housekeeping'] },
    { title: 'Barista', skills: ['Barista / coffee preparation'] },
    { title: 'Bartender', skills: ['Bartending'], credentials: ['tabc'], heldTitle: /bartend/i },
  ],
  Warehouse: [
    { title: 'Warehouse Associate', base: true },
    { title: 'Picker / Packer', skills: ['Picking and packing'] },
    { title: 'Material Handler', base: true },
    { title: 'Shipping and Receiving Clerk', skills: ['Shipping and receiving'] },
    { title: 'Inventory Associate', skills: ['Inventory management'] },
    { title: 'Package Handler', skills: ['Package handling', 'Physical stamina / lifting'] },
    { title: 'Forklift Operator', credentials: ['forklift'], heldTitle: /forklift/i },
  ],
  'Customer Service': [
    { title: 'Customer Service Representative', base: true },
    { title: 'Call Center Representative', skills: ['Phone etiquette'] },
    { title: 'Customer Support Associate', base: true },
    { title: 'Front Desk Associate', skills: ['Front desk / reception'] },
    { title: 'Client Services Associate', skills: ['Communication'] },
    { title: 'Technical Support Representative', skills: ['IT support'] },
  ],
  Internships: [], // built from field of study in `internshipTitles`
  Office: [
    { title: 'Office Assistant', base: true },
    { title: 'Administrative Assistant', base: true },
    { title: 'Receptionist', skills: ['Front desk / reception', 'Phone etiquette'] },
    { title: 'Data Entry Clerk', skills: ['Data entry', 'Microsoft Excel'] },
    { title: 'File Clerk', skills: ['Filing and record keeping'] },
    { title: 'Scheduling Coordinator', skills: ['Scheduling'] },
    { title: 'Bookkeeping Assistant', skills: ['Bookkeeping'] },
  ],
  Healthcare: [
    { title: 'Patient Care Assistant', skills: ['Patient care', 'Elder care'] },
    { title: 'Medical Receptionist', skills: ['Front desk / reception', 'Scheduling', 'Medical terminology', 'Electronic health records'] },
    { title: 'Dietary Aide', skills: ['Food preparation', 'Food safety'] },
    { title: 'Patient Transporter', base: true },
    { title: 'Caregiver', skills: ['Elder care', 'Patient care'] },
    { title: 'Pharmacy Clerk', skills: ['Pharmacy operations', 'Cash handling'] },
    { title: 'Certified Nursing Assistant (CNA)', credentials: ['cna'], heldTitle: /\bcna\b|nursing assistant/i },
    { title: 'Home Health Aide', credentials: ['hha', 'cna'], heldTitle: /home health/i },
    { title: 'Medical Assistant', credentials: ['cma'], heldTitle: /medical assistant/i },
    { title: 'Pharmacy Technician', credentials: ['pharm_tech'], heldTitle: /pharmacy tech/i },
    { title: 'Phlebotomist', credentials: ['phlebotomy'], heldTitle: /phlebotom/i },
    { title: 'EMT', credentials: ['emt'], heldTitle: /\bemt\b/i },
  ],
  Security: [
    { title: 'Loss Prevention Associate', base: true },
    { title: 'Security Officer', credentials: ['security_license'], heldTitle: /security|guard/i },
    { title: 'Security Dispatcher', skills: ['Surveillance / CCTV', 'Incident reporting'] },
    { title: 'Access Control Officer', credentials: ['security_license'], heldTitle: /security|guard/i },
  ],
  'Skilled Trades': [
    { title: 'General Laborer', base: true },
    { title: 'Maintenance Technician', skills: ['Building maintenance', 'Hand and power tools'] },
    { title: 'Construction Laborer', skills: ['Construction'] },
    { title: 'Apprentice Electrician', skills: ['Electrical work'] },
    { title: "Plumber's Helper", skills: ['Plumbing'] },
    { title: 'Carpenter Helper', skills: ['Carpentry'] },
    { title: 'Welder', skills: ['Welding'] },
    { title: 'HVAC Technician Helper', skills: ['HVAC'] },
    { title: 'Lube Technician', skills: ['Automotive repair'] },
    { title: 'Landscaper', skills: ['Building maintenance'] },
  ],
  Technology: [
    { title: 'IT Support Technician', skills: ['IT support', 'Operating systems', 'Networking'] },
    { title: 'Help Desk Technician', skills: ['IT support'] },
    { title: 'Junior Software Developer', skills: ['Python', 'Java', 'JavaScript', 'TypeScript', 'C / C++ / C#'] },
    { title: 'Web Developer', skills: ['HTML / CSS', 'JavaScript'] },
    { title: 'Data Analyst', skills: ['Data analysis', 'SQL / databases', 'Microsoft Excel'] },
    { title: 'QA Tester', skills: ['Python', 'Java', 'JavaScript', 'Attention to detail'] },
    { title: 'Junior Cloud Engineer', skills: ['Cloud platforms'] },
    { title: 'Graphic Designer', skills: ['Graphic design'] },
  ],
  Government: [
    { title: 'Administrative Aide', base: true },
    { title: 'Clerk', skills: ['Filing and record keeping', 'Data entry'] },
    { title: 'Program Assistant', base: true },
    { title: 'Parks and Recreation Aide', skills: ['Youth programs', 'Lifeguarding / water safety', 'Building maintenance'] },
    { title: 'Library Aide', skills: ['Filing and record keeping', 'Organization'] },
    { title: 'Postal Clerk', skills: ['Package handling'] },
  ],
  Education: [
    { title: 'Tutor', skills: ['Tutoring'] },
    { title: "Teacher's Aide", base: true },
    { title: 'Camp Counselor', skills: ['Youth programs', 'Childcare', 'Coaching'] },
    { title: 'Childcare Assistant', skills: ['Childcare'] },
    { title: 'After-School Program Aide', skills: ['Youth programs', 'Childcare', 'Tutoring'] },
    { title: 'Youth Sports Coach', skills: ['Coaching'] },
    { title: 'Substitute Teacher', credentials: ['teaching_cert'], needsDegree: true },
  ],
  Hospitality: [
    { title: 'Front Desk Agent', skills: ['Front desk / reception', 'Hotel operations'] },
    { title: 'Guest Services Associate', base: true },
    { title: 'Housekeeper', skills: ['Cleaning / housekeeping'] },
    { title: 'Banquet Server', skills: ['Table service', 'Catering'] },
    { title: 'Event Staff', skills: ['Event setup and support'] },
    { title: 'Lifeguard', credentials: ['lifeguard'], heldTitle: /lifeguard/i },
    { title: 'Valet Attendant', credentials: ['drivers_license'] },
  ],
  Delivery: [
    { title: 'Delivery Driver', credentials: ['drivers_license', 'cdl'], heldTitle: /driver/i },
    { title: 'Courier', credentials: ['drivers_license', 'cdl'], heldTitle: /courier|driver/i },
    { title: 'Package Handler', base: true },
    { title: 'Delivery Helper', base: true },
    { title: 'Food Delivery Driver', credentials: ['drivers_license'], skills: ['Food delivery apps'] },
    { title: 'CDL Driver', credentials: ['cdl'] },
  ],
  Other: [
    { title: 'General Associate', base: true },
    { title: 'Seasonal Associate', base: true },
    { title: 'Event Staff', base: true },
  ],
}

function add(scores: Map<JobCategory, { raw: number; reasons: string[] }>, w: Weights, reason: string, mult = 1) {
  for (const [cat, v] of Object.entries(w) as [JobCategory, number][]) {
    if (!v) continue
    const cur = scores.get(cat) ?? { raw: 0, reasons: [] }
    cur.raw += v * mult
    if (!cur.reasons.includes(reason) && cur.reasons.length < 6) cur.reasons.push(reason)
    scores.set(cat, cur)
  }
}

export function scoreCategories(
  resume: ResumeData,
  skills: DetectedSkill[],
  creds: DetectedCredential[],
  applicant: ApplicantProfile,
): CategorySuggestion[] {
  const scores = new Map<JobCategory, { raw: number; reasons: string[] }>()

  for (const e of resume.experience) {
    for (const sig of TITLE_SIGNALS) {
      if (e.title && sig.re.test(e.title)) add(scores, sig.w, `Past role: ${e.title}`)
    }
    for (const sig of EMPLOYER_SIGNALS) {
      if (e.organization && sig.re.test(e.organization)) add(scores, sig.w, `Worked at ${e.organization}`, 0.6)
    }
  }
  for (const s of skills) {
    if (!s.def?.categories) continue
    // Named outright counts more than inferred from an activity.
    add(scores, s.def.categories, `Skill: ${s.name}`, s.direct ? 1.5 : 1)
  }
  for (const c of creds) {
    const def = CREDENTIALS.find((d) => d.id === c.id)
    if (def) add(scores, def.categories, `Credential: ${c.name}`)
  }
  const studyText = [...resume.education.map((e) => `${e.degree ?? ''} ${e.field ?? ''}`), ...resume.coursework].join(' ; ')
  for (const sig of FIELD_SIGNALS) {
    const m = studyText.match(sig.re)
    if (m) add(scores, sig.w, `Studies: ${m[0]}`)
  }
  if (applicant.flags.includes('college_student') || applicant.flags.includes('recent_graduate')) {
    add(scores, { Internships: 8 }, applicant.flags.includes('college_student') ? 'Currently in college' : 'Recent graduate')
  }

  const max = Math.max(0, ...[...scores.values()].map((s) => s.raw))
  let out: CategorySuggestion[] = [...scores.entries()]
    .filter(([cat, s]) => cat !== 'Other' && s.raw >= 3 && s.raw / max >= 0.2)
    .map(([category, s]) => ({ category, score: Math.round((100 * s.raw) / max), reasons: s.reasons }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  // Students and new grads should always see internships.
  const internReason = applicant.flags.includes('college_student') ? 'Currently in college' : applicant.flags.includes('recent_graduate') ? 'Recent graduate' : undefined
  if (internReason && !out.some((o) => o.category === 'Internships')) {
    const s = scores.get('Internships')!
    if (out.length >= 6) out.pop()
    out.push({ category: 'Internships', score: Math.max(20, Math.round((100 * s.raw) / max)), reasons: s.reasons })
  }

  // Entry-level applicants: add categories that commonly hire without experience.
  const entry: JobCategory[] = []
  if (applicant.flags.includes('high_school_student') || (!applicant.hasWorkExperience && !applicant.flags.includes('college_student') && !applicant.flags.includes('recent_graduate'))) {
    entry.push('Fast Food', 'Retail', 'Restaurants')
  }
  if (applicant.flags.includes('college_student') && !applicant.hasWorkExperience) entry.push('Retail', 'Customer Service')
  for (const cat of entry) {
    if (out.length >= 6 || out.some((o) => o.category === cat)) continue
    out.push({ category: cat, score: 20, reasons: ['Often hires entry-level applicants with no experience'], entryLevelSuggestion: true })
  }
  if (!out.length) out.push({ category: 'Other', score: 10, reasons: ['Not enough detail in the resume to match a specific category'] })
  return out
}

function titleAllowed(t: TitleDef, ctx: TitleContext): boolean {
  const needsProof = t.credentials || t.needsDegree
  if (!needsProof) return true
  if (t.credentials?.some((c) => ctx.credIds.has(c))) return true
  if (t.heldTitle && ctx.heldTitles.some((h) => t.heldTitle!.test(h))) return true
  if (t.needsDegree && ctx.hasDegree) return true
  return false
}

interface TitleContext {
  skillNames: Set<string>
  credIds: Set<string>
  heldTitles: string[]
  hasDegree: boolean
}

function internshipTitles(resume: ResumeData, cats: JobCategory[]): string[] {
  const out: string[] = []
  for (const e of resume.education) {
    if (e.field && e.field.length <= 40) out.push(`${titleCase(e.field)} Intern`)
  }
  const byCat: Partial<Record<JobCategory, string>> = {
    Technology: 'Software Engineering Intern',
    Office: 'Administrative Intern',
    Healthcare: 'Healthcare Intern',
    Government: 'Government Intern',
    Education: 'Education Intern',
    Retail: 'Retail Management Intern',
    Hospitality: 'Hospitality Intern',
    'Skilled Trades': 'Trades Apprentice',
    Warehouse: 'Operations Intern',
    'Customer Service': 'Customer Success Intern',
  }
  for (const c of cats) if (byCat[c]) out.push(byCat[c]!)
  out.push('Summer Intern', 'Student Intern')
  return out
}

function titleCase(s: string) {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

export interface Keywords {
  searchKeywords: string[]
  alternativeJobTitles: string[]
  searchFilters: string[]
}

export function buildKeywords(
  resume: ResumeData,
  skills: DetectedSkill[],
  creds: DetectedCredential[],
  applicant: ApplicantProfile,
  categories: CategorySuggestion[],
  extraTitles: string[] = [],
): Keywords {
  const ctx: TitleContext = {
    skillNames: new Set(skills.map((s) => s.name)),
    credIds: new Set(creds.map((c) => c.id)),
    heldTitles: resume.experience.filter((e) => e.kind !== 'volunteer').map((e) => e.title ?? '').filter(Boolean),
    hasDegree: resume.education.some((e) => ['bachelor', 'master', 'doctorate'].includes(e.level) && !e.inProgress),
  }
  const catNames = categories.map((c) => c.category)
  const titles: string[] = []
  const seen = new Set<string>()
  const push = (t: string) => {
    const k = t.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    titles.push(t)
  }

  categories.forEach((cat, rank) => {
    const limit = rank === 0 ? 6 : rank < 3 ? 3 : 2
    let picked = 0
    const defs = cat.category === 'Internships' ? internshipTitles(resume, catNames).map((title) => ({ title, base: true }) as TitleDef) : TITLES[cat.category]
    // Titles backed by a detected skill first, then the category's general titles, in list order.
    const scored = defs
      .map((t, i) => ({ t, i, backed: Boolean(t.skills?.some((s) => ctx.skillNames.has(s))) }))
      .filter(({ t, backed }) => titleAllowed(t, ctx) && (t.base || backed || (t.credentials && titleAllowed(t, ctx)) || (t.heldTitle && ctx.heldTitles.some((h) => t.heldTitle!.test(h)))))
    // Titles the applicant has a credential or matching past job for come first; otherwise keep list order.
    const proven = (t: TitleDef) => Boolean((t.credentials || t.needsDegree) && titleAllowed(t, ctx))
    scored.sort((a, b) => Number(proven(b.t)) - Number(proven(a.t)) || a.i - b.i)
    for (const { t } of scored) {
      if (picked >= limit) break
      if (seen.has(t.title.toLowerCase())) {
        continue
      }
      push(t.title)
      picked++
    }
  })
  for (const t of extraTitles) if (titles.length < 24) push(t)

  const held = ctx.heldTitles.map((h) => h.toLowerCase())
  titles.splice(20)
  const alternativeJobTitles = titles.filter((t) => !held.some((h) => h.includes(t.toLowerCase()) || t.toLowerCase().includes(h)))

  // Search keywords: titles they've held, then suggested titles, then their strongest hard skills.
  const searchKeywords: string[] = []
  const kwSeen = new Set<string>()
  const kw = (k: string) => {
    const key = k.toLowerCase()
    if (!k || kwSeen.has(key)) return
    kwSeen.add(key)
    searchKeywords.push(k)
  }
  titles.forEach(kw)
  ctx.heldTitles.filter((h) => h.split(/\s+/).length <= 5).forEach(kw)
  // Hard skills that matter most for the suggested categories make the best extra keywords.
  const catWeight = (s: DetectedSkill) =>
    categories.reduce((sum, c, i) => sum + (s.def?.categories?.[c.category] ?? 0) * (6 - Math.min(i, 5)), 0)
  skills
    .filter((s) => s.type === 'hard' && s.source !== 'ai' && !s.transferable)
    .sort((a, b) => catWeight(b) - catWeight(a) || Number(b.practiced) - Number(a.practiced))
    .slice(0, 5)
    .forEach((s) => kw(s.name.replace(/ \/ .*$/, '')))
  creds.slice(0, 2).forEach((c) => kw(c.name))

  const filters: string[] = []
  const f = applicant.flags
  if (f.includes('high_school_student')) filters.push('Part time', 'Entry level', 'No experience required', 'Flexible schedule')
  if (f.includes('college_student')) filters.push('Internship', 'Part time', 'Entry level')
  if (f.includes('recent_graduate')) filters.push('Entry level', 'New grad')
  if (f.includes('no_work_experience')) filters.push('No experience required', 'Entry level')

  return { searchKeywords, alternativeJobTitles, searchFilters: [...new Set(filters)] }
}

/** Titles that would claim a credential the resume doesn't show. Used to filter AI suggestions. */
export const CREDENTIAL_TITLE_RE =
  /\b(certified|licensed|registered|cna|lpn|rn|emt|paramedic|cdl|pharmacy technician|medical assistant|phlebotomist|nurse|journeyman|master electrician|electrician(?! helper| apprentice)|armed|security officer|attorney|lawyer|cpa|teacher(?!'s aide))\b/i
