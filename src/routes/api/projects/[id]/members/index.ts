import type { RequestHandler } from "@builder.io/qwik-city";
import { getSessionFromRequest } from "~/lib/session";
import { getDB, initDB } from "~/lib/db";
import { eq, and } from "drizzle-orm";

export const onGet: RequestHandler = async ({ params, json, platform }) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const projectId = parseInt(params.id, 10);
  const db = getDB(platform);
  await initDB(db, platform);

  const { projects, projectMembers, user } = await import("~/lib/schema");

  const [project] = await db
    .select({ id: projects.id, user_id: projects.user_id })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  const isOwner = project.user_id === session.user.id;
  const isMember = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, session.user.id),
      ),
    );

  if (!isOwner && isMember.length === 0) {
    json(403, { error: "Forbidden" });
    return;
  }

  // Owner as first member
  const ownerResult = project.user_id
    ? await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, project.user_id))
    : [];

  const owner = ownerResult[0];

  const membersResult = await db
    .select({
      id: projectMembers.id,
      user_id: projectMembers.user_id,
      role: projectMembers.role,
      created_at: projectMembers.created_at,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(projectMembers)
    .leftJoin(user, eq(projectMembers.user_id, user.id))
    .where(eq(projectMembers.project_id, projectId));

  json(200, {
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          image: owner.image,
        }
      : null,
    members: membersResult.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      name: m.name,
      email: m.email,
      image: m.image,
    })),
    isOwner,
  });
};

export const onPost: RequestHandler = async ({ params, json, platform }) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const projectId = parseInt(params.id, 10);
  const db = getDB(platform);
  await initDB(db, platform);

  const { projects, projectMembers, user } = await import("~/lib/schema");

  const [project] = await db
    .select({ id: projects.id, user_id: projects.user_id })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  if (project.user_id !== session.user.id) {
    json(403, { error: "Only owner can invite members" });
    return;
  }

  const body = (await platform.request!.json()) as {
    email: string;
    role?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const role = body.role === "viewer" ? "viewer" : "editor";

  if (!email) {
    json(400, { error: "Email required" });
    return;
  }

  // Find user by email
  const targetUser = await db.select().from(user).where(eq(user.email, email));
  if (!targetUser.length) {
    json(404, { error: "User not found" });
    return;
  }

  const targetUserId = targetUser[0].id;
  if (targetUserId === session.user.id) {
    json(400, { error: "Cannot invite yourself" });
    return;
  }

  // Check if already member
  const existing = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, targetUserId),
      ),
    );

  if (existing.length > 0) {
    json(409, { error: "Already a member" });
    return;
  }

  await db.insert(projectMembers).values({
    project_id: projectId,
    user_id: targetUserId,
    role,
  });

  json(200, {
    success: true,
    member: {
      user_id: targetUserId,
      role,
      name: targetUser[0].name,
      email: targetUser[0].email,
      image: targetUser[0].image,
    },
  });
};

export const onPut: RequestHandler = async ({ params, json, platform }) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const projectId = parseInt(params.id, 10);
  const db = getDB(platform);
  await initDB(db, platform);

  const { projects, projectMembers } = await import("~/lib/schema");

  const [project] = await db
    .select({ id: projects.id, user_id: projects.user_id })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  if (project.user_id !== session.user.id) {
    json(403, { error: "Only owner can update roles" });
    return;
  }

  const body = (await platform.request!.json()) as {
    user_id: string;
    role: string;
  };
  const { user_id, role } = body;
  const validRole = role === "viewer" ? "viewer" : "editor";

  await db
    .update(projectMembers)
    .set({ role: validRole })
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, user_id),
      ),
    );

  json(200, { success: true });
};

export const onDelete: RequestHandler = async ({
  params,
  json,
  platform,
  query,
}) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const projectId = parseInt(params.id, 10);
  const db = getDB(platform);
  await initDB(db, platform);

  const { projects, projectMembers } = await import("~/lib/schema");

  const [project] = await db
    .select({ id: projects.id, user_id: projects.user_id })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  if (project.user_id !== session.user.id) {
    json(403, { error: "Only owner can remove members" });
    return;
  }

  const userId = query.get("user_id");
  if (!userId) {
    json(400, { error: "user_id required" });
    return;
  }

  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, userId),
      ),
    );

  json(200, { success: true });
};
