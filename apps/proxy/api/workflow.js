const {
  DEFAULT_LLM_MODEL,
  allowModel,
  authAndRateLimit,
  extractResponseOutputText,
  getOpenAIClient,
  getOpenAITimeoutMs,
  json,
  validateWorkflowSources,
  withTimeout
} = require('./_shared');
const {
  CLIENT_UPDATE_SCHEMA_VERSION,
  MAX_SECTION_UPDATES,
  UPDATE_SECTION_KEYS,
  normalizeClientUpdatePatch
} = require('./workflow-update-contract');

const workflowPrompts = {
  client_intake_baseline: [
    'You are CoachNotes Intake.',
    'Your job is to turn a messy bundle of client source material into a practical, coach-reviewable baseline.',
    'Do not pretend uncertain facts are current truth.',
    'Prefer concise, evidence-linked observations over long prose.',
    'Build a current working dashboard, not an exhaustive archive of every historical goal or action plan.',
    'Combine duplicate or overlapping goals, habits, barriers, and coach to-dos into one clear item instead of listing each mention separately.',
    'The overview/Snapshot is for quick human scanning: keep it brief, current, and distinct from the to-do lists below.',
    'Separate active constraints from historical context.',
    'Flag scope-of-practice concerns without diagnosing.',
    'Never invent dates, injuries, client preferences, program details, medications, or plans.',
    'If returning clientProfile.programWeek, it must mean curriculum week based on curriculumStartDate. Use clientProfile.trainingProgramWeek for the separate training program week based on programStartDate.',
    'If a detail is unclear, put it in missingInfo instead of assuming.',
    'Return valid JSON only. Do not wrap it in markdown.'
  ].join(' '),
  client_note_update: [
    'You are CoachNotes Update.',
    'Your job is to update an existing coach-reviewed client baseline from new source material.',
    'A newly imported source is not necessarily newer in the client history. Respect event chronology and source dates.',
    'Return only changed dashboard sections. Never return or reproduce the entire client baseline.',
    'Treat the current baseline as authoritative coach context, even if some fields are uncited.',
    'Do not remove or weaken coach-entered facts just because the new source does not mention them.',
    'Keep the dashboard concise and current. Do not let repeated historical mentions inflate the active lists.',
    'Combine duplicate or overlapping goals, habits, barriers, and coach to-dos instead of appending another similar item.',
    'The overview/Snapshot is for quick human scanning: keep it brief, current, and distinct from the to-do lists below.',
    'Only change sections when the new source clearly adds, updates, resolves, or contradicts something.',
    'When the new source conflicts with the baseline, preserve the baseline and add a confidence note or open loop unless the source clearly resolves the older point.',
    'If returning clientProfile.programWeek, it must mean curriculum week based on curriculumStartDate. Use clientProfile.trainingProgramWeek for the separate training program week based on programStartDate.',
    'Every new or changed claim should cite the new source_id when possible.',
    'Flag scope-of-practice concerns without diagnosing.',
    'Return valid JSON only. Do not wrap it in markdown.'
  ].join(' ')
};

const TIMELINE_ITEM_SCHEMA = {
  date: 'event date, date range, approximate date, or "unknown"',
  label: 'short event label',
  details: 'why this event matters for progress, trajectory, or recurring themes',
  evidenceIds: ['source_id']
};

const RADAR_ITEM_SCHEMA = {
  title: 'brief temporary situation',
  details: 'how this near-term situation may affect client capacity, adherence, or communication',
  category: 'acute_injury | family_situation | bereavement | vacation | work_travel | stressful_period | schedule_change | other',
  throughDate: 'YYYY-MM-DD only when an end date is supported by the source; otherwise empty',
  evidenceIds: ['source_id']
};

