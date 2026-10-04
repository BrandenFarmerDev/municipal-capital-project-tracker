import { expect, it } from "vitest";
import { projectsReturnPath } from "./projects-return-path";

it.each([undefined, null, "invalid", {}, { projectSearch: 42 }, { projectSearch: "" }])("uses the project queue for absent or invalid context %j", (state) => {
  expect(projectsReturnPath(state)).toBe("/projects");
});

it("treats return context as query data rather than a navigation URL", () => {
  expect(projectsReturnPath({ projectSearch: "phase=design&cursor=a%2Bb" })).toBe("/projects?phase=design&cursor=a%2Bb");
  expect(projectsReturnPath({ projectSearch: "https://other.example/path" })).toMatch(/^\/projects\?/);
});
