/** Edit this file to change hero copy and project links. */

export const site = {
  name: "Arko Bhattacharyya",
  title: "Arko Bhattacharyya — Strategy, growth, and product",
  description:
    "Strategy and growth professional with a passion for technology. Portfolio of Gov Pulse, Sector, My Bookshelf, and Fantasy Draft Helper.",
  hero: {
    intro: "I am",
    name: "Arko Alex Bhattacharyya",
    body: "a strategy and growth professional with 5 years of experience. I specialize in conducting research and generating insights to inform business decision-making. I am passionate about the intersection of AI, people, and innovation.",
  },
  contact: {
    github: "https://github.com/alexarkob",
    email: "alexarkob@gmail.com",
    linkedin: "https://www.linkedin.com/in/arko-bhattacharyya/",
    // Absolute URL so the button always opens the PDF (relative paths can 404 → landing)
    resume: "https://arko-portfolio.pages.dev/Arko-Bhattacharyya-Resume-Aug-2026.pdf",
  },
  demos: {
    // Working hosts today; switch to custom domains after DNS CNAMEs propagate
    govpulse: "https://arko-govpulse.vercel.app",
    sector: "https://arko-f1-sector.vercel.app",
    bookshelf: "https://arko-bookshelf.pages.dev",
    draft: "https://arko-portfolio.pages.dev/draft/",
  },
  projects: [
    {
      id: "gov-pulse",
      name: "Gov Pulse",
      tagline: "Official federal signal for consultants",
      summary:
        "Ingests Federal Register and agency announcements, deduplicates them, and surfaces cited daily rundowns and trends—so every claim links back to a primary source.",
      stack: ["Next.js", "TypeScript", "Prisma", "Turso"],
      highlights: [
        "End-to-end pipeline: ingest → analyze → social",
        "Citation gate—no primary URL, no claim",
        "Theme clustering and reliability-scored sources",
      ],
      demoUrl: "https://arko-govpulse.vercel.app" as string | null,
      comingSoon: false,
      github: "https://github.com/alexarkob/gov-pulse" as string | null,
    },
    {
      id: "sector",
      name: "F1 Qualifying Dashboard",
      tagline: "Compare qualifying sector times from real Formula 1 data",
      summary:
        "Compare qualifying sector times from real Formula 1 data",
      stack: ["Next.js", "TypeScript", "Recharts", "OpenF1"],
      highlights: [
        "Animated lap playback on circuit minimaps",
        "Dual-driver brake/throttle overlay compare",
        "Rate-limit-aware OpenF1 API integration",
      ],
      demoUrl: "https://arko-f1-sector.vercel.app" as string | null,
      comingSoon: false,
      github: "https://github.com/alexarkob/f1-sector-analyzer" as string | null,
    },
    {
      id: "bookshelf",
      name: "My Bookshelf",
      tagline: "Your reading life, as shelves",
      summary:
        "Turn a Goodreads export into warm, browsable year shelves and a to-read list—with sync-aware updates and Open Library covers, all in the browser.",
      stack: ["React", "Vite", "TypeScript", "Open Library"],
      highlights: [
        "Goodreads CSV import with shelf mapping",
        "Sync preview diffs before you confirm",
        "Privacy-friendly client-only storage",
      ],
      demoUrl: "https://arko-bookshelf.pages.dev" as string | null,
      comingSoon: false,
      github: "https://github.com/alexarkob/my-bookshelf" as string | null,
    },
    {
      id: "fantasy-draft",
      name: "Fantasy Draft Helper",
      tagline: "Free 8-team PPR draft board for anyone",
      summary:
        "A free draft-day product: live 8-team PPR ADP, position lists, custom tiers, private notes, and printable PDF cheat sheets. Prep stays in the visitor’s browser—nothing is uploaded.",
      stack: ["Astro", "React", "TypeScript", "FFC ADP"],
      highlights: [
        "Master + position ADP lists with drafted tracking",
        "Tier boards 1–8 with color highlights across views",
        "Private local notes, export/import, and PDF cheat sheets",
      ],
      demoUrl: "https://arko-portfolio.pages.dev/draft/" as string | null,
      comingSoon: false,
      github: "https://github.com/alexarkob/website-launch" as string | null,
    },
  ],
} as const;
