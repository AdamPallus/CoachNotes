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
      schemaVersion: 'client_baseline.v1',
      overview: 'short plain-language client snapshot',
      programContext: {
        track: '',
        cohortTiming: '',
        programWeek: '',
        notes: ''
      },
      currentGoals: ['goal'],
      currentPriorities: ['priority'],
      activeConstraints: [
        {
          title: '',
          details: '',
          status: 'active | improving | resolved | unknown',
          startedAt: '',
          reviewBy: '',
          evidenceIds: ['source_id']
        }
      ],
      injuriesLimitations: [
        {
          title: '',
          details: '',
          currentStatus: '',
          evidenceIds: ['source_id']
        }
      ],
      medicalScopeFlags: [
        {
          title: '',
          details: '',
          urgency: 'low | medium | high | unknown',
          evidenceIds: ['source_id']
        }
      ],
      habitsBehaviors: ['behavior pattern'],
      motivationValues: ['motivator or value'],
      preferences: ['preference'],
      communicationNotes: ['communication note'],
      wins: ['win or progress signal'],
      challenges: ['challenge'],
      openLoops: ['follow-up or unresolved question'],
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
    '- Keep arrays focused. Prefer 3-8 items per section unless the source clearly supports more.',
    '- Use evidenceIds to point back to source_id values. Empty evidenceIds are allowed only for coach-provided anchors.',
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
      schemaVersion: 'client_update.v1',
      updateSummary: '1-2 concise sentences explaining what changed and why it matters to the coach.',
      changes: [
        {
          sectionKey: 'activeConstraints',
          action: 'add | update | resolve | no_change | needs_review',
          summary: '',
          reason: '',
          evidenceIds: ['source_id']
        }
      ],
      updatedBaseline: {
        schemaVersion: 'client_baseline.v1',
        overview: 'updated client snapshot',
        programContext: {
          track: '',
          cohortTiming: '',
          programWeek: '',
          notes: ''
        },
        currentGoals: ['goal'],
        currentPriorities: ['priority'],
        activeConstraints: ['constraint with citation markers or objects with evidenceIds'],
        injuriesLimitations: ['injury or limitation'],
        medicalScopeFlags: ['scope flag'],
        habitsBehaviors: ['behavior pattern'],
        motivationValues: ['motivator or value'],
        preferences: ['preference'],
        communicationNotes: ['communication note'],
        wins: ['win or progress signal'],
        challenges: ['challenge'],
        openLoops: ['follow-up or unresolved question'],
        suggestedTags: ['tag'],
        timeline: ['dated event'],
        missingInfo: ['important missing context'],
        confidenceNotes: ['uncertainty or evidence quality note']
      }
    }, null, 2),
    '',
    'Rules:',
    '- Preserve existing baseline content unless the new source gives a clear reason to change it.',
    '- Keep the same baseline schema and include all baseline sections in updatedBaseline.',
    '- Keep arrays focused. Prefer editing or appending specific items instead of rewriting whole sections.',
    '- Cite new evidence using evidenceIds objects or bracket markers like [source_id].',
    '- Do not cite the current baseline as evidence. It is coach context, not a source note.',
    '- updateSummary should name the most important updated sections and stay under 45 words.',
    '- If the new source suggests a coach should verify something, put it in openLoops, missingInfo, or confidenceNotes.',
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
