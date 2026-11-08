// Shared helpers for showing collaborators by name instead of raw email.
// Names live on the project as `collaborator_names: { "<lowercase email>": "Full Name" }`.
// Fallback (no name known): the email prefix, prettified ("ruth.lopez" -> "Ruth Lopez").
const clean = (e) => (e || "").trim().toLowerCase();

export function nameFor(email, names = {}, currentEmail = "") {
  const key = clean(email);
  if (key && key === clean(currentEmail)) return "Me";
  const stored = names && names[key];
  if (stored) return stored;
  const prefix = key.split("@")[0].replace(/[._\-+0-9]+/g, " ").trim();
  return prefix.replace(/\b\w/g, (c) => c.toUpperCase()) || email;
}

export function firstNameFor(email, names, currentEmail) {
  return nameFor(email, names, currentEmail).split(" ")[0];
}

export function initialsFor(email, names, currentEmail) {
  const n = nameFor(email, names, currentEmail);
  if (n === "Me") return "Me";
  const parts = n.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase();
}

export const sameEmail = (a, b) => clean(a) === clean(b);
