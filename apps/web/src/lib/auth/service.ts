import 'server-only';
import { prisma, MembershipRole } from '@nexus/db';
import type { LoginDTO, RegisterDTO } from '@nexus/shared';
import { hashPassword, verifyPassword } from './password.js';
import type { SessionPayload } from './session.js';

/** Errors surfaced to auth route handlers as 4xx. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org'
  );
}

/** Register a user, create their organization, and return a session payload. */
export async function registerUser(input: RegisterDTO): Promise<SessionPayload> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError('An account with that email already exists.', 409);

  const passwordHash = await hashPassword(input.password);

  // Ensure a unique org slug.
  const base = slugify(input.organizationName);
  let slug = base;
  for (let n = 1; await prisma.organization.findUnique({ where: { slug } }); n++) {
    slug = `${base}-${n}`;
  }

  // User + org + owner membership atomically.
  const { membership } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, passwordHash },
    });
    const org = await tx.organization.create({
      data: { name: input.organizationName, slug },
    });
    const membership = await tx.membership.create({
      data: { userId: user.id, orgId: org.id, role: MembershipRole.OWNER },
    });
    return { membership };
  });

  return { userId: membership.userId, orgId: membership.orgId, role: membership.role };
}

/** Verify credentials and return the session payload for the user's first org. */
export async function loginUser(input: LoginDTO): Promise<SessionPayload> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
  });
  if (!user) throw new AuthError('Invalid email or password.', 401);

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new AuthError('Invalid email or password.', 401);

  const membership = user.memberships[0];
  if (!membership) throw new AuthError('User has no organization.', 403);

  return { userId: user.id, orgId: membership.orgId, role: membership.role };
}
