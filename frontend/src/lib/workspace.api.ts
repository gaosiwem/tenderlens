import { apiFetch } from "@/lib/api";
import type {
  BidActivity,
  BidAttachment,
  BidTask,
  BidTaskComment,
  BidWorkspace,
} from "./workspace.types";

export async function getWorkspaceByTender(tenderId: string) {
  const res = await apiFetch<any>(`/api/v1/tenders/${tenderId}/workspace/full`, {
    method: "GET",
  });
  if (!res.ok) return res;

  const rawWorkspace = res.data as BidWorkspace & {
    tasks?: Array<
      Omit<BidTask, "comments"> & {
        comments?: Array<BidTaskComment & { body?: string }>;
      }
    >;
    activities?: BidActivity[];
    attachments?: BidAttachment[];
  };
  const tasks: BidTask[] = (rawWorkspace.tasks ?? []).map((t) => ({
    ...t,
    comments: (t.comments ?? []).map((c) => {
      const fallbackBody =
        "body" in (c as Record<string, unknown>) &&
        typeof (c as Record<string, unknown>).body === "string"
          ? String((c as Record<string, unknown>).body)
          : "";
      return {
        ...c,
        content: c?.content ?? fallbackBody,
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
  const res = await apiFetch<any>(
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
