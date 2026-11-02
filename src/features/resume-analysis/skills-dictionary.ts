/**
 * Skill dictionary for rule-based detection.
 *
 * Each entry lists phrases that must appear in the resume for the skill to be
 * reported. `infer` phrases are activities that plainly demonstrate the skill
 * (e.g. "operated the cash register" → Cash handling); they are only used for
 * transferable skills, and the matching resume line is returned as evidence.
 *
 * `categories` weights say how strongly the skill points at a job category.
 */
import type { JobCategory, SkillType } from './types'

export interface SkillDef {
  name: string
  type: SkillType
  transferable?: boolean
  /** Phrases that name the skill directly. Matched case-insensitively on word boundaries. Regex syntax allowed. */
  terms: string[]
  /** Activities that demonstrate the skill (transferable skills only). */
  infer?: string[]
  categories?: Partial<Record<JobCategory, number>>
}

export const SKILLS: SkillDef[] = [
  // ── Transferable skills ────────────────────────────────────────────────
  {
    name: 'Customer service',
    type: 'soft',
    transferable: true,
    terms: ['customer service', 'customer support', 'guest service(?:s)?', 'client service(?:s)?', 'customer care', 'customer relations', 'customer satisfaction', 'customer experience'],
    infer: ['(?:assisted|helped|served|greeted|welcomed|interacted with|supported|answered questions from) (?:customers|guests|clients|shoppers|visitors|patrons|members|families|residents|students|parents)', 'customer (?:questions|complaints|inquiries|concerns|needs|issues|requests)', 'took (?:customer )?orders', 'taking (?:customer )?orders', 'guests', 'patrons', 'shoppers', 'visitors', 'front of house'],
    categories: { 'Customer Service': 4, Retail: 2, 'Fast Food': 2, Restaurants: 2, Hospitality: 1 },
  },
  {
    name: 'Cash handling',
    type: 'hard',
    transferable: true,
    terms: ['cash handling', 'handling cash', 'handled cash', 'cash management', 'money handling', 'cash register', 'register operation'],
    infer: ['cashier', 'registers?', 'tills?', 'cash drawers?', 'balanced (?:the )?(?:drawer|register|till)', 'counted (?:cash|money|the drawer)', 'processed (?:cash|payments|transactions)', 'payments?', 'transactions?', 'pos', 'point of sale', 'making change', 'bank deposits?'],
    categories: { Retail: 3, 'Fast Food': 3, Restaurants: 2, Hospitality: 1 },
  },
  {
    name: 'Teamwork',
    type: 'soft',
    transferable: true,
    terms: ['teamwork', 'team work', 'team player', 'team-oriented', 'collaboration', 'collaborative', 'collaborated', 'collaborating', 'works well with others', 'work well with others'],
    infer: ['team members?', 'with (?:a |my )?team', 'crew', 'teammates?', 'worked with', 'alongside', 'group projects?', 'varsity', 'jv', 'band', 'orchestra', 'choir', 'team'],
    categories: { 'Fast Food': 1, Warehouse: 1, Restaurants: 1 },
  },
  {
    name: 'Communication',
    type: 'soft',
    transferable: true,
    terms: ['communication', 'communicat(?:e|ed|ing|or)', 'verbal communication', 'written communication', 'interpersonal'],
    infer: ['answered (?:phones?|calls|questions)', 'phone calls?', 'presented', 'presentations?', 'explained', 'public speaking', 'spoke', 'wrote', 'debate', 'speech', 'translated', 'interpreted'],
    categories: { 'Customer Service': 1, Office: 1 },
  },
  {
    name: 'Leadership',
    type: 'soft',
    transferable: true,
    terms: ['leadership', 'team lead(?:er)?', 'shift lead(?:er)?', 'led', 'lead(?:s|ing)? (?:a |the )?(?:team|group|crew|staff|shift|club|project)'],
    infer: ['supervis(?:ed|ing|or)', 'managed (?:a |the )?(?:team|staff|crew|shift|store|employees|volunteers)', 'trained (?:new )?(?:employees|staff|team members|crew|hires|volunteers)', 'trained new', 'training new', 'mentor(?:ed|ing)?', 'captain', 'president', 'vice president', 'chair(?:person|man|woman)?', 'key ?holder', 'assistant manager', 'shift manager', 'store manager', 'head counselor', 'founded'],
    categories: {},
  },
  {
    name: 'Problem-solving',
    type: 'soft',
    transferable: true,
    terms: ['problem[- ]solving', 'problem solver', 'solve problems', 'solved problems', 'critical thinking', 'troubleshoot(?:ing|ed)?', 'analytical'],
    infer: ['resolv(?:ed|e|ing) (?:customer )?(?:issues|complaints|problems|concerns|conflicts|tickets)', 'handled (?:customer )?complaints', 'fixed', 'debugg(?:ed|ing)', 'diagnos(?:ed|ing)', 'repaired', 'found (?:a )?solutions?'],
    categories: {},
  },
  {
    name: 'Time management',
    type: 'soft',
    transferable: true,
    terms: ['time management', 'time-management', 'manage(?:d)? (?:my )?time', 'punctual(?:ity)?', 'meet(?:ing)? deadlines', 'met deadlines', 'deadline-driven', 'prioritiz(?:e|ed|ing|ation)', 'organized and punctual'],
    infer: ['while (?:attending|maintaining|taking|enrolled|carrying)', 'balanced (?:school|work|classes|academics)', 'balancing (?:school|work|classes|academics)', 'deadlines?', 'on[- ]time', 'fast[- ]paced', 'full[- ]time student', 'part[- ]time while'],
    categories: {},
  },
  {
    name: 'Multitasking',
    type: 'soft',
    transferable: true,
    terms: ['multi-?task(?:ing|ed|er)?', 'juggl(?:e|ed|ing) multiple'],
    infer: ['fast[- ]paced', 'high[- ]volume', 'busy (?:restaurant|store|environment|kitchen)', 'rush (?:hours?|periods?)'],
    categories: { 'Fast Food': 1, Restaurants: 1 },
  },
  {
    name: 'Working under pressure',
    type: 'soft',
    transferable: true,
    terms: ['work(?:ing|ed)? under pressure', 'calm under pressure', 'stress management', 'high[- ]pressure'],
    infer: ['fast[- ]paced', 'high[- ]volume', 'rush (?:hours?|periods?)', 'peak (?:hours|times|periods)'],
    categories: {},
  },
  {
    name: 'Attention to detail',
    type: 'soft',
    transferable: true,
    terms: ['attention to detail', 'detail[- ]oriented', 'accuracy', 'accurate', 'meticulous', 'precise'],
    infer: ['proofread', 'double-checked', 'quality (?:control|checks|assurance)', 'inventory counts?', 'audited'],
    categories: { Office: 1, Warehouse: 1 },
  },
  {
    name: 'Organization',
    type: 'soft',
    transferable: true,
    terms: ['organization(?:al)? skills', 'organized', 'organizing', 'well[- ]organized', 'organizational'],
    infer: ['filing', 'scheduling', 'coordinat(?:ed|ing)', 'planned', 'kept records', 'record[- ]keeping', 'arranged', 'sorted'],
    categories: { Office: 1 },
  },
  {
    name: 'Conflict resolution',
    type: 'soft',
    transferable: true,
    terms: ['conflict resolution', 'de-?escalat(?:e|ed|ion|ing)', 'resolv(?:ed|e|ing) conflicts?', 'mediat(?:e|ed|ion|ing)'],
    infer: ['handled (?:customer )?complaints', 'resolv(?:ed|e|ing) (?:customer )?complaints', 'difficult customers'],
    categories: { 'Customer Service': 1, Security: 1 },
  },
  {
    name: 'Training others',
    type: 'soft',
    transferable: true,
    terms: ['trained (?:new )?(?:employees|staff|team members|crew|hires|volunteers|students|peers|servers|cashiers|associates|members)', 'trained new', 'training new', 'onboard(?:ed|ing) new', 'mentor(?:ed|ing)', 'tutor(?:ed|ing)', 'coached', 'coaching'],
    categories: { Education: 1 },
  },
  {
    name: 'Following safety procedures',
    type: 'hard',
    transferable: true,
    terms: ['safety (?:procedures|protocols|standards|guidelines|regulations)', 'osha', 'workplace safety', 'safety compliance', 'followed safety'],
    infer: ['sanitation', 'sanitiz(?:ed|ing)', 'health code', 'ppe', 'lockout', 'hazard'],
    categories: { Warehouse: 2, 'Skilled Trades': 2, Healthcare: 1 },
  },
  {
    name: 'Physical stamina / lifting',
    type: 'hard',
    transferable: true,
    terms: ['lift(?:ing)? (?:up to )?\\d{2,3} ?(?:lbs?|pounds)', 'heavy lifting', 'physical stamina', 'stand(?:ing)? for (?:long periods|extended periods|\\d+ hours)'],
    infer: ['unload(?:ed|ing)? (?:trucks|shipments|deliveries)', 'load(?:ed|ing)? (?:trucks|pallets)', 'carried', 'moved (?:heavy|furniture|boxes)'],
    categories: { Warehouse: 3, 'Skilled Trades': 2, Delivery: 1 },
  },
  {
    name: 'Bilingual',
    type: 'hard',
    transferable: true,
    // Languages listed in a Languages section are added in skills.ts; here only explicit fluency wording counts.
    terms: ['bilingual', 'trilingual', 'multilingual', '(?:fluent|native|proficient|conversational) (?:in )?(?:spanish|french|english|portuguese|haitian creole|creole|mandarin|chinese|cantonese|vietnamese|arabic|tagalog|korean|german|italian|russian|japanese|hindi|polish|american sign language)', '(?:spanish|french|portuguese|haitian creole|creole|mandarin|chinese|vietnamese|arabic|tagalog|korean|german|italian|russian|japanese|hindi) \\((?:fluent|native|conversational|proficient)\\)'],
    categories: { 'Customer Service': 1, Healthcare: 1, Education: 1, Government: 1 },
  },

  // ── Soft skills (not tracked as transferable) ─────────────────────────
  { name: 'Adaptability', type: 'soft', terms: ['adaptab(?:le|ility)', 'flexib(?:le|ility)', 'adapt(?:ed)? quickly', 'versatile'] },
  { name: 'Dependability', type: 'soft', terms: ['dependab(?:le|ility)', 'reliab(?:le|ility)', 'trustworthy', 'responsible', 'perfect attendance'] },
  { name: 'Work ethic', type: 'soft', terms: ['work ethic', 'hard[- ]working', 'hardworking', 'dedicated', 'diligent', 'self[- ]motivated', 'motivated', 'driven', 'initiative'] },
  { name: 'Fast learner', type: 'soft', terms: ['fast learner', 'quick learner', 'learn(?:s)? quickly', 'eager to learn', 'quick to learn'] },
  { name: 'Positive attitude', type: 'soft', terms: ['positive attitude', 'friendly', 'enthusiastic', 'upbeat', 'courteous', 'professional demeanor', 'cheerful'] },
  { name: 'Creativity', type: 'soft', terms: ['creativ(?:e|ity)', 'innovative', 'artistic'] },
  { name: 'Empathy', type: 'soft', terms: ['empath(?:y|etic)', 'compassion(?:ate)?', 'patien(?:t|ce) with', 'caring'] },
  { name: 'Interpersonal skills', type: 'soft', terms: ['interpersonal', 'people skills', 'relationship[- ]building', 'rapport'] },
  { name: 'Independence', type: 'soft', terms: ['work(?:s|ed)? independently', 'independent(?:ly)?', 'minimal supervision', 'self[- ]starter'] },

  // ── Food service ──────────────────────────────────────────────────────
  { name: 'Food preparation', type: 'hard', terms: ['food prep(?:aration)?', 'prepar(?:ed|ing|e) (?:food|meals|ingredients|orders|sandwiches|salads|pizzas?)', 'prep cook', 'prepped', 'meal prep'], categories: { 'Fast Food': 3, Restaurants: 3 } },
  { name: 'Food safety', type: 'hard', terms: ['food safety', 'food handl(?:er|ing)', 'servsafe', 'safe food handling', 'haccp', 'food sanitation'], categories: { 'Fast Food': 2, Restaurants: 2, Hospitality: 1, Healthcare: 1 } },
  { name: 'Cooking', type: 'hard', terms: ['cook(?:ed|ing)?', 'grill(?:ed|ing)?', 'fry(?:ing)?', 'fryer', 'line cook', 'short order', 'kitchen (?:prep|staff|assistant|line)'], categories: { Restaurants: 3, 'Fast Food': 2 } },
  { name: 'Baking', type: 'hard', terms: ['bak(?:ed|ing|er|ery)', 'pastr(?:y|ies)', 'cake decorating'], categories: { Restaurants: 2, Retail: 1 } },
  { name: 'Table service', type: 'hard', terms: ['table service', 'serv(?:er|ing) (?:tables|food|customers|guests)', 'waited tables', 'wait staff', 'waitress', 'waiter', 'food runner', 'bussing', 'busser', 'bussed tables'], categories: { Restaurants: 3, Hospitality: 2 } },
  { name: 'Barista / coffee preparation', type: 'hard', terms: ['barista', 'espresso', 'latte', 'coffee drinks', 'coffee'], categories: { Restaurants: 2, 'Fast Food': 2 } },
  { name: 'Bartending', type: 'hard', terms: ['bartend(?:er|ing)', 'mixolog(?:y|ist)', 'cocktails'], categories: { Restaurants: 2, Hospitality: 2 } },
  { name: 'Drive-thru service', type: 'hard', terms: ['drive[- ]?thru', 'drive[- ]through', 'headset'], categories: { 'Fast Food': 3 } },
  { name: 'Dishwashing', type: 'hard', terms: ['dishwash(?:er|ing)', 'washed dishes', 'dish ?room'], categories: { Restaurants: 2, Hospitality: 1 } },
  { name: 'Catering', type: 'hard', terms: ['cater(?:ing|ed|er)', 'banquets?'], categories: { Hospitality: 2, Restaurants: 2 } },

  // ── Retail / sales ────────────────────────────────────────────────────
  { name: 'POS systems', type: 'hard', terms: ['pos', 'point of sale', 'pos systems?', 'square pos', 'clover', 'toast pos', 'ncr', 'aloha'], categories: { Retail: 2, 'Fast Food': 2, Restaurants: 2 } },
  { name: 'Sales', type: 'hard', terms: ['sales', 'sold', 'selling', 'upsell(?:ing|ed)?', 'cross-?sell(?:ing)?', 'sales goals?', 'sales targets?', 'commission'], categories: { Retail: 3, 'Customer Service': 1 } },
  { name: 'Merchandising', type: 'hard', terms: ['merchandis(?:ing|ed|er)', 'visual displays?', 'product displays?', 'planograms?', 'set up displays', 'built displays'], categories: { Retail: 3 } },
  { name: 'Stocking shelves', type: 'hard', terms: ['stock(?:ed|ing)? (?:shelves|products|merchandise|items|inventory)', 'restock(?:ed|ing)?', 'stocker', 'replenish(?:ed|ing)?', 'facing', 'shelving'], categories: { Retail: 2, Warehouse: 2 } },
  { name: 'Inventory management', type: 'hard', terms: ['inventory', 'stock counts?', 'cycle counts?', 'stock levels'], categories: { Retail: 2, Warehouse: 3, Office: 1 } },
  { name: 'Returns and exchanges', type: 'hard', terms: ['returns', 'exchanges', 'refunds'], categories: { Retail: 2, 'Customer Service': 2 } },
  { name: 'Opening and closing procedures', type: 'hard', terms: ['open(?:ed|ing)? and clos(?:ed|ing)', 'closing procedures', 'opening procedures', 'closing duties', 'closed the store', 'opened the store'], categories: { Retail: 1, 'Fast Food': 1, Restaurants: 1 } },

  // ── Warehouse / logistics ─────────────────────────────────────────────
  { name: 'Forklift operation', type: 'hard', terms: ['forklift', 'fork lift', 'reach truck', 'order picker', 'osha forklift'], categories: { Warehouse: 4 } },
  { name: 'Pallet jack', type: 'hard', terms: ['pallet jacks?', 'electric pallet', 'pallets'], categories: { Warehouse: 3 } },
  { name: 'Picking and packing', type: 'hard', terms: ['pick(?:ing|ed)? and pack(?:ing|ed)?', 'order picking', 'order fulfillment', 'fulfill(?:ed|ing)? orders', 'packing orders', 'packed orders', 'picker', 'packer'], categories: { Warehouse: 4, Delivery: 1 } },
  { name: 'Shipping and receiving', type: 'hard', terms: ['shipping and receiving', 'shipping', 'receiving', 'shipments', 'unloaded trucks', 'loading dock'], categories: { Warehouse: 3, Delivery: 1 } },
  { name: 'RF scanners', type: 'hard', terms: ['rf scanners?', 'scanner guns?', 'handheld scanners?', 'barcode scann(?:er|ers|ing)', 'scanned (?:items|packages)'], categories: { Warehouse: 2, Retail: 1 } },
  { name: 'Package handling', type: 'hard', terms: ['package handl(?:er|ing)', 'packages', 'parcels', 'sorted (?:packages|mail)', 'sorting'], categories: { Delivery: 2, Warehouse: 2 } },

  // ── Office / admin ────────────────────────────────────────────────────
  { name: 'Microsoft Office', type: 'hard', terms: ['microsoft office', 'ms office', 'office 365', 'microsoft 365'], categories: { Office: 3, Government: 1 } },
  { name: 'Microsoft Excel', type: 'hard', terms: ['excel', 'spreadsheets?', 'pivot tables?', 'vlookup'], categories: { Office: 3, Technology: 1 } },
  { name: 'Microsoft Word', type: 'hard', terms: ['microsoft word', 'ms word', 'word processing'], categories: { Office: 2 } },
  { name: 'PowerPoint', type: 'hard', terms: ['powerpoint', 'power point', 'slide decks?'], categories: { Office: 2 } },
  { name: 'Outlook / email management', type: 'hard', terms: ['outlook', 'email management', 'managed (?:the )?inbox'], categories: { Office: 2 } },
  { name: 'Google Workspace', type: 'hard', terms: ['google workspace', 'g suite', 'google docs', 'google sheets', 'google slides', 'google drive'], categories: { Office: 2 } },
  { name: 'Data entry', type: 'hard', terms: ['data entry', 'entered data', 'entering data', 'input data', 'typing', 'typed', '\\d{2,3} ?wpm', 'words per minute'], categories: { Office: 4, Government: 1, Healthcare: 1 } },
  { name: 'Filing and record keeping', type: 'hard', terms: ['filing', 'record[- ]keeping', 'kept records', 'maintained records', 'records management', 'documentation'], categories: { Office: 3, Government: 2, Healthcare: 1 } },
  { name: 'Scheduling', type: 'hard', terms: ['appointment scheduling', 'scheduling appointments', 'scheduled appointments', 'booked appointments', 'appointment setting', 'calendar management', 'managed calendars?'], categories: { Office: 3, Healthcare: 1 } },
  { name: 'Phone etiquette', type: 'hard', terms: ['phone etiquette', 'multi-?line phones?', 'answered (?:phones?|calls)', 'answering (?:phones?|calls)', 'inbound calls', 'outbound calls', 'call center'], categories: { 'Customer Service': 3, Office: 2 } },
  { name: 'Front desk / reception', type: 'hard', terms: ['front desk', 'reception(?:ist)?', 'greeted visitors', 'check-?in', 'check-?out', 'front office'], categories: { Office: 2, Hospitality: 3, Healthcare: 1 } },
  { name: 'Bookkeeping', type: 'hard', terms: ['bookkeeping', 'accounts (?:payable|receivable)', 'invoic(?:es|ing)', 'quickbooks', 'payroll', 'reconcil(?:ed|ing|iation)'], categories: { Office: 3 } },

  // ── Healthcare ────────────────────────────────────────────────────────
  { name: 'Patient care', type: 'hard', terms: ['patient care', 'patients', 'resident care', 'activities of daily living', '\\badls?\\b', 'bedside'], categories: { Healthcare: 4 } },
  { name: 'Vital signs', type: 'hard', terms: ['vital signs', 'vitals', 'blood pressure', 'took temperatures'], categories: { Healthcare: 4 } },
  { name: 'Medical terminology', type: 'hard', terms: ['medical terminology'], categories: { Healthcare: 3, Office: 1 } },
  { name: 'HIPAA', type: 'hard', terms: ['hipaa', 'patient confidentiality', 'protected health information'], categories: { Healthcare: 3 } },
  { name: 'Electronic health records', type: 'hard', terms: ['electronic (?:health|medical) records?', '\\behr\\b', '\\bemr\\b', 'epic', 'cerner'], categories: { Healthcare: 3, Office: 1 } },
  { name: 'Phlebotomy', type: 'hard', terms: ['phlebotomy', 'venipuncture', 'blood draws?', 'drew blood'], categories: { Healthcare: 4 } },
  { name: 'Elder care', type: 'hard', terms: ['elder(?:ly)? care', 'senior care', 'assisted living', 'nursing home', 'caregiv(?:er|ing)', 'home health'], categories: { Healthcare: 4 } },
  { name: 'Childcare', type: 'hard', terms: ['child ?care', 'babysit(?:ting|ter|s)?', 'babysat', 'nanny', 'daycare', 'cared for children', 'watched children', 'supervised children'], categories: { Education: 3, Healthcare: 1 } },
  { name: 'Pharmacy operations', type: 'hard', terms: ['pharmacy', 'prescriptions?', 'medication counting'], categories: { Healthcare: 3, Retail: 1 } },

  // ── Security ──────────────────────────────────────────────────────────
  { name: 'Security patrol', type: 'hard', terms: ['patrol(?:led|ling|ed|ing|s)?', 'security rounds', 'access control', 'monitored (?:entrances|premises|property)', 'loss prevention', 'asset protection'], categories: { Security: 4, Retail: 1 } },
  { name: 'Surveillance / CCTV', type: 'hard', terms: ['cctv', 'surveillance', 'security cameras', 'video monitoring', 'monitored cameras'], categories: { Security: 3 } },
  { name: 'Incident reporting', type: 'hard', terms: ['incident reports?', 'report writing', 'wrote reports', 'documented incidents'], categories: { Security: 3, Government: 1 } },
  { name: 'Emergency response', type: 'hard', terms: ['emergency response', 'emergency procedures', 'evacuation', 'first responder'], categories: { Security: 2, Healthcare: 2 } },
  { name: 'Lifeguarding / water safety', type: 'hard', terms: ['lifeguard(?:ing)?', 'water safety', 'pool safety'], categories: { Hospitality: 1, Security: 1, Government: 1 } },

  // ── Skilled trades ────────────────────────────────────────────────────
  { name: 'Hand and power tools', type: 'hard', terms: ['power tools', 'hand tools', 'tool use', 'table saws?', 'circular saws?'], categories: { 'Skilled Trades': 3 } },
  { name: 'Carpentry', type: 'hard', terms: ['carpent(?:ry|er)', 'framing', 'woodwork(?:ing)?', 'cabinetry', 'drywall'], categories: { 'Skilled Trades': 4 } },
  { name: 'Electrical work', type: 'hard', terms: ['electrical', 'wiring', 'electrician', 'circuits'], categories: { 'Skilled Trades': 4 } },
  { name: 'Plumbing', type: 'hard', terms: ['plumbing', 'plumber', 'pipefitting', 'pipe fitting'], categories: { 'Skilled Trades': 4 } },
  { name: 'Welding', type: 'hard', terms: ['weld(?:ing|er|ed)', 'mig', 'tig', 'fabrication', 'metal ?work'], categories: { 'Skilled Trades': 4 } },
  { name: 'HVAC', type: 'hard', terms: ['hvac', 'heating and (?:air|cooling)', 'air conditioning', 'refrigeration'], categories: { 'Skilled Trades': 4 } },
  { name: 'Automotive repair', type: 'hard', terms: ['automotive', 'auto repair', 'mechanic', 'oil changes?', 'tire (?:changes|rotation)', 'brakes', 'engine repair', 'small engine'], categories: { 'Skilled Trades': 4 } },
  { name: 'Construction', type: 'hard', terms: ['construction', 'job ?sites?', 'concrete', 'roofing', 'demolition', 'house painting', 'masonry'], categories: { 'Skilled Trades': 3 } },
  { name: 'Blueprint reading', type: 'hard', terms: ['blueprints?', 'schematics', 'technical drawings'], categories: { 'Skilled Trades': 3 } },
  { name: 'Building maintenance', type: 'hard', terms: ['maintenance', 'repairs', 'facilities', 'janitorial', 'custodial', 'groundskeeping', 'landscaping', 'lawn care', 'mowing'], categories: { 'Skilled Trades': 2, Hospitality: 1, Government: 1 } },
  { name: 'Cleaning / housekeeping', type: 'hard', terms: ['clean(?:ed|ing)', 'housekeep(?:ing|er)', 'sanitiz(?:ed|ing)', 'janitorial', 'custodial', 'laundry'], categories: { Hospitality: 3, 'Fast Food': 1, Healthcare: 1 } },

  // ── Technology ────────────────────────────────────────────────────────
  { name: 'Python', type: 'hard', terms: ['python'], categories: { Technology: 4 } },
  { name: 'Java', type: 'hard', terms: ['java(?!script)'], categories: { Technology: 4 } },
  { name: 'JavaScript', type: 'hard', terms: ['javascript', '\\bjs\\b', 'node\\.?js', 'react(?:\\.js)?', 'vue(?:\\.js)?', 'angular', 'next\\.js'], categories: { Technology: 4 } },
  { name: 'TypeScript', type: 'hard', terms: ['typescript'], categories: { Technology: 4 } },
  { name: 'C / C++ / C#', type: 'hard', terms: ['c\\+\\+', 'c#', '\\bc programming\\b'], categories: { Technology: 4 } },
  { name: 'HTML / CSS', type: 'hard', terms: ['html5?', 'css3?', 'tailwind', 'web design', 'web development'], categories: { Technology: 3 } },
  { name: 'SQL / databases', type: 'hard', terms: ['sql', 'mysql', 'postgres(?:ql)?', 'sqlite', 'databases?', 'mongodb'], categories: { Technology: 4, Office: 1 } },
  { name: 'Git / version control', type: 'hard', terms: ['git', 'github', 'gitlab', 'version control'], categories: { Technology: 3 } },
  { name: 'Cloud platforms', type: 'hard', terms: ['aws', 'amazon web services', 'azure', 'google cloud', '\\bgcp\\b', 'docker', 'kubernetes'], categories: { Technology: 4 } },
  { name: 'IT support', type: 'hard', terms: ['it support', 'help ?desk', 'tech(?:nical)? support', 'troubleshoot(?:ing|ed)? (?:computers|hardware|software|network|devices)', 'computer repair', 'set up computers', 'imaging'], categories: { Technology: 4, 'Customer Service': 1 } },
  { name: 'Networking', type: 'hard', terms: ['networking (?:fundamentals|basics)', 'tcp/ip', 'routers', 'network administration', 'network setup', 'comptia network\\+'], categories: { Technology: 3 } },
  { name: 'Operating systems', type: 'hard', terms: ['windows (?:10|11|server)', 'mac ?os', 'linux', 'ubuntu', 'chromebooks?', 'ios', 'android'], categories: { Technology: 2 } },
  { name: 'Data analysis', type: 'hard', terms: ['data analysis', 'data analytics', 'analyzed data', 'tableau', 'power bi', 'statistics', '\\br programming\\b', 'pandas'], categories: { Technology: 3, Office: 1 } },
  { name: 'Machine learning / AI', type: 'hard', terms: ['machine learning', 'artificial intelligence', 'deep learning', 'neural networks?', 'llms?', 'tensorflow', 'pytorch'], categories: { Technology: 4 } },
  { name: 'Graphic design', type: 'hard', terms: ['graphic design', 'photoshop', 'illustrator', 'adobe creative (?:suite|cloud)', 'indesign', 'canva', 'figma'], categories: { Technology: 1, Office: 1 } },
  { name: 'Video editing', type: 'hard', terms: ['video editing', 'premiere pro', 'final cut', 'davinci resolve', 'capcut'], categories: { Technology: 1 } },
  { name: 'Social media', type: 'hard', terms: ['social media', 'instagram', 'tiktok', 'content creation', 'facebook pages?'], categories: { Office: 1, Retail: 1 } },

  // ── Education ─────────────────────────────────────────────────────────
  { name: 'Tutoring', type: 'hard', terms: ['tutor(?:ed|ing)?', 'homework help', 'peer tutor'], categories: { Education: 4 } },
  { name: 'Lesson planning', type: 'hard', terms: ['lesson plan(?:s|ning)?', 'curriculum', 'classroom management', 'instruction'], categories: { Education: 4 } },
  { name: 'Youth programs', type: 'hard', terms: ['camp counselor', 'summer camp', 'youth programs?', 'after-?school program', 'kids', 'children'], categories: { Education: 3 } },
  { name: 'Coaching', type: 'hard', terms: ['coach(?:ed|ing)?', 'assistant coach', 'referee(?:d|ing)?', 'umpire'], categories: { Education: 2 } },

  // ── Hospitality / events ──────────────────────────────────────────────
  { name: 'Event setup and support', type: 'hard', terms: ['event (?:setup|staff|planning|coordination)', 'events', 'set up (?:tables|chairs|events)', 'ushered', 'usher', 'ticketing', 'ticket (?:sales|taking|booth)'], categories: { Hospitality: 3, Other: 1 } },
  { name: 'Reservations', type: 'hard', terms: ['reservations', 'bookings', 'opentable', 'seated guests', 'seating'], categories: { Hospitality: 3, Restaurants: 2 } },
  { name: 'Hotel operations', type: 'hard', terms: ['hotel', 'resort', 'motel', 'guest rooms', 'concierge', 'bellhop', 'valet'], categories: { Hospitality: 4 } },

  // ── Delivery / driving ────────────────────────────────────────────────
  { name: 'Driving', type: 'hard', terms: ["driver'?s licen[cs]e", 'valid (?:driver|driving) licen[cs]e', 'clean driving record', 'delivery driver', 'safe driving', 'drove (?:a |the )?(?:van|truck|vehicle|route|company car)'], categories: { Delivery: 4 } },
  { name: 'Route planning / navigation', type: 'hard', terms: ['route planning', 'routes', 'navigation', 'gps', 'mapped routes'], categories: { Delivery: 3 } },
  { name: 'Food delivery apps', type: 'hard', terms: ['doordash', 'uber ?eats', 'grubhub', 'instacart', 'shipt', 'postmates', 'amazon flex'], categories: { Delivery: 4 } },
  { name: 'Delivery', type: 'hard', terms: ['deliver(?:ed|ing) (?:packages|food|orders|groceries|newspapers|mail|parcels|flowers|furniture)', 'deliveries', 'courier', 'food delivery', 'package delivery', 'delivery routes?', 'delivery driver'], categories: { Delivery: 3 } },

  // ── Government / public service ───────────────────────────────────────
  { name: 'Public service', type: 'hard', terms: ['public service', 'city of [a-z]+', 'county (?:government|office|clerk|commission|library|parks|courthouse)', 'state (?:agency|government|office)', 'federal (?:agency|government)', 'municipal', 'government', 'public library', 'parks and recreation', 'department of', 'city hall', 'courthouse', 'post office', 'usps'], categories: { Government: 3 } },
  { name: 'Research', type: 'hard', terms: ['research(?:ed|ing)?', 'literature review', 'lab work', 'laboratory'], categories: { Internships: 1, Technology: 1, Education: 1 } },
  { name: 'Writing', type: 'hard', terms: ['writing', 'wrote articles', 'copywriting', 'editor', 'newsletter', 'journalism', 'blog'], categories: { Office: 1 } },
  { name: 'Military service', type: 'hard', terms: ['army', 'navy', 'air force', 'marine corps', 'coast guard', 'national guard', 'jrotc', 'rotc', 'veteran'], categories: { Government: 3, Security: 2 } },
]

