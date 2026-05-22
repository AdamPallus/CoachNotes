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

const workflowPrompts = {
  client_intake_baseline: [
    'You are CoachNotes Intake.',
    'Your job is to turn a messy bundle of client source material into a practical, coach-reviewable baseline.',
    'Do not pretend uncertain facts are current truth.',
    'Prefer concise, evidence-linked observations over long prose.',
    'Build a current working dashboard, not an exhaustive archive of every historical goal or action plan.',
    'Combine duplicate or overlapping goals, habits, barriers, and action items into one clear item instead of listing each mention separately.',
    'Separate active constraints from historical context.',
    'Flag scope-of-practice concerns without diagnosing.',
    'Never invent dates, injuries, client preferences, program details, medications, or plans.',
    'If a detail is unclear, put it in missingInfo instead of assuming.',
    'Return valid JSON only. Do not wrap it in markdown.'
  ].join(' '),
  client_note_update: [
    'You are CoachNotes Update.',
    'Your job is to update an existing coach-reviewed client baseline from new source material.',
    'Treat the current baseline as authoritative coach context, even if some fields are uncited.',
    'Do not remove or weaken coach-entered facts just because the new source does not mention them.',
    'Keep the dashboard concise and current. Do not let repeated historical mentions inflate the active lists.',
    'Combine duplicate or overlapping goals, habits, barriers, and action items instead of appending another similar item.',
    'Only change sections when the new source clearly adds, updates, resolves, or contradicts something.',
    'When the new source conflicts with the baseline, preserve the baseline and add a confidence note or open loop unless the source clearly resolves the older point.',
    'Every new or changed claim should cite the new source_id when possible.',
    'Flag scope-of-practice concerns without diagnosing.',
    'Return valid JSON only. Do not wrap it in markdown.'
  ].join(' ')
};

function normalizeWorkflow(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'client_intake_baseline' || normalized === 'client_note_update') {
    return normalized;
  }
  return '';
}