const RADAR_RULES = [
  '- radarItems is the coach\'s Keep on My Radar list: active, temporary, near-term client situations that may affect capacity or bandwidth for adherence or communication, or that should shape how the coach communicates.',
  '- Examples include acute injuries, acute family situations, bereavement, vacations, work travel, unusually stressful periods at work or home, and temporary schedule changes.',
  '- Radar items are context, not actions. Do not turn one into a coachTask unless the source also supports a specific action the coach needs to take.',
  '- Keep durable or chronic client facts in flags or the appropriate profile section, not radarItems. If a radar situation becomes chronic, remove it from radarItems and retain the durable context elsewhere when relevant.',
  '- Set throughDate only when the source supports a specific end date. Do not invent one.',
  '- On updates, remove radar items that the new evidence says have ended, been superseded, or become chronic. Also remove an item when its explicit throughDate is before current_date. Preserve active items with no supported end date until later evidence changes them.'
];

const TIMELINE_RULES = [
  '- Timeline is a curated progress history for coaches: show trajectory over time, preserve relevant historical context, and condense large histories into digestible milestones.',
  '- Timeline dates are client event dates, not automatically the source/import date. Use date_or_range only when the event appears to have happened on that source date or no more specific event date is supported.',
  '- If one source contains multiple dates for distinct important events, create separate timeline entries for those events and cite the same source_id as needed.',
  '- Include milestones, check-ins, program changes, setbacks, meaningful progress signals, decisions, and repeating themes that change the coach view of the client trajectory. Do not list every minor message.',
  '- If a date is approximate or unclear, keep it approximate or use "unknown" and explain the uncertainty in details or confidenceNotes. Do not fabricate exact dates.',
  '- Return timeline entries in chronological order from oldest to newest, with unknown dates after dated entries.'
];

const HISTORICAL_SOURCE_RULES = [
  '- Source order reflects import order, not client chronology. A newly imported source is not necessarily newer evidence and may describe much older events.',
  '- For a specific event, prefer an explicit event date in the source text over the source-level date_or_range. Otherwise use date_or_range as the best available chronology.',
  '- Current-state sections must reflect the latest supported client state. Older evidence may add context, but must not regress a newer snapshot, current status, active plan, active goal, radar item, or coach task.',
  '- Use historical sources to preserve meaningful trajectory in timeline, engagementNotes, progressTracking, programChanges, recurring thread sections, and durable profile facts when supported.',
  '- Do not reactivate a historical task, plan, constraint, or concern unless the source supports that it remains active as of current_date.',
  '- When chronology is ambiguous, preserve the coach-reviewed current state. Add a concise confidence note only when the ambiguity materially affects coaching decisions.'
];

const TAG_RULES = [
  '- suggestedTags are for quick client-list scanning and future search. Return 0-5 short, broad, coach-useful tags.',
  '- Order suggestedTags by usefulness for the client sidebar. The first 3 are the sidebar tags.',
  '- Do not use suggestedTags to repeat profile chips, curriculum/program/cohort labels, contraindications, diagnoses, or every flag. Those belong in their structured sections.',
  '- Prefer stable themes such as travel, accountability, training-consistency, nutrition-support, recovery, adherence-risk, or strength-focus when supported by source evidence.',
  '- Remove duplicate, overly specific, or one-off tags. Do not invent medical labels or unsupported traits.'
];

const WORKFLOW_JSON_RETRY_ATTEMPTS = 1;
const DEFAULT_UPDATE_MAX_OUTPUT_TOKENS = 9000;
const DEFAULT_WORKFLOW_TOTAL_BUDGET_MS = 280 * 1000;
const MAX_WORKFLOW_TOTAL_BUDGET_MS = 290 * 1000;
const MIN_WORKFLOW_RETRY_BUDGET_MS = 15 * 1000;

class WorkflowJsonParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowJsonParseError';
    this.isWorkflowJsonParseError = true;
  }
}

function normalizeWorkflow(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'client_intake_baseline' || normalized === 'client_note_update') {
    return normalized;
  }
  return '';
}

function getWorkflowMaxOutputTokens(workflowName) {
  const envKey = workflowName === 'client_note_update'
    ? 'WORKFLOW_UPDATE_MAX_OUTPUT_TOKENS'
    : 'WORKFLOW_MAX_OUTPUT_TOKENS';
  const fallback = workflowName === 'client_note_update' ? DEFAULT_UPDATE_MAX_OUTPUT_TOKENS : 9000;
  const parsed = Number.parseInt(process.env[envKey] || String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(2000, Math.min(parsed, 20000));
}

function getWorkflowTotalBudgetMs() {
  const parsed = Number.parseInt(
    process.env.WORKFLOW_TOTAL_BUDGET_MS || String(DEFAULT_WORKFLOW_TOTAL_BUDGET_MS),
    10
  );
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WORKFLOW_TOTAL_BUDGET_MS;
  }
  return Math.max(30 * 1000, Math.min(parsed, MAX_WORKFLOW_TOTAL_BUDGET_MS));
}

