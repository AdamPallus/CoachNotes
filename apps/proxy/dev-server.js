const express = require('express');
const index = require('./api/index');
const health = require('./api/health');
const embed = require('./api/embed');
const answer = require('./api/answer');
const summarize = require('./api/summarize');
const workflow = require('./api/workflow');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/', index);
app.get('/health', health);
app.post('/embed', embed);
app.post('/answer', answer);
app.post('/summarize', summarize);
app.post('/workflow', workflow);
app.options('/*rest', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.status(200).json({ ok: true });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  process.stdout.write(`CoachNotes proxy listening on http://localhost:${port}\n`);
});
