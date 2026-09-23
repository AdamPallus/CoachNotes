const test = require('node:test');
const assert = require('node:assert/strict');
const { createCitationStream, normalizeAnswerCitations, validateWorkflowEvidence } = require('../api/_citations');

const sources = [{ chunk_id: 'note_1' }, { chunk_id: 'dashboard' }];
test('canonicalizes citation whitespace without inventing a source', () => {
  assert.equal(normalizeAnswerCitations('Plan [c: note_1 ] and [ C : dashboard ].', sources), 'Plan [c:note_1] and [c:dashboard].');
  assert.throws(() => normalizeAnswerCitations('Plan [c:other].', sources), /could not be verified/);
  assert.throws(() => normalizeAnswerCitations('Plan [c:note_1', sources), /unfinished/);
  assert.equal(normalizeAnswerCitations('No medication dose is documented.', sources), 'No medication dose is documented.');
});

test('streaming matches canonical whole-text output at every split boundary', () => {
  const text = '## Plan\n- Works [c: note_1 ]. [Link](https://example.com) and [c:dashboard].';
  const expected = normalizeAnswerCitations(text, sources);
  for (let i = 0; i <= text.length; i += 1) {
    const stream = createCitationStream(sources);
    assert.equal(stream.push(text.slice(0, i)) + stream.push(text.slice(i)) + stream.push('', true), expected);
  }
  const stream = createCitationStream(sources);
  let result = '';
  for (const character of text) result += stream.push(character);
  assert.equal(result + stream.push('', true), expected);
});

test('invalid streamed references never become clickable delta tokens', () => {
  const stream = createCitationStream(sources);
  assert.equal(stream.push('Claim [c:miss'), 'Claim ');
  assert.throws(() => stream.push('ing]'), /could not be verified/);
  const unfinished = createCitationStream(sources);
  unfinished.push('Claim [c:');
  assert.throws(() => unfinished.push('', true), /unfinished/);
});

function body() {
  return {
    sources: [{ source_id: 'intake_source_2' }],
    existingSourceIndex: [{ source_id: 'intake_source_1' }],
    currentBaseline: { coachTasks: [{ title: 'Coach-entered task', status: 'open' }] }
  };
}
function patch(items, evidenceIds = ['intake_source_2']) {
  return { sectionUpdates: [{ sectionKey: 'coachTasks', operation: 'replace', value: items, evidenceIds }] };
}

test('checks each changed item, not just its section citation', () => {
  assert.throws(() => validateWorkflowEvidence(patch([{ title: 'New task' }]), body(), 'client_note_update'), /missing its own/);
  assert.throws(() => validateWorkflowEvidence(patch([{ title: 'New task', evidenceIds: ['invented'] }]), body(), 'client_note_update'), /unrecognized/);
  const result = validateWorkflowEvidence(patch([{ title: 'New task', evidenceIds: [' intake_source_2 '] }]), body(), 'client_note_update');
  assert.deepEqual(result.sectionUpdates[0].value[0].evidenceIds, ['intake_source_2']);
});

test('keeps uncited coach edits and existing references intact', () => {
  const input = body();
  const coachItem = input.currentBaseline.coachTasks[0];
  const items = [{ status: 'open', title: coachItem.title }, { title: 'New task', evidenceIds: ['intake_source_2'] }];
  const result = validateWorkflowEvidence(patch(items), input, 'client_note_update');
  assert.deepEqual(result.sectionUpdates[0].value[0], coachItem);
  assert.equal('evidenceIds' in result.sectionUpdates[0].value[0], false);
  assert.equal('evidenceIds' in coachItem, false);
  input.currentBaseline.coachTasks.push({ title: 'Older item', evidenceIds: ['intake_source_0'] });
  assert.doesNotThrow(() => validateWorkflowEvidence(patch([{ title: 'Revised older item', evidenceIds: ['intake_source_0', 'intake_source_2'] }]), input, 'client_note_update'));
});

test('accepts inline source evidence but rejects invented inline and section references', () => {
  assert.doesNotThrow(() => validateWorkflowEvidence(patch([{ title: 'New task [intake_source_2]' }]), body(), 'client_note_update'));
  assert.throws(() => validateWorkflowEvidence(patch([{ title: 'New task [intake_source_999]' }]), body(), 'client_note_update'), /unrecognized/);
  assert.throws(() => validateWorkflowEvidence(patch([], ['invented']), body(), 'client_note_update'), /unrecognized/);
  assert.throws(() => validateWorkflowEvidence({ flags: [{ evidenceIds: ['invented'] }] }, body(), 'client_intake_baseline'), /unrecognized/);
});