function cleanJsonText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return '';
  }

  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return raw.slice(first, last + 1).trim();
  }

  return raw;
}

function parseStructuredOutput(text) {
  const jsonText = cleanJsonText(text);
  if (!jsonText) {
    throw new WorkflowJsonParseError('Workflow returned an empty response.');
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new WorkflowJsonParseError(`Workflow returned invalid JSON: ${error.message}`);
  }
}

function isWorkflowJsonParseError(error) {
  return Boolean(error?.isWorkflowJsonParseError);
}

function isWorkflowFormatError(error) {
  return isWorkflowJsonParseError(error) || Boolean(error?.isWorkflowContractError);
}

function workflowSystemPrompt(workflowName, attempt) {
  if (attempt <= 0) {
    return workflowPrompts[workflowName];
  }
  return [
    workflowPrompts[workflowName],
    'The previous attempt could not be accepted by CoachNotes.',
    'Retry by following the requested JSON contract exactly and returning one complete valid JSON object only.',
    'Do not include markdown, comments, analysis, prose, or trailing text outside the JSON object.'
  ].join(' ');
}

function responseDiagnostics(result, { workflowName, model, attempt, prompt, startedAt }) {
  const usage = result?.usage && typeof result.usage === 'object' ? result.usage : {};
  const inputDetails = usage.input_tokens_details && typeof usage.input_tokens_details === 'object'
    ? usage.input_tokens_details
    : {};
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === 'object'
    ? usage.output_tokens_details
    : {};
  return {
    workflow: workflowName,
    model,
    attempt: attempt + 1,
    durationMs: Date.now() - startedAt,
    status: result?.status || 'unknown',
    incompleteReason: result?.incomplete_details?.reason || '',
    promptChars: prompt.length,
    inputTokens: usage.input_tokens,
    cachedInputTokens: inputDetails.cached_tokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: outputDetails.reasoning_tokens
  };
}

async function createWorkflowResponse({
  openai,
  model,
  workflowName,
  prompt,
  maxOutputTokens,
  requestTimeoutMs,
  attempt
}) {
  const startedAt = Date.now();
  const result = await withTimeout(
    openai.responses.create({
      model,
      max_output_tokens: maxOutputTokens,
      text: {
        format: { type: 'json_object' }
      },
      input: [
        { role: 'system', content: workflowSystemPrompt(workflowName, attempt) },
        { role: 'user', content: prompt }
      ]
    }),
    requestTimeoutMs,
    'Workflow response timed out. Reduce the intake bundle and try again.'
  );

  const outputText = extractResponseOutputText(result).trim();
  const diagnostics = {
    ...responseDiagnostics(result, { workflowName, model, attempt, prompt, startedAt }),
    outputChars: outputText.length
  };
  console.info('[workflow model response]', diagnostics);

  if (result?.status === 'incomplete') {
    throw new WorkflowJsonParseError(
      `Workflow response was incomplete: ${result?.incomplete_details?.reason || 'unknown reason'}.`
    );
  }

  const parsed = parseStructuredOutput(outputText);
  return {
    outputText,
    structured: workflowName === 'client_note_update' ? normalizeClientUpdatePatch(parsed) : parsed
  };
}

