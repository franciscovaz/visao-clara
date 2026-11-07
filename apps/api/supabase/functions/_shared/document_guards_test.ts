import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  CLEANUP_DEFAULT_AGE_HOURS,
  fileBelongsToDocument,
  isUuid,
  parseCleanupRequest,
  projectBelongsToTenant,
} from "./document_guards.ts";

const T_A = "11111111-1111-4111-8111-111111111111";
const T_B = "22222222-2222-4222-8222-222222222222";
const P_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const D_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const D_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

Deno.test("isUuid", () => {
  assertEquals(isUuid(T_A), true);
  assertEquals(isUuid("document_1793961216014_fr5skr68e"), false);
  assertEquals(isUuid(undefined), false);
  assertEquals(isUuid(42), false);
});

Deno.test("project/tenant mismatch is refused", () => {
  assertEquals(projectBelongsToTenant({ id: P_A, tenant_id: T_A }, P_A, T_A), true);
  // The user's own tenant combined with another tenant's project
  assertEquals(projectBelongsToTenant({ id: P_B, tenant_id: T_B }, P_B, T_A), false);
  // RLS hides a foreign project: nothing returned
  assertEquals(projectBelongsToTenant(null, P_B, T_A), false);
  assertEquals(projectBelongsToTenant(undefined, P_B, T_A), false);
  // Returned row does not match the requested id
  assertEquals(projectBelongsToTenant({ id: P_A, tenant_id: T_A }, P_B, T_A), false);
});

Deno.test("unauthorized document access: file rows must match a visible document", () => {
  const file = { document_id: D_A, tenant_id: T_A, project_id: P_A };
  assertEquals(fileBelongsToDocument(file, { id: D_A, tenant_id: T_A, project_id: P_A }), true);
  // Document not visible to the user (other tenant, hidden by RLS)
  assertEquals(fileBelongsToDocument(file, null), false);
  // Row claims a document of another tenant / project
  assertEquals(fileBelongsToDocument(file, { id: D_B, tenant_id: T_B, project_id: P_B }), false);
  assertEquals(fileBelongsToDocument(file, { id: D_A, tenant_id: T_B, project_id: P_A }), false);
  assertEquals(fileBelongsToDocument(file, { id: D_A, tenant_id: T_A, project_id: P_B }), false);
});

Deno.test("cleanup request is project-scoped with a safe minimum age", () => {
  assertEquals(parseCleanupRequest({ project_id: P_A }), {
    ok: true,
    projectId: P_A,
    olderThanHours: CLEANUP_DEFAULT_AGE_HOURS,
  });
  assertEquals(parseCleanupRequest({ project_id: P_A, older_than_hours: 48 }).ok, true);
  // Old behaviour: no project, tiny age fail every pending upload of every tenant
  assertEquals(parseCleanupRequest({}).ok, false);
  assertEquals(parseCleanupRequest(null).ok, false);
  assertEquals(parseCleanupRequest({ project_id: "x" }).ok, false);
  for (const hours of [0, 0.0001, -5, "abc", Infinity, 24 * 365]) {
    assertEquals(parseCleanupRequest({ project_id: P_A, older_than_hours: hours }).ok, false, String(hours));
  }
});
