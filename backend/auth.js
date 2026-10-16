import jwt from "jsonwebtoken";
import { User } from "./models.js";
export function safeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: (process.env.ADMIN_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())
      .includes(user.email),
  };
}
export function tokenFor(user) {
  return jwt.sign(
    { id: String(user._id), v: user.sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: "7d", issuer: "fantasy-xi", audience: "fantasy-web" },
  );
}
export async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ");
    if (token?.[0] !== "Bearer")
      return res.status(401).json({ error: "Please sign in." });
    const decoded = jwt.verify(token[1], process.env.JWT_SECRET, {
      issuer: "fantasy-xi",
      audience: "fantasy-web",
      algorithms: ["HS256"],
    });
    const user = await User.findById(decoded.id);
    if (!user || user.sessionVersion !== decoded.v)
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again." });
    req.user = user;
    next();
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError")
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again." });
    next(e);
  }
}
export function admin(req, res, next) {
  if (!safeUser(req.user).isAdmin)
    return res.status(403).json({ error: "Administrator access required." });
  next();
}
