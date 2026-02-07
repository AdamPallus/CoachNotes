const { json } = require('./_shared');

module.exports = async function health(req, res) {
  json(res, 200, { ok: true });
};
