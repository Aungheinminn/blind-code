// Credit top-up packs. Sale prices use a tapered markup off the raw API
// cost (1 credit = $0.001): Starter is ~3x, bulk packs ramp down to ~1.5x.
// Tune these freely — just keep ids stable since clients send them back.
export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  highlight?: boolean;
  tagline?: string;
};

export const CREDIT_PACKS: ReadonlyArray<CreditPack> = [
  {
    id: "starter",
    name: "Starter",
    credits: 1_000,
    priceUsd: 3,
    tagline: "A few sessions on Sonnet-class models.",
  },
  {
    id: "standard",
    name: "Standard",
    credits: 5_000,
    priceUsd: 12,
    highlight: true,
    tagline: "Most popular — saves 20% vs Starter.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 20_000,
    priceUsd: 40,
    tagline: "Dozens of Opus sessions. Saves 33%.",
  },
  {
    id: "max",
    name: "Max",
    credits: 100_000,
    priceUsd: 150,
    tagline: "Teams / power users. Saves 50%.",
  },
];

export const getPackById = (id: string): CreditPack | undefined =>
  CREDIT_PACKS.find((p) => p.id === id);
