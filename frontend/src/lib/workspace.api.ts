import { apiFetch } from "@/lib/api";
import type {
  BidActivity,
  BidAttachment,
  BidTask,
  BidTaskComment,
  BidWorkspace,
} from "./workspace.types";

type WorkspaceTaskCommentApi = BidTaskComment & { body?: string };

type WorkspaceTaskApi = Omit<BidTask, "comments"> & {
  comments?: WorkspaceTaskCommentApi[];
};

type WorkspaceFullApiResponse = BidWorkspace & {
  tasks?: WorkspaceTaskApi[];
  activities?: BidActivity[];
  attachments?: BidAttachment[];
};

export async function getWorkspaceByTender(tenderId: string) {
  const res = await apiFetch<WorkspaceFullApiResponse>(
    `/api/v1/tenders/${tenderId}/workspace/full`,
    {
      method: "GET",
    },
  );
  if (!res.ok) return res;

  const rawWorkspace = res.data;
  const tasks: BidTask[] = (rawWorkspace.tasks ?? []).map((t) => ({
    ...t,
    comments: (t.comments ?? []).map((c) => {
      return {
        ...c,
        content: c.content ?? c.body ?? "",
      };
    }),
  }));
  const workspace = {
    ...rawWorkspace,
    tasks,
  };
  return {
    ok: true as const,
    data: {
      workspace,
      tasks,
      activity: workspace.activities ?? [],
      attachments: workspace.attachments ?? [],
    },
  };
}

export async function updateWorkspace(
  tenderId: string,
  patch: Partial<BidWorkspace>,
) {
  const res = await apiFetch<BidWorkspace>(
    `/api/v1/workspace/${tenderId}/workspace`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!res.ok) return res;
  return { ok: true as const, data: { workspace: res.data } };
}

export async function deleteWorkspace(tenderId: string) {
  const res = await apiFetch<{ deleted: boolean; workspaceId: string | null }>(
    `/api/v1/workspace/${tenderId}/workspace`,
    { method: "DELETE" },
  );
  if (!res.ok) return res;
  return { ok: true as const, data: res.data };
}

export async function createTask(tenderId: string, input: Partial<BidTask>) {
  const res = await apiFetch<BidTask>(
    `/api/v1/workspace/${tenderId}/workspace/tasks`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) return res;
  return { ok: true as const, data: { task: res.data } };
}

export async function updateTask(
  tenderId: string,
  taskId: string,
  patch: Partial<BidTask>,
) {
  const res = await apiFetch<BidTask>(
    `/api/v1/workspace/${tenderId}/workspace/tasks/${taskId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) return res;
  return { ok: true as const, data: { task: res.data } };
}

export async function addComment(
  tenderId: string,
  taskId: string,
  content: string,
) {
  const res = await apiFetch<WorkspaceTaskCommentApi>(
    `/api/v1/workspace/${tenderId}/workspace/tasks/${taskId}/comments`,
    { method: "POST", body: JSON.stringify({ content }) },
  );
  if (!res.ok) return res;
  const comment = {
    ...res.data,
    content: res.data?.content ?? res.data?.body ?? "",
  } as BidTaskComment;
  return { ok: true as const, data: { comment } };
}