async function createParsedWorkflowResponse(options) {
  let lastError = null;
  const startedAt = Date.now();
  const totalBudgetMs = getWorkflowTotalBudgetMs();
  for (let attempt = 0; attempt <= WORKFLOW_JSON_RETRY_ATTEMPTS; attempt += 1) {
    const remainingBudgetMs = totalBudgetMs - (Date.now() - startedAt);
    if (remainingBudgetMs < MIN_WORKFLOW_RETRY_BUDGET_MS) {
      console.warn('[workflow retry skipped]', {
        workflow: options.workflowName,
        model: options.model,
        nextAttempt: attempt + 1,
        remainingBudgetMs
      });
      throw lastError || new Error('Workflow did not finish within its processing budget. Please try again.');
    }
    try {
      const response = await createWorkflowResponse({
        ...options,
        attempt,
        requestTimeoutMs: Math.min(options.requestTimeoutMs, remainingBudgetMs)
      });
      return {
        ...response,
        attempts: attempt + 1
      };
    } catch (error) {
      if (!isWorkflowFormatError(error) || attempt >= WORKFLOW_JSON_RETRY_ATTEMPTS) {
        throw error;
      }
      lastError = error;
      console.warn('[workflow format retry]', {
        workflow: options.workflowName,
        model: options.model,
        attempt: attempt + 1,
        message: error.message
      });
    }
  }

  throw lastError || new WorkflowJsonParseError('Workflow returned invalid JSON.');
}

function normalizePromptText(value, maxLength = 6000) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function renderCoachTemplatePrompt(value) {
  const template = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const guidance = template.guidance && typeof template.guidance === 'object' && !Array.isArray(template.guidance)
    ? template.guidance
    : {};
  const lines = [];
  const coachingApproach = normalizePromptText(guidance.coachingApproach, 4000);
  const messageStyle = normalizePromptText(guidance.messageStyle, 4000);
  const curriculumNotes = normalizePromptText(guidance.curriculumNotes, 6000);
  if (coachingApproach) {
    lines.push('coaching_approach:', coachingApproach);
  }
  if (messageStyle) {
    lines.push('message_style:', messageStyle);
  }
  if (curriculumNotes) {
    lines.push('curriculum_program_notes:', curriculumNotes);
  }

  const profileFields = [
    ...(Array.isArray(template.profileSelectFields) ? template.profileSelectFields : []),
    ...(Array.isArray(template.profileMultiSelectFields) ? template.profileMultiSelectFields : [])
  ];
  const renderedFields = profileFields
    .filter((field) => field && typeof field === 'object' && !Array.isArray(field))
    .map((field) => {
      const label = normalizePromptText(field.label || field.key, 120);
      const options = Array.isArray(field.options)
        ? field.options.map((option) => normalizePromptText(option, 120)).filter(Boolean)
        : [];
      return label && options.length ? `- ${label}: ${options.join(', ')}` : '';
    })
    .filter(Boolean);
  if (renderedFields.length) {
    lines.push('profile_option_defaults:', ...renderedFields);
  }

  if (!lines.length) {
    return 'No coach/practice template configured.';
  }
  return lines.join('\n');
}

