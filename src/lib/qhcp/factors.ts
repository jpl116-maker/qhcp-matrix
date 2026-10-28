export type Direction = "support" | "contrary";

export type Factor = {
  id: number;
  category: string;
  text: string;
  direction: Direction;
  hook: string;
};

export const IDENTITY_FIELDS = [
  { key: "jurisdiction", label: "State / jurisdiction" },
  {
    key: "license",
    label:
      "License or state regulatory classification (none / AL / SNF / regulated IL / other)",
  },
  { key: "unitMix", label: "Unit mix (IL / AL / memory care / SNF counts or %)" },
  { key: "marketed", label: "Marketed name / product type" },
  { key: "operator", label: "Operator / manager (EIK, TRS, third party)" },
  {
    key: "structure",
    label: "Intended REIT structure (lease to TRS + EIK vs. TRS operates)",
  },
] as const;

export type IdentityKey = (typeof IDENTITY_FIELDS)[number]["key"];

export const FACTORS: Factor[] = [
  {
    id: 1,
    category: "A. Licensing & statutory category",
    text: "Is the facility licensed by the state as a hospital, nursing facility, assisted living facility, or similar facility that extends medical, nursing, or ancillary services to patients?",
    direction: "support",
    hook: "§856(e)(6)(D)(ii)",
  },
  {
    id: 2,
    category: "A. Licensing & statutory category",
    text: "Is the facility a qualified continuing care facility within the meaning of §7872(g)(4) (CCRC / life-plan community meeting the statutory tests)?",
    direction: "support",
    hook: "§856(e)(6)(D)(ii); §7872(g)(4)",
  },
  {
    id: 3,
    category: "A. Licensing & statutory category",
    text: "Is the facility registered or classified by a state health regulator as a regulated community that must comply with health-care regulations (initial/periodic health screenings; written agreement with a licensed home-health or similar provider)?",
    direction: "support",
    hook: "PLR 202415001",
  },
  {
    id: 4,
    category: "A. Licensing & statutory category",
    text: "Was the facility (or would it have been) operated by a provider eligible to participate in Medicare with respect to the facility?",
    direction: "support",
    hook: "§856(e)(6)(D)(ii)",
  },
  {
    id: 5,
    category: "A. Licensing & statutory category",
    text: "Is the facility unlicensed as a health-care facility and not subject to any state health-care regulatory classification?",
    direction: "contrary",
    hook: "PLRs 200813005; 202020007; 202415001",
  },
  {
    id: 6,
    category: "B. Marketing & resident contracts",
    text: "Is the community marketed, branded, and described in brochures as independent retirement living / age-restricted multifamily rather than as a health-care or congregate-care community?",
    direction: "contrary",
    hook: "PLR 202020007",
  },
  {
    id: 7,
    category: "B. Marketing & resident contracts",
    text: "Do the resident lease or residency agreement expressly state that the community does not provide health-care services?",
    direction: "contrary",
    hook: "PLR 202020007",
  },
  {
    id: 8,
    category: "B. Marketing & resident contracts",
    text: "Do the resident agreements stipulate that the resident is solely responsible for his or her own personal and health-care needs?",
    direction: "contrary",
    hook: "PLRs 202020007; 202317017/018; 202415001",
  },
  {
    id: 9,
    category: "B. Marketing & resident contracts",
    text: "Is the community marketed and operated as a service-intensive senior environment whose purpose includes monitoring and improving residents’ health and well-being?",
    direction: "support",
    hook: "PLRs 201147015; 201429017; 201509019",
  },
  {
    id: 10,
    category: "B. Marketing & resident contracts",
    text: "Does pre-admission screening exist for the purpose of confirming that the resident does not need facility-provided medical or personal care (i.e., to keep out acuity)?",
    direction: "contrary",
    hook: "PLR 202020007",
  },
  {
    id: 11,
    category: "B. Marketing & resident contracts",
    text: "Does pre-admission or periodic screening exist for the purpose of assessing health status and arranging or procuring care (i.e., a health-management screen)?",
    direction: "support",
    hook: "PLR 202415001",
  },
  {
    id: 12,
    category: "C. Health monitoring & clinical overlay",
    text: "Does on-site staff include licensed medical or nursing personnel (RN, LPN, therapist, clinical director) whose duties include resident health?",
    direction: "support",
    hook: "PLRs 201429017; 201828008",
  },
  {
    id: 13,
    category: "C. Health monitoring & clinical overlay",
    text: "Is there a dedicated full-time employee charged with health-related educational programs, coordinating third-party medical providers, monitoring suitability of the living environment, and communicating with families about medical needs?",
    direction: "support",
    hook: "PLR 201429017",
  },
  {
    id: 14,
    category: "C. Health monitoring & clinical overlay",
    text: "Does the operator actively monitor residents’ health (daily or regular wellness checks, informal observation by 24-hour staff who eat and interact with residents for that purpose)?",
    direction: "support",
    hook: "PLRs 201147015; 201828008",
  },
  {
    id: 15,
    category: "C. Health monitoring & clinical overlay",
    text: "Are initial and periodic (at least annual) health screenings performed by or for the community as a required operational practice?",
    direction: "support",
    hook: "PLR 202415001",
  },
  {
    id: 16,
    category: "C. Health monitoring & clinical overlay",
    text: "Does management actively procure or arrange health-care services for a resident when needed, rather than leaving the resident to find a provider unaided?",
    direction: "support",
    hook: "PLR 202415001",
  },
  {
    id: 17,
    category: "C. Health monitoring & clinical overlay",
    text: "Is there a written agreement between the community and at least one licensed home-health, hospice, therapy, or similar provider under which services are furnished to residents?",
    direction: "support",
    hook: "PLR 202415001",
  },
  {
    id: 18,
    category: "C. Health monitoring & clinical overlay",
    text: "Does the community supervise health-related in-unit activities such as oxygen equipment, in-home care, or similar clinical equipment use?",
    direction: "support",
    hook: "PLRs 201147015; 201429017",
  },
  {
    id: 19,
    category: "C. Health monitoring & clinical overlay",
    text: "Does the community maintain DNR / “file of life” medical documents for residents and post or store them for emergency use?",
    direction: "support",
    hook: "PLRs 201429017; 201828008",
  },
  {
    id: 20,
    category: "C. Health monitoring & clinical overlay",
    text: "Is there an on-site rehabilitation, therapy, or outpatient clinic (PT / OT / speech), or regularly scheduled on-site clinical services?",
    direction: "support",
    hook: "PLR 201429017",
  },
  {
    id: 21,
    category: "C. Health monitoring & clinical overlay",
    text: "Are optional on-site health-care services (home health, hospice, companion / CNA, outpatient therapy) offered to residents through the community’s program, even if separately billed or Medicare-covered?",
    direction: "support",
    hook: "PLRs 201147015; 201429017",
  },
  {
    id: 22,
    category: "C. Health monitoring & clinical overlay",
    text: "Is there a resident-transfer or “age-in-place” program that provides priority access, temporary higher-acuity services, or a defined path to AL / SNF on the same campus or under the same operator?",
    direction: "support",
    hook: "PLRs 201429017; 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 23,
    category: "C. Health monitoring & clinical overlay",
    text: "Are community staff unlicensed for health care, and do they refrain from diagnosing, treating, medicating, or assisting with activities of daily living?",
    direction: "contrary",
    hook: "PLRs 202415001; 202317017/018",
  },
  {
    id: 24,
    category: "C. Health monitoring & clinical overlay",
    text: "Is there no medical monitoring, no health screening after move-in, and no transfer program to higher-acuity care?",
    direction: "contrary",
    hook: "PLRs 202020007; 202317017/018",
  },
  {
    id: 25,
    category: "D. Amenities — purpose test",
    text: "Are congregate meals planned for the dietary needs of seniors and served in a community dining room as part of a health-and-wellness program (not merely a restaurant amenity)?",
    direction: "support",
    hook: "PLRs 201509019; 201828008",
  },
  {
    id: 26,
    category: "D. Amenities — purpose test",
    text: "Are activities and programming specifically about physical, social, and mental wellness issues common to seniors (fall prevention, chronic-condition education, cognitive wellness), rather than generic social events?",
    direction: "support",
    hook: "PLRs 201509019; 201828008",
  },
  {
    id: 27,
    category: "D. Amenities — purpose test",
    text: "Do housekeeping, linen, scheduled transportation, emergency pendants, and similar amenities exist, but is the operator’s stated emphasis convenience and a social living environment rather than a health benefit?",
    direction: "contrary",
    hook: "PLRs 202020007; 202317017/018; 202415001",
  },
  {
    id: 28,
    category: "D. Amenities — purpose test",
    text: "Are the healthcare-related services and alternatives offered at the facility services that are not typically available in ordinary multifamily rental properties in the same market?",
    direction: "support",
    hook: "PLRs 201147015; 201429017; 201509019; 201647005",
  },
  {
    id: 29,
    category: "D. Amenities — purpose test",
    text: "Does every unit have an emergency-call system, and are personal emergency pendants issued, as part of a resident-safety / health-response protocol staffed by the community (not merely a third-party alarm vendor with no community follow-up)?",
    direction: "support",
    hook: "PLRs 201147015; 201828008",
  },
  {
    id: 30,
    category: "D. Amenities — purpose test",
    text: "Is the building equipped with aging-in-place physical features used in connection with a health-and-wellness program (handrails, locked exterior doors at night for resident security, sharps containers, fitness programming supervised for seniors)?",
    direction: "support",
    hook: "PLR 201828008",
  },
  {
    id: 31,
    category: "E. Mixed-use / campus integration",
    text: "Are independent-living and assisted-living (or memory-care / SNF) units located in the same building or on the same parcel?",
    direction: "support",
    hook: "PLRs 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 32,
    category: "E. Mixed-use / campus integration",
    text: "Are the AL (or higher-acuity) units licensed by the state to the extent licensing is required?",
    direction: "support",
    hook: "PLRs 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 33,
    category: "E. Mixed-use / campus integration",
    text: "Is the property operated, managed, and marketed as one integrated community with different service options, rather than as separate products on a shared site?",
    direction: "support",
    hook: "PLRs 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 34,
    category: "E. Mixed-use / campus integration",
    text: "Do IL and AL residents share common-area facilities and services?",
    direction: "support",
    hook: "PLRs 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 35,
    category: "E. Mixed-use / campus integration",
    text: "When a resident requires assistance with activities of daily living, can the resident transition from an IL unit to an AL unit on the same property (subject to availability)?",
    direction: "support",
    hook: "PLRs 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 36,
    category: "E. Mixed-use / campus integration",
    text: "Is a significant number or percentage of units occupied as licensed AL (or memory-care / SNF) units?",
    direction: "support",
    hook: "PLRs 201104023/033; 201125013; 201250019; 201647005",
  },
  {
    id: 37,
    category: "F. Third-party / commercial health presence",
    text: "Do unrelated commercial tenants on site offer in-home health or personal-care services that are available both to residents and to the general public, without community control, supervision, referral exclusivity, or required use?",
    direction: "contrary",
    hook: "PLRs 202317017/018; 202415001",
  },
  {
    id: 38,
    category: "F. Third-party / commercial health presence",
    text: "If third-party clinicians operate on site, does community management control, arrange, or require use of those clinicians as part of the community’s own care program?",
    direction: "support",
    hook: "PLR 202415001",
  },
];