function getWorkflowMaxOutputTokens() {
  const parsed = Number.parseInt(process.env.WORKFLOW_MAX_OUTPUT_TOKENS || '9000', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 9000;
  }
  return Math.max(2000, Math.min(parsed, 20000));
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
    throw new Error('Workflow returned an empty response.');
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Workflow returned invalid JSON: ${error.message}`);
  }
}

function renderClientIntakePrompt(body) {
  const client = body.client && typeof body.client === 'object' ? body.client : {};
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
    `program_context: ${client.programContext || '(not provided)'}`,
    `coach_notes: ${client.coachNotes || '(not provided)'}`,
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
        programStartDate: '',
        programWeek: '',
        notes: ''
      },
      overview: 'short current-state client snapshot',
      coachTasks: [
        {
          title: '',
          details: 'specific to-do, action item, or follow-up for the coach',
          status: 'open | done | needs_review | unknown',
          dueOrReviewBy: '',
          evidenceIds: ['source_id']
        }
      ],
      flags: [
        {
          title: '',
          category: 'injury | vacation | red_flag | medical_concern | surgery_procedure | life_event | other',
          details: '',
          status: 'active | improving | resolved | historical | unknown',
          urgency: 'low | medium | high | unknown',
          evidenceIds: ['source_id']
        }
      ],
      goalsValues: [
        {
          title: '',
          details: 'current goal, value, future-self statement, or vision statement',
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
      suggestedTags: ['tag'],
      timeline: [
        {
          date: '',
          label: '',
          details: '',
          evidenceIds: ['source_id']
        }
      ],
      missingInfo: ['important missing context'],
      confidenceNotes: ['uncertainty or evidence quality note']
    }, null, 2),
    '',
    'Rules:',
    '- Keep arrays focused. Prefer 3-6 high-signal items per section unless the source clearly supports more.',
    '- When a client has a lot of history, choose what matters now. Summarize older repeated themes instead of copying every goal, action plan, or check-in item.',
    '- Merge duplicates and near-duplicates across sources. If several notes say the same thing, write one combined item with multiple evidenceIds.',
    '- Use evidenceIds to point back to source_id values. Empty evidenceIds are allowed only for coach-provided anchors.',
    '- Flags should include injuries, vacations, red flags, medical concerns, surgeries/procedures, and major life events. Do not put ordinary preferences in flags.',
    '- For coachingPlanApproach, include only things the coach and client have agreed to try, commit to, revisit, or use later to move the client toward their goals.',
    '- Do not put generic goals in coachingPlanApproach unless there is a concrete agreed approach, habit, skill practice, plan constraint, commitment, or future commitment attached.',
    '- For nutritionThreads, mindsetThreads, and exerciseThreads, distinguish mastered/comfortable patterns from difficult patterns when evidence supports it.',
    '- For progressTracking, include skills practice compliance, workout completion, strength/difficulty/load progression, and client engagement only when available.',
    '- For resourcesShared, include resources already shared with the client, not resources the coach might want to create.',
    '- Use empty strings or empty arrays for missing fields.',
    '- Current state must favor recent evidence. If old and recent sources conflict, note that in confidenceNotes.',
    '',
    'Sources:',
    sourceBlocks
  ].join('\n');
}

function renderClientUpdatePrompt(body) {
  const client = body.client && typeof body.client === 'object' ? body.client : {};
  const currentBaseline = body.currentBaseline && typeof body.currentBaseline === 'object' ? body.currentBaseline : {};
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
    '',
    'Current accepted baseline JSON:',
    JSON.stringify(currentBaseline, null, 2),
    '',
    'Return this exact JSON object:',
    JSON.stringify({
      schemaVersion: 'client_update.v2',
      updateSummary: '1-2 concise sentences explaining what changed and why it matters to the coach.',
      changes: [
        {
          sectionKey: 'flags',
          action: 'add | update | resolve | no_change | needs_review',
          summary: '',
          reason: '',
          evidenceIds: ['source_id']
        }
      ],
      updatedBaseline: {
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
          programStartDate: '',
          programWeek: '',
          notes: ''
        },
        overview: 'updated current-state client snapshot',
        coachTasks: ['coach to-do or action item'],
        flags: ['injury, vacation, red flag, medical concern, surgery/procedure, life event, or other flag'],
        goalsValues: ['current goal, value, future-self statement, or vision statement'],
        coachingPlanApproach: ['agreed approach, planned habit/skill focus, current commitment, or future commitment expected to move goals forward'],
        progressTracking: ['skills practice, workout completion, strength progression, difficulty, load, compliance, or engagement signal'],
        engagementNotes: ['Zoom, text, instant message, check-in, responsiveness, tone, or cadence note'],
        nutritionThreads: ['nutrition common thread: mastered, difficult, improving, watch, or unknown'],
        mindsetThreads: ['mindset common thread: mastered, difficult, improving, watch, or unknown'],
        exerciseThreads: ['exercise common thread: mastered, difficult, improving, watch, or unknown'],
        resourcesShared: ['resource already shared with the client'],
        suggestedTags: ['tag'],
        timeline: ['dated event'],
        missingInfo: ['important missing context'],
        confidenceNotes: ['uncertainty or evidence quality note']
      }
    }, null, 2),
    '',
    'Rules:',
    '- Preserve existing baseline content unless the new source gives a clear reason to change it.',
    '- Return updatedBaseline in the v2 schema shown above and include all v2 baseline sections.',
    '- Keep arrays focused. Prefer editing, merging, or appending specific items instead of rewriting whole sections.',
    '- If the new source repeats an existing goal, barrier, action plan, or status theme, update the existing item instead of adding a duplicate.',
    '- Cite new evidence using evidenceIds objects or bracket markers like [source_id].',
    '- Do not cite the current baseline as evidence. It is coach context, not a source note.',
    '- Treat coach-entered currentBaseline fields as source of truth. Add new source evidence without erasing coach edits.',
    '- Flags should include injuries, vacations, red flags, medical concerns, surgeries/procedures, and major life events. Do not put ordinary preferences in flags.',
    '- For coachingPlanApproach, update agreed coaching approach, current commitments, planned habit/skill focus, and future commitments when new evidence supports it.',
    '- For nutritionThreads, mindsetThreads, and exerciseThreads, update common threads around what is difficult and what has been mastered.',
    '- For progressTracking, update skills practice compliance, workout completion, strength/difficulty/load progression, and client engagement when new evidence supports it.',
    '- updateSummary should name the most important updated sections and stay under 45 words.',
    '- If the new source suggests a coach should verify something, put it in coachTasks, missingInfo, or confidenceNotes.',
    '',
    'New sources:',
    sourceBlocks
  ].join('\n');
}

module.exports = async function workflow(req, res) {
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
    const maxOutputTokens = getWorkflowMaxOutputTokens();
    const prompt = workflowName === 'client_note_update'
      ? renderClientUpdatePrompt(req.body)
      : renderClientIntakePrompt(req.body);

    const result = await withTimeout(
      openai.responses.create({
        model,
        max_output_tokens: maxOutputTokens,
        input: [
          { role: 'system', content: workflowPrompts[workflowName] },
          { role: 'user', content: prompt }
        ]
      }),
      requestTimeoutMs,
      'Workflow response timed out. Reduce the intake bundle and try again.'
    );

    const outputText = extractResponseOutputText(result).trim();
    const structured = parseStructuredOutput(outputText);

    json(res, 200, {
      workflow: workflowName,
      model,
      maxOutputTokens,
      structured,
      rawOutput: outputText
    });
  } catch (err) {
    json(res, 502, { error: err.message || 'Workflow request failed.' });
  }
};