function renderClientProfileSettingsPrompt(value) {
  const settings = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const lines = Object.entries(settings)
    .map(([key, entry]) => {
      if (Array.isArray(entry)) {
        const values = entry.map((item) => normalizePromptText(item, 120)).filter(Boolean);
        return values.length ? `${key}: ${values.join(', ')}` : '';
      }
      const normalized = normalizePromptText(entry, 240);
      return normalized ? `${key}: ${normalized}` : '';
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : '(none provided)';
}

function renderClientIntakePrompt(body) {
  const client = body.client && typeof body.client === 'object' ? body.client : {};
  const requestedDate = String(body.currentDate || '').trim();
  const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : new Date().toISOString().slice(0, 10);
  const sourceBlocks = body.sources.map((source, index) => {
    const sourceId = String(source.source_id || `source_${index + 1}`).trim();
    return [
      `source_id: ${sourceId}`,
      `title: ${source.title || 'Untitled source'}`,
      `source_type: ${source.source_type || 'unknown'}`,
      `date_or_range: ${source.date || source.date_range || 'unknown'}`,
      `coach_annotation: ${source.annotation || '(none)'}`,
      'text:',
      source.text
    ].join('\n');
  }).join('\n\n---\n\n');

  return [
    'Workflow: client_intake_baseline',
    '',
    'Client anchors:',
    `name: ${client.name || 'Unknown client'}`,
    `current_date: ${currentDate}`,
    `program_context: ${client.programContext || '(not provided)'}`,
    `coach_notes: ${client.coachNotes || '(not provided)'}`,
    'coach_selected_profile_settings:',
    renderClientProfileSettingsPrompt(client.profileSettings),
    '',
    'Coach/practice template:',
    renderCoachTemplatePrompt(body.coachTemplate),
    '',
    'Create this exact JSON object:',
    JSON.stringify({
      schemaVersion: 'client_baseline.v2',
      clientProfile: {
        age: '',
        location: '',
        curriculum: '',
        curriculumType: '',
        trainingProgram: '',
        programType: '',
        cohort: '',
        programFormat: '',
        primaryTrainingGoal: '',
        contraindications: [''],
        curriculumStartDate: '',
        programStartDate: '',
        programWeek: 'curriculum week based on curriculumStartDate, not training program start date',
        trainingProgramWeek: 'training program week based on programStartDate',
        notes: ''
      },
      overview: 'brief current-state Snapshot for coach scanning',
      coachTasks: [
        {
          title: '',
          details: 'specific coach to-do or follow-up',
          status: 'open | blocked | done | needs_review | unknown',
          dueOrReviewBy: '',
          evidenceIds: ['source_id']
        }
      ],
      flags: [
        {
          title: '',
          category: 'chronic_injury | red_flag | medical_concern | surgery_procedure | durable_constraint | other',
          details: '',
          status: 'active | improving | resolved | historical | unknown',
          urgency: 'low | medium | high | unknown',
          evidenceIds: ['source_id']
        }
      ],
      radarItems: [RADAR_ITEM_SCHEMA],
      goalsValues: [
        {
          title: '',
          details: 'specific client goal or desired outcome; do not include values',
          evidenceIds: ['source_id']
        }
      ],
      clientValues: [
        {
          title: '',
          details: 'client value, motivation, identity statement, or stable preference that helps coach the client',
          evidenceIds: ['source_id']
        }
      ],
      coachingPlanApproach: [
        {
          title: '',
          details: 'agreed coaching approach, planned habit/skill focus, commitment, or future commitment expected to move the needle on the client goals',
          timing: 'now | future | paused | unknown',
          evidenceIds: ['source_id']
        }
      ],
      programChanges: [
        {
          title: '',
          details: 'specific training/program modification being made, avoided, swapped, progressed, regressed, paused, or revisited',
          status: 'active | planned | temporary | permanent | resolved | historical | unknown',
          reason: '',
          evidenceIds: ['source_id']
        }
      ],
      progressTracking: [
        {
          title: '',
          details: 'skills practice, workout completion, strength progression, difficulty, load, or other compliance signal',
          status: 'mastered | improving | inconsistent | difficult | unknown',
          evidenceIds: ['source_id']
        }
      ],
      engagementNotes: [
        {
          title: '',
          details: 'how the client is engaging: Zoom, text, instant message, check-ins, responsiveness, tone, or cadence',
          evidenceIds: ['source_id']
        }
      ],
      nutritionThreads: [
        {
          title: '',
          details: 'common thread around what is difficult or mastered in nutrition',
          status: 'mastered | difficult | improving | watch | unknown',
          evidenceIds: ['source_id']
        }
      ],
      mindsetThreads: [
        {
          title: '',
          details: 'common thread around what is difficult or mastered in mindset',
          status: 'mastered | difficult | improving | watch | unknown',
          evidenceIds: ['source_id']
        }
      ],
      exerciseThreads: [
        {
          title: '',
          details: 'common thread around workouts, alterations, limitations, strength progression, or exercise considerations',
          status: 'mastered | difficult | improving | watch | unknown',
          evidenceIds: ['source_id']
        }
      ],
      resourcesShared: [
        {
          title: '',
          details: 'resource shared with the client and why it matters',
          date: '',
          evidenceIds: ['source_id']
        }
      ],
      suggestedTags: ['up to five sidebar/search tags'],
      timeline: [TIMELINE_ITEM_SCHEMA],
      missingInfo: ['important missing context'],
      confidenceNotes: ['uncertainty or evidence quality note']
    }, null, 2),
    '',
    'Rules:',
    '- Keep overview/Snapshot to 2-4 concise sentences. Emphasize current direction, current pain points, momentum, and ongoing considerations.',
    '- Do not use overview/Snapshot to recap all history or repeat the same coach/client to-dos that appear in coachTasks or goalsValues.',
    '- Keep arrays focused. Prefer 3-6 high-signal items per section unless the source clearly supports more.',
    '- When a client has a lot of history, choose what matters now. Summarize older repeated themes instead of copying every goal, action plan, or check-in item.',
    '- Merge duplicates and near-duplicates across sources. If several notes say the same thing, write one combined item with multiple evidenceIds.',
    '- Use evidenceIds to point back to source_id values. Empty evidenceIds are allowed only for coach-provided anchors.',
    '- Treat coach_selected_profile_settings as coach-entered client profile facts. Preserve them in clientProfile when provided.',
    '- Flags should contain durable or chronic client facts, safety or scope-of-practice concerns, ongoing medical considerations, and lasting constraints. Do not put temporary near-term situations or ordinary preferences in flags.',
    ...RADAR_RULES,
    '- For goalsValues, include only client goals or desired outcomes. Do not include values, identity statements, or general motivations there.',
    '- For clientValues, include stable values, motivations, identity statements, or coaching-relevant preferences that should live with the client profile.',
    '- For coachingPlanApproach, include only things the coach and client have agreed to try, commit to, revisit, or use later to move the client toward their goals.',
    '- Do not put generic goals in coachingPlanApproach unless there is a concrete agreed approach, habit, skill practice, plan constraint, commitment, or future commitment attached.',
    '- For programChanges, include concrete changes to the client training/program plan: exercise swaps, removed/avoided movements, temporary constraints, permanent modifications, volume/intensity/frequency changes, travel versions, or progressions/regressions.',
    '- Do not bury concrete program modifications only in exerciseThreads or coachingPlanApproach. Put the modification in programChanges and use exerciseThreads for broader exercise patterns/trends.',
    '- For nutritionThreads, mindsetThreads, and exerciseThreads, distinguish mastered/comfortable patterns from difficult patterns when evidence supports it.',
    '- For progressTracking, include skills practice compliance, workout completion, strength/difficulty/load progression, and client engagement only when available.',
    '- For resourcesShared, include resources already shared with the client, not resources the coach might want to create.',
    ...TIMELINE_RULES,
    ...HISTORICAL_SOURCE_RULES,
    ...TAG_RULES,
    '- Use empty strings or empty arrays for missing fields.',
    '- Current state must favor recent evidence. If old and recent sources conflict, note that in confidenceNotes.',
    '- Use the coach/practice template for tone, prioritization, profile option labels, and coaching emphasis. It is not client evidence; client-specific claims still need source evidence.',
    '- When profile values fit configured option labels, prefer those exact labels. If no configured option fits a source-supported fact, use the source-supported value rather than forcing a bad option.',
    '- Treat coach_annotation as coach-supplied context and routing guidance. If an annotation explicitly says to add something to a section such as Program Changes, follow that routing when the source text supports the item.',
    '',
    'Sources:',
    sourceBlocks
  ].join('\n');
}

function renderClientUpdatePrompt(body) {
  const client = body.client && typeof body.client === 'object' ? body.client : {};
  const requestedDate = String(body.currentDate || '').trim();
  const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : new Date().toISOString().slice(0, 10);
  const currentBaseline = body.currentBaseline && typeof body.currentBaseline === 'object' ? body.currentBaseline : {};
  const existingSourceIndex = (Array.isArray(body.existingSourceIndex) ? body.existingSourceIndex : [])
    .slice(0, 500)
    .map((source) => ({
      source_id: String(source?.source_id || '').trim().slice(0, 160),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(source?.date || '').trim())
        ? String(source.date).trim()
        : 'unknown',
      source_type: String(source?.source_type || 'unknown').trim().slice(0, 80),
      title: String(source?.title || 'Untitled source').trim().slice(0, 160)
    }))
    .filter((source) => source.source_id);
  const sourceBlocks = body.sources.map((source, index) => {
    const sourceId = String(source.source_id || `source_${index + 1}`).trim();
    return [
      `source_id: ${sourceId}`,
      `title: ${source.title || 'Untitled source'}`,
      `source_type: ${source.source_type || 'unknown'}`,
      `date_or_range: ${source.date || source.date_range || 'unknown'}`,
      `coach_annotation: ${source.annotation || '(none)'}`,
      'text:',
      source.text
    ].join('\n');
  }).join('\n\n---\n\n');

  return [
    'Workflow: client_note_update',
    '',
    'Client:',
    `name: ${client.name || 'Unknown client'}`,
    `current_date: ${currentDate}`,
    '',
    'Coach/practice template:',
    renderCoachTemplatePrompt(body.coachTemplate),
    '',
    'Existing baseline source date index (metadata only):',
    JSON.stringify(existingSourceIndex),
    '',
    'Current accepted baseline JSON:',
    JSON.stringify(currentBaseline, null, 2),
    '',
    'Return this exact partial-update JSON object. Use the actual updated content in value:',
    JSON.stringify({
      schemaVersion: CLIENT_UPDATE_SCHEMA_VERSION,
      updateSummary: '1-2 concise sentences explaining what changed and why it matters to the coach.',
      sectionUpdates: [
        {
          sectionKey: 'one changed dashboard section key',
          operation: 'replace | append | merge',
          value: 'the replacement, appended items, or profile field patch',
          summary: 'brief description of this section change',
          reason: 'why the new source supports this change',
          evidenceIds: ['source_id']
        }
      ]
    }, null, 2),
    '',
    'Rules:',
    '- Preserve existing baseline content unless the new source gives a clear reason to change it.',
    '- Return only sections that actually change. Do not return the entire baseline and do not include unchanged sections.',
    `- sectionKey must be one of: ${[...UPDATE_SECTION_KEYS].join(', ')}.`,
    `- Return no more than ${MAX_SECTION_UPDATES} sectionUpdates. Most notes should change only 1-5 sections.`,
    '- For overview, use operation "replace" and value must be the complete updated overview string.',
    '- For clientProfile, use operation "merge" and value must contain only changed profile fields. Do not reproduce the full clientProfile.',
    '- For array sections, use operation "append" with only new items when every existing item remains valid and unchanged. This is preferred for adding new timeline milestones, resources, and other genuinely new items.',
    '- Do not use append when a new item duplicates or should update, resolve, merge, or supersede an existing item.',
    '- For an array section that needs an existing item changed, merged, removed, or resolved, use operation "replace" and return the complete concise updated array for that section only.',
    '- For timeline, append only when new entries belong at the end of the existing timeline order. Use replace when inserting or reordering older historical events.',
    '- For suggestedTags, always use replace and return the complete ordered list of 0-5 tags. Never append tags.',
    '- Use an empty sectionUpdates array when the source supports no dashboard change. The source will still be saved.',
    '- Keep overview/Snapshot to 2-4 concise sentences. Emphasize current direction, current pain points, momentum, and ongoing considerations.',
    '- Do not use overview/Snapshot to recap all history or repeat the same coach/client to-dos that appear in coachTasks or goalsValues.',
    '- Keep changed arrays focused. Prefer editing, merging, or appending specific items instead of expanding the section.',
    '- If the new source repeats an existing goal, barrier, action plan, or status theme, update the existing item instead of adding a duplicate.',
    '- Cite new evidence using evidenceIds objects or bracket markers like [source_id].',
    '- Do not cite the current baseline as evidence. It is coach context, not a source note.',
    '- Treat coach-entered currentBaseline fields as source of truth. Add new source evidence without erasing coach edits.',
    '- Use the existing baseline source date index to compare new evidence with evidenceIds already attached to dashboard items. The index supplies chronology only; it does not replace source evidence.',
    ...HISTORICAL_SOURCE_RULES,
    '- Flags should contain durable or chronic client facts, safety or scope-of-practice concerns, ongoing medical considerations, and lasting constraints. Do not put temporary near-term situations or ordinary preferences in flags.',
    ...RADAR_RULES,
    '- For goalsValues, keep only client goals or desired outcomes. Move values, identity statements, or general motivations into clientValues.',
    '- For clientValues, update stable values, motivations, identity statements, or coaching-relevant preferences when new evidence supports it.',
    '- For coachingPlanApproach, update agreed coaching approach, current commitments, planned habit/skill focus, and future commitments when new evidence supports it.',
    '- For programChanges, update concrete changes to the client training/program plan: exercise swaps, removed/avoided movements, temporary constraints, permanent modifications, volume/intensity/frequency changes, travel versions, or progressions/regressions.',
    '- Do not bury concrete program modifications only in exerciseThreads or coachingPlanApproach. Put the modification in programChanges and use exerciseThreads for broader exercise patterns/trends.',
    '- For nutritionThreads, mindsetThreads, and exerciseThreads, update common threads around what is difficult and what has been mastered.',
    '- For progressTracking, update skills practice compliance, workout completion, strength/difficulty/load progression, and client engagement when new evidence supports it.',
    ...TIMELINE_RULES,
    ...TAG_RULES,
    '- On updates, normalize suggestedTags to match these rules even when older baseline tags are noisy.',
    '- updateSummary should name the most important updated sections and stay under 45 words.',
    '- If the new source suggests a coach should verify something, put it in coachTasks, missingInfo, or confidenceNotes.',
    '- Use the coach/practice template for tone, prioritization, profile option labels, and coaching emphasis. It is not client evidence; client-specific claims still need source evidence.',
    '- When profile values fit configured option labels, prefer those exact labels. If no configured option fits a source-supported fact, use the source-supported value rather than forcing a bad option.',
    '- Treat coach_annotation as coach-supplied context and routing guidance. If an annotation explicitly says to add something to a section such as Program Changes, follow that routing when the source text supports the item.',
    '',
    'New sources:',
    sourceBlocks
  ].join('\n');
}

function workflowSourceStats(sources) {
  const values = Array.isArray(sources) ? sources : [];
  return {
    count: values.length,
    totalChars: values.reduce((total, source) => total + String(source?.text || '').length, 0)
  };
}

function workflowBaselineStats(value) {
  const baseline = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    chars: JSON.stringify(baseline).length,
    sections: Object.keys(baseline).length
  };
}