/**
 * Credentials. Reported only when written in the resume. Some job titles
 * (e.g. Certified Nursing Assistant) are only suggested when the matching
 * credential is present.
 */
export interface CredentialDef {
  id: string
  name: string
  terms: string[]
  categories: Partial<Record<JobCategory, number>>
}

export const CREDENTIALS: CredentialDef[] = [
  { id: 'cpr', name: 'CPR / First Aid', terms: ['cpr', 'first aid', 'bls', 'basic life support', '\\baed\\b'], categories: { Healthcare: 2, Education: 1, Security: 1 } },
  { id: 'food_handler', name: 'Food Handler / ServSafe', terms: ['servsafe', 'food handler', "food handler'?s (?:card|certificate|permit)", 'food manager certification', 'food safety certification'], categories: { 'Fast Food': 2, Restaurants: 2 } },
  { id: 'cna', name: 'Certified Nursing Assistant (CNA)', terms: ['\\bcna\\b', 'certified nursing assistant', 'nursing assistant certification'], categories: { Healthcare: 5 } },
  { id: 'hha', name: 'Home Health Aide (HHA)', terms: ['\\bhha\\b', 'home health aide'], categories: { Healthcare: 4 } },
  { id: 'cma', name: 'Medical Assistant certification', terms: ['\\bcma\\b', '\\bccma\\b', '\\brma\\b', 'certified medical assistant', 'registered medical assistant'], categories: { Healthcare: 5 } },
  { id: 'pharm_tech', name: 'Pharmacy Technician certification', terms: ['\\bcpht\\b', 'pharmacy technician (?:certification|license|certified)', 'certified pharmacy technician', 'ptcb'], categories: { Healthcare: 5 } },
  { id: 'phlebotomy', name: 'Phlebotomy certification', terms: ['phlebotomy (?:certification|certificate|technician)', '\\bcpt\\b certified phlebotomy'], categories: { Healthcare: 4 } },
  { id: 'emt', name: 'EMT', terms: ['\\bemt\\b', 'emergency medical technician'], categories: { Healthcare: 5, Security: 1 } },
  { id: 'rn', name: 'Nursing license (RN/LPN)', terms: ['\\brn\\b', '\\blpn\\b', 'registered nurse', 'licensed practical nurse'], categories: { Healthcare: 6 } },
  { id: 'security_license', name: 'Security officer license', terms: ['class d (?:security )?licen[cs]e', 'security (?:guard|officer) licen[cs]e', 'guard card', 'class g licen[cs]e', 'security licen[cs]e'], categories: { Security: 6 } },
  { id: 'forklift', name: 'Forklift certification', terms: ['forklift (?:certified|certification|license|operator certification)', 'certified forklift', 'osha forklift'], categories: { Warehouse: 4 } },
  { id: 'osha', name: 'OSHA safety training', terms: ['osha[- ]?(?:10|30)', 'osha (?:certified|certification|training)'], categories: { 'Skilled Trades': 3, Warehouse: 2 } },
  { id: 'cdl', name: "Commercial driver's license (CDL)", terms: ['\\bcdl\\b', "commercial driver'?s licen[cs]e"], categories: { Delivery: 5 } },
  { id: 'drivers_license', name: "Driver's license", terms: ["driver'?s licen[cs]e", 'valid (?:driver|driving) licen[cs]e', 'clean driving record', 'licensed driver'], categories: { Delivery: 2 } },
  { id: 'lifeguard', name: 'Lifeguard certification', terms: ['lifeguard (?:certified|certification|certificate)', 'red cross lifeguard', 'certified lifeguard'], categories: { Hospitality: 1, Government: 1 } },
  { id: 'comptia', name: 'CompTIA certification', terms: ['comptia', 'a\\+ certified', 'a\\+ certification', 'security\\+', 'network\\+'], categories: { Technology: 4 } },
  { id: 'cloud_cert', name: 'Cloud certification', terms: ['aws certified', 'azure fundamentals', 'az-900', 'google cloud certified'], categories: { Technology: 4 } },
  { id: 'microsoft_cert', name: 'Microsoft Office Specialist', terms: ['microsoft office specialist', '\\bmos\\b certif', 'mos certified'], categories: { Office: 3 } },
  { id: 'trade_cert', name: 'Trade certification / apprenticeship', terms: ['nccer', 'journeyman', 'apprenticeship', 'epa 608', 'ase certified', 'aws certified welder', 'welding certification'], categories: { 'Skilled Trades': 5 } },
  { id: 'teaching_cert', name: 'Teaching certificate', terms: ['teaching certificate', 'teacher certification', 'substitute (?:teaching )?(?:certificate|license)', 'paraprofessional certification', 'cda credential', 'child development associate'], categories: { Education: 4 } },
  { id: 'tabc', name: 'Alcohol server certification', terms: ['tabc', 'tips certified', 'tips certification', 'responsible vendor', 'alcohol server'], categories: { Restaurants: 2, Hospitality: 2 } },
]
