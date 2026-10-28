import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples", "willowbrook-at-hanover");
const banner = "SAMPLE — HYPOTHETICAL. Not a government form, lease, or license. Prepared for the QHCP matrix.";

function escapePdf(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text, width) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function writePdf(path, title, body) {
  const lines = wrap(`${title}\n\n${banner}\n\n${body}\n\n${banner}`, 88);
  const pageSize = 46;
  const pages = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  const objects = [];
  const pageIds = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(null);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  pages.forEach((pageLines, pageIndex) => {
    const commands = ["BT", "/F1 10 Tf", "14 TL", "54 748 Td"];
    pageLines.forEach((line, lineIndex) => {
      const font = lineIndex === 0 && pageIndex === 0 ? "/F2 14 Tf" : "/F1 10 Tf";
      const leading = lineIndex === 0 && pageIndex === 0 ? "18 TL" : "14 TL";
      commands.push(`${font} ${leading} (${escapePdf(line)}) Tj T*`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(objects.length + 1);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
  });
  objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(path, output);
}

async function writeDocx(path, title, body) {
  const paragraphs = [title, "", banner, "", ...body.split("\n"), "", banner]
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${line.replace(/&/g, "&").replace(/</g, "<")}</w:t></w:r></w:p>`)
    .join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`,
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(path, buffer);
}

const overview = `Willowbrook at Hanover
1400 Meadow Run Road, Hanover, Virginia 23069

Willowbrook at Hanover is one senior living campus. It contains 120 independent-living apartments, 48 assisted-living units, and 16 memory-care units. The assisted-living and memory-care units are in the same building as the independent-living apartments and are on the same parcel. Residents of every level share the dining room, the wellness clinic, the fitness room, and the transportation program.

The campus is owned by Meadow Run REIT, Inc. The REIT leases the entire real property to Willowbrook TRS, LLC. Willowbrook TRS does not itself furnish health care. It engages Hanover Care Partners, LLC as manager. Hanover Care Partners is described in the management agreement as an eligible independent contractor.

The assisted-living and memory-care units are licensed by the Virginia Department of Social Services as an assisted living facility. The license includes a safe, secure memory-care unit. The community is not a hospital and is not a nursing facility. Neither the owner nor the manager is certified to participate in Medicare with respect to this facility, and the facility would not have been operated by a Medicare-participating provider.

The independent-living apartments are not separately licensed. They are marketed and operated as part of the same congregate-care community, not as a separate age-restricted apartment product.

Unit mix in operation: 120 independent living (65 percent), 48 assisted living (26 percent), and 16 memory care (9 percent). Sixty-four of 184 units, about 35 percent, are licensed assisted-living or memory-care units.

Marketed name: Willowbrook at Hanover, a congregate care community.`;

const license = `Virginia Department of Social Services
Assisted Living Facility License
HYPOTHETICAL SAMPLE — NOT ISSUED BY THE COMMONWEALTH

License number: SAMPLE-ALF-23069
Facility name: Willowbrook at Hanover Assisted Living
Address: 1400 Meadow Run Road, Hanover, Virginia 23069
Licensee: Hanover Care Partners, LLC
Capacity: 64 residents
Classification: Assisted living facility under Title 63.2 of the Code of Virginia and 22VAC40-73, including a 16-resident safe, secure memory-care unit.

This sample license states the following conditions, which the operator treats as applicable to the licensed portion of the campus:

1. The facility is licensed to provide assistance with activities of daily living, medication administration by staff acting within the scope of their licenses, and a coordinated plan of care.
2. The facility must complete an initial health screening before admission and a periodic health screening at least annually.
3. The facility must maintain a written agreement with at least one licensed home-health provider under which services are furnished to residents.
4. This license is not a hospital license and is not a nursing-facility license.
5. The licensee is not approved on this license to participate in the Medicare program as a skilled nursing facility.

The independent-living apartments at the same street address are not covered by this license number. They are on the same parcel and in the same building and are operated by the same manager as one community with the licensed units.`;

const ilLease = `Independent Living Residency Agreement
Willowbrook at Hanover
Resident: Sample Resident A
Apartment: IL-214
Date: March 1, 2026

1. Community. The community is Willowbrook at Hanover, a congregate care community in Hanover, Virginia. Independent living, assisted living, and memory care are offered in one building on one parcel and are operated as one community.

2. Purpose. The stated purpose of the community is to monitor and improve the health and well-being of residents. The residency is not marketed as ordinary age-restricted multifamily housing.

3. Health screening. Before move-in, and at least annually after move-in, the community performs a health screening. The purpose of the screening is to assess the resident's health status and to arrange or procure appropriate services. The screening is not used to keep out residents who may later need care. If the resident needs assistance with activities of daily living, the resident may transfer to an assisted-living unit in this building, subject to availability and licensure.

4. Wellness staff. A full-time registered nurse is the wellness director. The wellness director's duties include resident health, health-education programs, coordinating outside medical providers, monitoring whether the apartment remains suitable, and speaking with families about medical needs. Licensed practical nurses are on the wellness staff. Twenty-four-hour staff conduct a daily wellness check and eat with and observe residents for changes in condition.

5. Arranged care. When a resident needs home health, hospice, therapy, or personal care, management actively arranges that care. The community has a written agreement with Rappahannock Home Health, LLC. The community supervises health-related in-apartment equipment, including oxygen concentrators and other clinical equipment used in the unit.

6. File of life. The community keeps a file-of-life packet for each resident, including any DNR or advance directive the resident provides, and posts the current packet for emergency responders.

7. Emergency call. Every apartment has an emergency-call system. Each resident is issued a personal emergency pendant. Community staff, not an outside alarm vendor acting alone, receive the call and respond.

8. Meals and program. The monthly fee includes congregate meals planned for the dietary needs of older adults and served in the community dining room as part of the health program. Activities include fall-prevention classes, chronic-condition education, and cognitive-wellness sessions. Housekeeping, linen, and scheduled transportation are included. The operator states that these services are part of the health-and-wellness program, not a convenience package for a social club.

9. Building. Handrails are installed in corridors. Exterior doors lock at night for resident security. A fitness room is used for programming supervised for older adults. Sharps containers are maintained in the wellness clinic.

10. What this agreement does not say. This agreement does not state that the community provides no health-care services. It does not state that the resident is solely responsible for the resident's health-care needs. Staff are not limited to unlicensed hospitality duties.

11. Charges. There is no entrance fee and no continuing-care contract within the meaning of section 7872(g)(4). This is a monthly residency agreement.`;

const alAgreement = `Assisted Living Resident Agreement
Willowbrook at Hanover Assisted Living
License SAMPLE-ALF-23069
Resident: Sample Resident B
Unit: AL-12
Date: March 1, 2026

The resident is admitted to the licensed assisted-living portion of Willowbrook at Hanover, operated by Hanover Care Partners, LLC, in Hanover, Virginia.

Services include assistance with bathing, dressing, and other activities of daily living; medication administration by licensed nursing staff; a written plan of care; and daily observation by the wellness team. A registered nurse supervises the licensed practical nurses assigned to assisted living and memory care.

The memory-care unit is a safe, secure unit on the same license and on the same floor of the same building. A resident who can no longer live in an independent-living apartment may move to an assisted-living or memory-care unit on this property, subject to an available unit and to the license rules.

Meals are therapeutic as ordered and are served in the shared dining room. Independent-living and assisted-living residents use the same common areas.

The community arranges home health and therapy through its contracted providers when the plan of care calls for them. On-site physical, occupational, and speech therapy is scheduled in the wellness clinic by Piedmont Therapy Group under a written services agreement.

This agreement does not make the facility a hospital or a skilled nursing facility. The operator is not Medicare-certified for this facility.`;

const brochure = `Willowbrook at Hanover
A congregate care community
Hanover, Virginia

Willowbrook at Hanover is a congregate care community. The purpose of the community is to monitor and improve the health and well-being of the people who live here. Independent living, assisted living, and memory care are one community, in one building, with one staff and one set of common rooms.

What is included
- A full-time registered nurse wellness director and licensed nursing staff
- A health screening before you move in, and a screening at least once a year, so the community can arrange the care you need
- Daily wellness checks by staff who are here around the clock
- Congregate meals planned around the dietary needs of older adults
- Fall-prevention classes, chronic-condition education, and cognitive-wellness programs
- An emergency pendant answered by Willowbrook staff
- A path to assisted living or memory care in this building if you later need help with daily activities
- Housekeeping, linen, and transportation as part of the health-and-wellness program

The brochure does not describe the community as an age-restricted apartment building or as independent retirement living with no care. It does not say that residents must arrange their own medical care without help from the community.

Licensed assisted living and memory care are available on site. The assisted-living program is licensed by the Virginia Department of Social Services.

Services of this kind, including licensed assisted living, on-site nursing, arranged home health, and a transfer to a higher level of care in the same building, are not typically available in ordinary multifamily rental properties in the Hanover market.`;

const homeHealth = `Home Health Services Agreement
Between Hanover Care Partners, LLC, as manager of Willowbrook at Hanover, and Rappahannock Home Health, LLC

Date: January 15, 2026
Place of service: 1400 Meadow Run Road, Hanover, Virginia

Rappahannock Home Health, LLC is a home health agency licensed by the Virginia Department of Health. Hanover Care Partners operates Willowbrook at Hanover.

The agency will furnish skilled nursing, home health aide, and hospice-coordination services to residents of Willowbrook at Hanover when the community's wellness director requests them. Services are furnished in independent-living apartments and in licensed assisted-living and memory-care units.

The community controls the referral relationship. The wellness director arranges the start of care, receives reports, and includes the agency in the resident's plan. Use of this agency is part of the community's own care program. A resident may choose another licensed agency, but the community still coordinates the outside provider and does not leave the resident to find care unaided.

This agreement does not lease the clinic to the agency as a public walk-in office. The agency does not offer these services to the general public from this building.`;

const therapy = `Therapy Services Agreement
Between Hanover Care Partners, LLC and Piedmont Therapy Group, LLC

Piedmont Therapy Group will provide physical therapy, occupational therapy, and speech therapy in the wellness clinic at Willowbrook at Hanover. Sessions are scheduled by the community at least four days each week. The clinic is on site. It is not a storefront open to the general public.

The wellness director refers residents and requires that therapy ordered by the plan of care be coordinated through this clinic or through another provider the community has approved. Community management arranges the service as part of the care program.

Piedmont Therapy Group is a licensed outpatient therapy provider. Billing may be private pay or, where a resident has coverage, through the resident's own Medicare benefit as a home-health or outpatient patient. That billing does not make Willowbrook at Hanover a Medicare-certified skilled nursing facility.`;

const job = `Position: Wellness Director
Employer: Hanover Care Partners, LLC
Location: Willowbrook at Hanover, Hanover, Virginia
Status: Full time. One dedicated position.

License required: Registered nurse, current Virginia license.

Duties include the health of residents, not hospitality. The director:
- Leads health-related education, including fall prevention and chronic-condition classes.
- Coordinates third-party medical providers, including Rappahannock Home Health and Piedmont Therapy Group.
- Monitors whether each independent-living apartment remains a suitable environment.
- Speaks with families about medical needs.
- Supervises licensed practical nurses who administer medication in assisted living and who assist with activities of daily living.
- Reviews the initial and annual health screenings.

The director does diagnose and does participate in treatment within the RN license. Community staff are not limited to unlicensed roles, and they do not refrain from assisting with activities of daily living.

There is medical monitoring. There is health screening after move-in. There is a transfer program to assisted living and memory care on this campus.`;

const emergency = `Emergency Response and File-of-Life Policy
Willowbrook at Hanover
Effective January 1, 2026

1. Every residential unit has a hard-wired emergency-call station. Every resident is issued a pendant. Calls annunciate at the staffed concierge desk and at the wellness office. A community employee responds in person. The system is not a private alarm contract under which an outside vendor calls 911 and the community has no duty to follow up.

2. For each resident the wellness office keeps a file-of-life packet: current medications, physician name, allergies, and any DNR or advance directive. A copy is stored in the packet by the apartment door for emergency medical services. Staff check the packet after a call.

3. Oxygen concentrators and similar in-unit clinical equipment may be used only with notice to the wellness director. Staff confirm that tubing is safe and that the resident is being followed by the contracted home-health agency or by a provider the community has coordinated.

4. Exterior doors lock at 8 p.m. Corridor handrails are part of the resident-safety program.`;

const dining = `Dining and Wellness Program
Willowbrook at Hanover

Congregate meals are planned by a dietitian consultant for the dietary needs of older adults, including diabetic, low-sodium, and texture-modified diets. Meals are served in the community dining room. The dining program is described in the operating budget as part of the health-and-wellness program, not as a restaurant amenity for a social club.

The monthly activity calendar is built around physical, social, and mental wellness issues common to older adults: fall prevention, blood-pressure education, diabetes education, and cognitive wellness. Generic social events occur, but they are not the stated emphasis.

Housekeeping, linen service, and scheduled transportation to physicians are offered. Management's written emphasis, in the resident handbook and in marketing, is the health benefit of those services. The handbook states that these services are not offered merely so that residents can enjoy a convenient social living environment.

The wellness clinic, the pendant response, the nursing staff, and the transfer to licensed assisted living are services not typically offered in ordinary multifamily rental housing in Hanover County.`;

const campus = `Unit Mix and Campus Description
Willowbrook at Hanover
1400 Meadow Run Road, Hanover, Virginia 23069

One building. One tax parcel. One operator.

Level 1 and Level 2: 120 independent-living apartments.
Level 3: 48 assisted-living units, licensed.
Level 3 secure wing: 16 memory-care units, licensed as part of the assisted-living license.

Independent-living residents and assisted-living residents use the same dining room, the same wellness clinic, the same fitness room, and the same transportation service.

A resident who needs help with activities of daily living can move from an independent-living apartment to an assisted-living unit in this building when a unit is available. The move does not require the resident to leave the property or change operators.

About 35 percent of the units are occupied as licensed assisted-living or memory-care units. That share is a significant part of the building, not a token wing.

The building is not a continuing-care retirement community and does not charge an entrance fee that would meet the tests for a qualified continuing care facility under section 7872(g)(4).`;

const dental = `Commercial Lease
Landlord: Meadow Run REIT, Inc.
Tenant: Hanover Family Dental, PLLC
Premises: Suite 100, street-front office at 1400 Meadow Run Road, Hanover, Virginia, with a separate public entrance.

The tenant operates a general dental practice. Patients include residents of Willowbrook at Hanover and members of the general public. The lease is a standard commercial lease.

Willowbrook management does not control the dental practice, does not supervise its clinicians, does not require residents to use it, and has no exclusive referral arrangement. The dental practice is not part of the community care program. Residents who want dental care make their own appointments.

This lease does not appoint the tenant as the community's home-health, nursing, or therapy provider.`;

const reitMemo = `Memorandum
To: File
From: Sample counsel
Date: February 2, 2026
Re: Willowbrook at Hanover — real estate and operating structure

This memorandum is a hypothetical sample.

Owner. Meadow Run REIT, Inc. holds fee title to 1400 Meadow Run Road, Hanover, Virginia, and to the building.

Lease. The REIT leases the entire property to Willowbrook TRS, LLC, a taxable REIT subsidiary, under a master lease. Rent is a fixed base rent plus a percentage of gross revenue.

Operation. Willowbrook TRS does not employ the wellness staff and does not furnish health care. The TRS has engaged Hanover Care Partners, LLC to manage and operate the community, including the licensed assisted-living and memory-care units. The engagement is intended to qualify Hanover Care Partners as an eligible independent contractor. The TRS's role is the leasehold, not the clinical operation.

License. The assisted-living license is held by Hanover Care Partners, LLC. The licensed premises are the assisted-living and memory-care units inside the leased building.

Intended REIT structure. Lease to a taxable REIT subsidiary, with an eligible independent contractor operating the health-care facility. The TRS does not operate the health-care facility.

Property name used with residents and in marketing: Willowbrook at Hanover.
State: Virginia.
License classification: Virginia DSS assisted living facility, with a memory-care unit. No nursing-facility license. No hospital license.
Operator / manager: Hanover Care Partners, LLC.
Unit mix: 120 independent living, 48 assisted living, 16 memory care.`;

rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const pdfs = [
  ["01-campus-overview.pdf", "Campus overview", overview],
  ["02-vdss-assisted-living-license-sample.pdf", "Assisted living license — sample", license],
  ["03-independent-living-residency-agreement.pdf", "Independent living residency agreement", ilLease],
  ["04-assisted-living-resident-agreement.pdf", "Assisted living resident agreement", alAgreement],
  ["05-marketing-brochure.pdf", "Marketing brochure", brochure],
  ["06-home-health-services-agreement.pdf", "Home health services agreement", homeHealth],
  ["07-therapy-services-agreement.pdf", "Therapy services agreement", therapy],
  ["09-emergency-response-policy.pdf", "Emergency response policy", emergency],
  ["10-dining-and-wellness-program.pdf", "Dining and wellness program", dining],
  ["11-unit-mix-and-campus.pdf", "Unit mix and campus", campus],
  ["12-commercial-lease-hanover-family-dental.pdf", "Commercial lease — Hanover Family Dental", dental],
];

for (const [name, title, body] of pdfs) writePdf(join(root, name), title, body);
await writeDocx(join(root, "08-wellness-director-position.docx"), "Wellness director position", job);
await writeDocx(join(root, "13-reit-lease-and-management-memo.docx"), "REIT lease and management memorandum", reitMemo);
writeFileSync(
  join(root, "14-unit-mix.csv"),
  "level,product,units,licensed\n1-2,independent living,120,no\n3,assisted living,48,yes\n3,memory care,16,yes\n",
);
writeFileSync(
  join(root, "00-read-me.txt"),
  `${banner}\n\nWillowbrook at Hanover is a fictional campus at 1400 Meadow Run Road, Hanover, Virginia. The folder holds a campus overview, a sample assisted-living license, an independent-living residency agreement, an assisted-living agreement, a marketing brochure, home-health and therapy contracts, a wellness-director job description, an emergency-response policy, a dining and wellness program, a unit mix, a commercial dental lease, and a REIT structure memo.\n`,
);

const archive = new JSZip();
const { readdirSync, readFileSync } = await import("node:fs");
for (const name of readdirSync(root)) {
  archive.file(`willowbrook-at-hanover/${name}`, readFileSync(join(root, name)));
}
writeFileSync(join(root, "..", "willowbrook-at-hanover.zip"), await archive.generateAsync({ type: "nodebuffer" }));
console.log("wrote", root);
