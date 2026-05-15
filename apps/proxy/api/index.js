module.exports = async function index(_req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CoachNotes Proxy</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6efe3;
        color: #241c16;
        font: 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(680px, calc(100vw - 40px));
        border: 1px solid #dbcab0;
        border-radius: 12px;
        background: #fffaf1;
        padding: 28px;
        box-shadow: 0 18px 60px rgba(55, 42, 28, 0.12);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      p {
        margin: 0;
        line-height: 1.5;
        color: #776b5f;
      }
      code {
        color: #526348;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>CoachNotes Proxy</h1>
      <p>This deployment is online. Desktop clients use authenticated API routes including <code>/health</code>, <code>/workflow</code>, <code>/embed</code>, <code>/answer</code>, and <code>/summarize</code>.</p>
    </main>
  </body>
</html>`);
};
