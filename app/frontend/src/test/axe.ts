import axe from "axe-core";

// Color contrast needs real layout, which jsdom cannot provide.
export const violations = async (container: HTMLElement) =>
  (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations;
