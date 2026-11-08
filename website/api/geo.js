// Returns the visitor's country as seen by Vercel's edge, for picking the page language.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ country: req.headers['x-vercel-ip-country'] || null }));
};
