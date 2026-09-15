import { fetchJson } from "./http";

export type SampleBuild = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  prompt: string;
  image: string | null;
};

export const listSampleBuilds = () => fetchJson<SampleBuild[]>("/sample-builds");
