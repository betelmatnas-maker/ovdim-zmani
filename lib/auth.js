const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "attendance_session";
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const SESSION_DAYS = 30;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function createSessionCookie(user) {
  const token = jwt.sign(
    { sub: user.id, role: user.role, fullName: user.fullName, username: user.username },
    SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function getSessionFromReq(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = match.slice(SESSION_COOKIE.length + 1);
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

// Wraps an API handler so it 401s unless a valid session exists.
// Pass an array of allowed roles, e.g. requireAuth(handler, ["admin"]).
function requireAuth(handler, allowedRoles) {
  return async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
      res.status(401).json({ error: "לא מחוברים למערכת." });
      return;
    }
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      res.status(403).json({ error: "אין הרשאה לפעולה זו." });
      return;
    }
    req.session = session;
    return handler(req, res);
  };
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSessionCookie,
  clearSessionCookie,
  getSessionFromReq,
  requireAuth,
};
