import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";

interface Member {
  id: number;
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  image: string | null;
  created_at: string | null;
}

interface Owner {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export const ProjectMembers = component$(
  ({ projectId }: { projectId: number }) => {
    const loading = useSignal(false);
    const inviteEmail = useSignal("");
    const inviteRole = useSignal<"editor" | "viewer">("editor");
    const owner = useSignal<Owner | null>(null);
    const members = useSignal<Member[]>([]);
    const isOwner = useSignal(false);
    const error = useSignal("");

    const fetchMembers = $(async () => {
      loading.value = true;
      error.value = "";
      try {
        const res = await fetch(`/api/projects/${projectId}/members`);
        if (res.ok) {
          const data = (await res.json()) as {
            owner: Owner;
            members: Member[];
            isOwner: boolean;
          };
          owner.value = data.owner;
          members.value = data.members || [];
          isOwner.value = data.isOwner;
        } else {
          error.value = "加载失败";
        }
      } catch {
        error.value = "加载失败";
      } finally {
        loading.value = false;
      }
    });

    const invite = $(async () => {
      if (!inviteEmail.value.trim()) return;
      error.value = "";
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.value.trim(),
          role: inviteRole.value,
        }),
      });
      if (res.ok) {
        inviteEmail.value = "";
        await fetchMembers();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        error.value = data.error || "邀请失败";
      }
    });

    const removeMember = $((userId: string) => {
      if (!confirm("确定移除该成员？")) return;
      fetch(`/api/projects/${projectId}/members?user_id=${userId}`, {
        method: "DELETE",
      }).then(() => fetchMembers());
    });

    const updateRole = $((userId: string, role: string) => {
      fetch(`/api/projects/${projectId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role }),
      }).then(() => fetchMembers());
    });

    // eslint-disable-next-line qwik/no-use-visible-task
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      fetchMembers();
    });

    const Avatar = ({
      src,
      name,
    }: {
      src: string | null;
      name: string | null;
    }) => (
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
        {src ? (
          <img
            src={src}
            alt={name || ""}
            class="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span>{(name || "?").charAt(0).toUpperCase()}</span>
        )}
      </div>
    );

    return (
      <div class="space-y-5">
        {error.value && (
          <div class="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
            {error.value}
          </div>
        )}

        {isOwner.value && (
          <div class="flex gap-2">
            <input
              type="email"
              class="input-clay flex-1 px-4 py-2.5 text-sm"
              placeholder="输入成员邮箱..."
              value={inviteEmail.value}
              onInput$={(ev: any) => (inviteEmail.value = ev.target.value)}
            />
            <select
              class="input-clay px-3 py-2.5 text-sm"
              value={inviteRole.value}
              onChange$={(ev: any) => (inviteRole.value = ev.target.value)}
            >
              <option value="editor">编辑者</option>
              <option value="viewer">查看者</option>
            </select>
            <button
              class="clay-button rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white"
              onClick$={invite}
            >
              邀请
            </button>
          </div>
        )}

        <div class="space-y-2">
          {/* Owner */}
          {owner.value && (
            <div class="flex items-center gap-3 rounded-2xl bg-rose-50/50 px-4 py-3">
              <Avatar src={owner.value.image} name={owner.value.name} />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-rose-900">
                  {owner.value.name || "未命名"}
                </p>
                <p class="truncate text-xs text-rose-400/70">
                  {owner.value.email}
                </p>
              </div>
              <span class="rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                所有者
              </span>
            </div>
          )}

          {/* Members */}
          {members.value.map((m) => (
            <div
              key={m.id}
              class="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3"
            >
              <Avatar src={m.image} name={m.name} />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-rose-900">
                  {m.name || "未命名"}
                </p>
                <p class="truncate text-xs text-rose-400/70">{m.email}</p>
              </div>
              {isOwner.value ? (
                <div class="flex items-center gap-2">
                  <select
                    class="input-clay px-2 py-1 text-xs"
                    value={m.role}
                    onChange$={(ev: any) =>
                      updateRole(m.user_id, ev.target.value)
                    }
                  >
                    <option value="editor">编辑者</option>
                    <option value="viewer">查看者</option>
                  </select>
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                    onClick$={() => removeMember(m.user_id)}
                    title="移除"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <span class="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-600">
                  {m.role === "editor" ? "编辑者" : "查看者"}
                </span>
              )}
            </div>
          ))}

          {members.value.length === 0 && !loading.value && (
            <p class="py-4 text-center text-sm text-rose-400/60">
              暂无协作成员
            </p>
          )}
        </div>
      </div>
    );
  },
);
