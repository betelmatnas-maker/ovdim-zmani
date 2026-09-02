const { getSessionFromReq } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session) {
    res.status(200).json({ user: null });
    return;
  }
  res.status(200).json({
    user: { role: session.role, fullName: session.fullName, username: session.username },
  });
};

module.exports.default = module.exports;