module.exports = async function workflow(req, res) {
  const startedAt = Date.now();
  const auth = authAndRateLimit(req, res);
  if (!auth.ok) {
    return;
  }

  const workflowName = normalizeWorkflow(req.body?.workflow);
  if (!workflowName || !workflowPrompts[workflowName]) {
    json(res, 400, { error: 'Unsupported workflow.' });
    return;
  }

  const sourcesError = validateWorkflowSources(req.body?.sources);
  if (sourcesError) {
    json(res, 400, { error: sourcesError });
    return;
  }

  try {
    const model = allowModel(req.body.model, DEFAULT_LLM_MODEL, 'LLM_MODEL_ALLOWLIST');
    const openai = getOpenAIClient();
    const requestTimeoutMs = getOpenAITimeoutMs();
    const maxOutputTokens = getWorkflowMaxOutputTokens(workflowName);
    const prompt = workflowName === 'client_note_update'
      ? renderClientUpdatePrompt(req.body)
      : renderClientIntakePrompt(req.body);

    const { outputText, structured, attempts } = await createParsedWorkflowResponse({
      openai,
      model,
      workflowName,
      prompt,
      maxOutputTokens,
      requestTimeoutMs
    });

    json(res, 200, {
      workflow: workflowName,
      model,
      maxOutputTokens,
      attempts,
      structured,
      rawOutput: outputText
    });
  } catch (err) {
    const errorId = `workflow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    console.error('[workflow failed]', {
      errorId,
      workflow: workflowName,
      model: req.body?.model || DEFAULT_LLM_MODEL,
      sourceStats: workflowSourceStats(req.body?.sources),
      baselineStats: workflowBaselineStats(req.body?.currentBaseline),
      durationMs: Date.now() - startedAt,
      name: err?.name || '',
      message: err?.message || 'Workflow request failed.'
    });
    const message = isWorkflowFormatError(err)
      ? 'CoachNotes could not finish formatting the AI update. Please try again.'
      : err?.message || 'Workflow request failed.';
    json(res, 502, {
      error: `${message} Reference: ${errorId}`
    });
  }
};

module.exports._test = {
  renderClientIntakePrompt,
  renderClientUpdatePrompt
};
