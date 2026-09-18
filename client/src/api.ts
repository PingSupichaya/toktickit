const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMIN";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthResult {
  user: AuthUser;
  mustChangePassword: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error?: { message?: string; code?: string };
}

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
  submittedById: number;
  submitter: Requester;
  ownerId?: number | null;
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
  const healthRes = await fetch(`${API_URL}/api/health`, {
    credentials: "include",
  });
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status ${healthRes.status}`);
  }

  const categoriesRes = await fetch(`${API_URL}/api/categories`, {
    credentials: "include",
  });
  if (!categoriesRes.ok) {
    throw new Error(`Categories request failed with status ${categoriesRes.status}`);
  }
  const categoriesBody = (await categoriesRes.json()) as DataResponse<Category[]>;

  return { online: true, categories: categoriesBody.data };
}

// FR-08 / BR-08 — fetch ACTIVE Categories for the Create Ticket dropdown.
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Categories request failed with status ${res.status}`);
  }
  const body = (await res.json()) as DataResponse<Category[]>;
  return body.data;
}

// FR-08 / BR-08 — fetch ACTIVE Related Systems for the Create Ticket dropdown.
export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`, {
    credentials: "include",
  });
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
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.categoryId !== undefined) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== undefined) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.status) params.set("status", query.status);
  if (query.priority) params.set("priority", query.priority);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize));

  const res = await fetch(`${API_URL}/api/tickets?${params.toString()}`, {
    credentials: "include",
  });
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
    credentials: "include",
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
// (file only; the submitter comes from the session). Throws the server's safe
// message on failure.
export async function uploadAttachment(
  ticketId: number,
  file: File
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
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
// Enforces ownership on the server (404 for another requester's ticket).
// Attaches `status` and `code` to the thrown error so screens can render the
// correct error state (403 vs 404).
export async function fetchTicketDetail(
  ticketId: number
): Promise<TicketDetail> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}`,
    { credentials: "include" }
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
  includeRemoved = false
): Promise<Attachment[]> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}/attachments` +
      (includeRemoved ? "?includeRemoved=true" : ""),
    { credentials: "include" }
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
  attachmentId: number
): string {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

// AC-07 / BR-15,16 — soft-remove an attachment. Returns the updated metadata
// (isRemoved, removedAt, removalReason) so the UI can refresh the row in place.
export async function removeAttachment(
  attachmentId: number,
  removalReason?: string
): Promise<Attachment> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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

// ---------------------------------------------------------------------------
// Lab 3 — real authentication (FR-01..FR-07)
// ---------------------------------------------------------------------------
// Every auth request carries `credentials: "include"` so the HttpOnly session
// cookie set by the server is sent on cross-origin (same-site) requests.

async function authJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as
    | DataResponse<T>
    | ErrorBody
    | null;

  if (!res.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      error?.message ?? `Request failed with status ${res.status}`,
      error?.code
    );
  }

  return (body as DataResponse<T>).data;
}

// FR-01 — sign in with email + password. Throws ApiError (status/code) so the
// Login screen can show the safe banner (401 invalid, 403 ACCOUNT_INACTIVE,
// 429 rate-limited) without leaking details.
export async function login(email: string, password: string): Promise<AuthResult> {
  return authJson<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// FR-03 — end the server session.
export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

// FR-05 — restore the session on app boot (validates the HttpOnly cookie).
export async function fetchMe(): Promise<AuthResult> {
  return authJson<AuthResult>("/api/auth/me");
}

// FR-02 / AC-02 — change the initial password (server re-issues the session).
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  return authJson<AuthResult>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