export const CATEGORIES = [...new Set(FACTORS.map((f) => f.category))];

export function questionText(factor: Factor, questions?: Partial<Record<number, string>>) {
  const custom = questions?.[factor.id];
  if (typeof custom !== "string") return factor.text;
  const trimmed = custom.trim();
  return trimmed || factor.text;
}

export function citationText(factor: Factor, citations?: Partial<Record<number, string>>) {
  const custom = citations?.[factor.id];
  const raw = typeof custom === "string" && custom.trim() ? custom.trim() : factor.hook;
  return onlyPlrsAndStatutes(raw);
}

const MIXED_USE_PLRS = "201104023/033; 201125013; 201250019; 201647005";

export function onlyPlrsAndStatutes(text: string) {
  const source = text.replace(/mixed-use series/gi, MIXED_USE_PLRS);
  const hits = source.matchAll(/§\s*\d+(?:\([^)]+\))*|\b\d{9}(?:\/\d{3})?\b/g);
  const sections: string[] = [];
  const plrs: string[] = [];
  for (const hit of hits) {
    const token = hit[0].replace(/\s+/g, "");
    if (token.startsWith("§")) {
      if (!sections.includes(token)) sections.push(token);
    } else if (!plrs.includes(token)) {
      plrs.push(token);
    }
  }
  const parts: string[] = [];
  if (sections.length) parts.push(sections.join("; "));
  if (plrs.length) parts.push(`${plrs.length > 1 ? "PLRs" : "PLR"} ${plrs.join("; ")}`);
  return parts.join("; ");
}

export function categoryName(category: string, categories?: Partial<Record<string, string>>) {
  const custom = categories?.[category];
  if (typeof custom !== "string") return category;
  const trimmed = custom.trim();
  return trimmed || category;
}
