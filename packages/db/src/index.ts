export { prisma } from './client.js';

// Re-export generated Prisma types + enums so consumers import DB types from a
// single place (`@nexus/db`) rather than reaching into generated paths.
export {
  Prisma,
  type Organization,
  type User,
  type Membership,
  type Session,
  type OAuthAccount,
  type AgentJob,
  type Approval,
  type AuditLog,
  type Document,
  MembershipRole,
  IntegrationProvider,
  JobStatus,
  ApprovalStatus,
} from '../generated/client/index.js';
