export const APP_NAME = "Municipal Capital Project Tracker";

export const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/projects", label: "Projects", end: false },
];

export const syntheticNotice = "Prototype using fictional data only. Nothing here describes a real municipality or project.";

export const home = {
  title: "Capital project tracker",
  description: "A read-only, synthetic-data prototype for following capital projects from request through closeout.",
  details: [
    "This initial module lists projects, shows their lifecycle phase and status, and displays milestones.",
    "Editing, budget revisions, decisions, and public updates are planned for later modules.",
  ],
};
