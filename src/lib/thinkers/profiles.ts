import benProfile from "../../content/thinkers/ben-thompson/profile.json";
import benedictProfile from "../../content/thinkers/benedict-evans/profile.json";
import packyProfile from "../../content/thinkers/packy-mccormick/profile.json";
import type { ThinkerId, ThinkerProfile } from "./types";

const profiles: Record<ThinkerId, ThinkerProfile> = {
  "packy-mccormick": packyProfile as ThinkerProfile,
  "ben-thompson": benProfile as ThinkerProfile,
  "benedict-evans": benedictProfile as ThinkerProfile,
};

export function getThinkerProfile(id: ThinkerId): ThinkerProfile {
  return profiles[id];
}

export function listThinkerProfiles(): ThinkerProfile[] {
  return [
    profiles["packy-mccormick"],
    profiles["ben-thompson"],
    profiles["benedict-evans"],
  ];
}
