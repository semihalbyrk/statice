const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Reject tokens belonging to deactivated users — otherwise they stay valid
  // for up to the access-token TTL after an admin disables the account.
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { is_active: true },
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account disabled' });
    }
  } catch (err) {
    return next(err);
  }

  req.user = decoded;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
