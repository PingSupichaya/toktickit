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
  ticketId?: number;
  originalFilename: string;
  fileSizeBytes: number;
  contentType: string;
  uploadedAt: string;
  isRemoved: boolean;
  removedAt?: string | null;
  removalReason?: string | null;
}

export interface TicketDetail extends Ticket {
  attachments: Attachment[];
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: string;
  ticketDate: string;
  category: Category;
  relatedSystem: RelatedSystem;
  attachmentCount: number;
}

export interface TicketQuery {
  requesterId: number;
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  status?: string;
  priority?: RequestedPriority;
  sortBy?: "ticketDate" | "ticketNumber";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface TicketPage {
  items: TicketSummary[];
  pagination: PaginationMeta;
}

export const STATUS_OPTIONS = ["NEW"];

export const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "number-asc", label: "Ticket number A–Z" },
  { value: "number-desc", label: "Ticket number Z–A" },
] as const;

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

interface DataResponse<T> {
  data: T;
}

export function formatTicketDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface TicketsResponse {
  data: TicketSummary[];
  pagination: PaginationMeta;
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

// AC-08 / FR-15 — fetch the requester's tickets with search, filtering,
// sorting, and pagination (GET /api/tickets). Returns the page list +
// pagination metadata so the UI can render filters and pager controls.
export async function fetchTickets(query: TicketQuery): Promise<TicketPage> {
  const params = new URLSearchParams({ requesterId: String(query.requesterId) });
  if (query.search) params.set("search", query.search);
  if (query.categoryId !== undefined) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== undefined) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.status) params.set("status", query.status);
  if (query.priority) params.set("priority", query.priority);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize));

  const res = await fetch(`${API_URL}/api/tickets?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Tickets request failed with status ${res.status}`);
  }
  const body = (await res.json()) as TicketsResponse;
  return { items: body.data, pagination: body.pagination };
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

// AC-03 / BR-04 — fetch a single ticket's full detail (with attachments).
// Enforces ownership on the server (403 for another requester's ticket).
// Attaches `status` and `code` to the thrown error so screens can render the
// correct error state (403 vs 404).
export async function fetchTicketDetail(
  ticketId: number,
  requesterId: number
): Promise<TicketDetail> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}?requesterId=${requesterId}`
  );

  const body = (await res.json().catch(() => null)) as
    | DataResponse<TicketDetail>
    | { error?: { message?: string; code?: string } }
    | null;

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Ticket request failed with status ${res.status}`;
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = (body as { error?: { code?: string } })?.error?.code;
    throw err;
  }

  return (body as DataResponse<TicketDetail>).data;
}

// AC-06 / AC-07 — fetch attachment metadata for a ticket. Soft-removed
// attachments are included when includeRemoved=true (used by Ticket Detail).
export async function fetchAttachments(
  ticketId: number,
  requesterId: number,
  includeRemoved = false
): Promise<Attachment[]> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}/attachments?requesterId=${requesterId}` +
      (includeRemoved ? "&includeRemoved=true" : "")
  );

  if (!res.ok) {
    throw new Error(`Attachments request failed with status ${res.status}`);
  }
  const body = (await res.json()) as DataResponse<Attachment[]>;
  return body.data;
}

// AC-06 — downloadable URL for an active attachment. The Ticket Detail screen
// renders this as the href of the filename download link.
export function downloadAttachmentUrl(
  attachmentId: number,
  requesterId: number
): string {
  return `${API_URL}/api/attachments/${attachmentId}/download?requesterId=${requesterId}`;
}

// AC-07 / BR-15,16 — soft-remove an attachment. Returns the updated metadata
// (isRemoved, removedAt, removalReason) so the UI can refresh the row in place.
export async function removeAttachment(
  attachmentId: number,
  requesterId: number,
  removalReason?: string
): Promise<Attachment> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requesterId,
      ...(removalReason ? { removalReason } : {}),
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | DataResponse<Attachment>
    | { error?: { message?: string } }
    | null;

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Remove failed with status ${res.status}`;
    throw new Error(message);
  }

  return (body as DataResponse<Attachment>).data;
}
