/**
 * omzig.ai GDAP vertical role bundles — Omzig Custom CIPP Build v1.1 §6.1 / §17 item 10.
 *
 * Each bundle is a static JSON file shaped for /api/ExecGDAPRoleTemplate?Action=Add:
 *   { $comment, TemplateId, Vertical, Description, RoleMappings: [{ GroupName, RoleName, roleDefinitionId }] }
 *
 * Imported statically (not fetched) so the bundle catalog is available at build
 * time and ships in the client bundle — Next.js supports JSON imports natively.
 */

import FamilyOfficeFinancial from './FamilyOffice-Financial.json'
import HealthcareHIPAA from './Healthcare-HIPAA.json'
import Hospitality from './Hospitality.json'
import LegalEthics from './Legal-Ethics.json'
import TitleALTA from './Title-ALTA.json'
import WealthSEC from './Wealth-SEC.json'

export const OMZIG_GDAP_BUNDLES = [
  FamilyOfficeFinancial,
  HealthcareHIPAA,
  Hospitality,
  LegalEthics,
  TitleALTA,
  WealthSEC,
].sort((a, b) => a.TemplateId.localeCompare(b.TemplateId))
