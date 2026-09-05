const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Ticket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requester: Requester;
  categoryId: number;
  category: Category;
  relatedSystemId: number;
  relatedSystem: RelatedSystem;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: string;
  ticketDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export interface Attachment {
  id: number;
  ticketId: number;
  originalFilename: string;
  fileSizeBytes: number;
  contentType: string;
  uploadedAt: string;
  isRemoved: boolean;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

interface DataResponse<T> {
  data: T;
}

// Issue 2 + Issue 4 — call the backend.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status ${healthRes.status}`);
  }

  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error(`Categories request failed with status ${categoriesRes.status}`);
  }
  const categoriesBody = (await categoriesRes.json()) as DataResponse<Category[]>;

  return { online: true, categories: categoriesBody.data };
}

// FR-02 / BR-05 — fetch only ACTIVE development Requesters for the selector.
export async function fetchRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) {
    throw new Error(`Requesters request failed with status ${res.status}`);
  }
  const body = (await res.json()) as DataResponse<Requester[]>;
  return body.data;
}

// FR-08 / BR-08 — fetch ACTIVE Categories for the Create Ticket dropdown.
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error(`Categories request failed with status ${res.status}`);
  }
  const body = (await res.json()) as DataResponse<Category[]>;
  return body.data;
}

// FR-08 / BR-08 — fetch ACTIVE Related Systems for the Create Ticket dropdown.
export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error(`Related systems request failed with status ${res.status}`);
  }
  const body = (await res.json()) as DataResponse<RelatedSystem[]>;
  return body.data;
}

// AC-01 / FR-11 — create a ticket. Throws an Error with the server's safe
// message on failure so the form can display an error banner.
export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await res.json().catch(() => null)) as
    | DataResponse<Ticket>
    | { error?: { message?: string } }
    | null;

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Ticket creation failed with status ${res.status}`;
    throw new Error(message);
  }

  return (body as DataResponse<Ticket>).data;
}

// AC-06 / FR-24 — upload an attachment to an existing ticket. Uses the
// multipart/form-data contract of POST /api/tickets/:ticketId/attachments
// (file + requesterId). Throws the server's safe message on failure.
export async function uploadAttachment(
  ticketId: number,
  requesterId: number,
  file: File
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("requesterId", String(requesterId));

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => null)) as
    | DataResponse<Attachment>
    | { error?: { message?: string } }
    | null;

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Upload failed with status ${res.status}`;
    throw new Error(message);
  }

  return (body as DataResponse<Attachment>).data;
}
