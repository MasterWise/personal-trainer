import { getAuth } from "../firebase/admin.js";

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

function mapDecodedUser(decoded) {
  return {
    id: decoded.uid,
    uid: decoded.uid,
    name: decoded.name || decoded.email || decoded.uid,
    email: decoded.email || null,
    is_admin: decoded.admin === true || decoded.isAdmin === true,
    claims: decoded,
  };
}

export async function firebaseAuthMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Token Firebase nao fornecido" });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = mapDecodedUser(decoded);
    req.firebaseToken = decoded;
    return next();
  } catch (error) {
    console.error("[Firebase Auth]", error);
    return res.status(401).json({ error: "Token Firebase invalido" });
  }
}

export function firebaseAdminOnly(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: "Acesso restrito a administradores" });
  }
  return next();
}
