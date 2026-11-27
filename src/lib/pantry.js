// Pantry items: things the person may already have at home. They stay on the
// list (so it's complete) but sit in their own section at the bottom.
const STAPLES = /\b(salt|pepper(corns)?|black pepper|(olive|vegetable|canola|cooking|avocado) oil|oil|butter|flour|sugar|brown sugar|garlic powder|onion powder|paprika|smoked paprika|cumin|oregano|chili powder|cinnamon|nutmeg|dried (basil|thyme|parsley|oregano)|bay leaves|baking soda|baking powder|vanilla( extract)?|cornstarch|water|cooking spray|vinegar)\b/i;

// Imported items carry their own flag; older imported items are guessed from
// their name. Items typed in by hand are never moved.
export function isPantry(item) {
  if (!item) return false;
  if (typeof item.pantry === "boolean") return item.pantry;
  if (!item.from) return false;
  const name = String(item.text || "").split(",")[0];
  return STAPLES.test(name) && !/\b(cheese|cream|milk|pasta|bread|bell|jalape\w*|poblano|serrano|peanut|chestnuts?)\b/i.test(name);
}
