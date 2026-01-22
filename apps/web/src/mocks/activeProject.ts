import { mockProjects } from "./projects";

export const getActiveProjectId = () => {
  return mockProjects[0]?.id ?? "proj_1";
};
