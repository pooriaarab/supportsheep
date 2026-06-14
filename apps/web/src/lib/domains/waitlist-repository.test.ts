import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  countDomainWaitlist,
  isBlogOnWaitlist,
  joinDomainWaitlist,
} from "./waitlist-repository";

type TestDb = NonNullable<Parameters<typeof isBlogOnWaitlist>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE domain_waitlist (
    id text PRIMARY KEY NOT NULL,
    blog_id text NOT NULL,
    user_id text NOT NULL,
    email text NOT NULL,
    created_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX domain_waitlist_blog_idx ON domain_waitlist (blog_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("domain waitlist repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("isBlogOnWaitlist is false until the blog joins", async () => {
    expect(await isBlogOnWaitlist("b1", db)).toBe(false);
    await joinDomainWaitlist({ blogId: "b1", userId: "u1", email: "a@x.test" }, db);
    expect(await isBlogOnWaitlist("b1", db)).toBe(true);
  });

  it("join is idempotent — a double-join leaves a single row", async () => {
    await joinDomainWaitlist({ blogId: "b1", userId: "u1", email: "a@x.test" }, db);
    await joinDomainWaitlist({ blogId: "b1", userId: "u2", email: "b@x.test" }, db);
    expect(await countDomainWaitlist(db)).toBe(1);
    expect(await isBlogOnWaitlist("b1", db)).toBe(true);
  });

  it("countDomainWaitlist counts distinct blogs", async () => {
    expect(await countDomainWaitlist(db)).toBe(0);
    await joinDomainWaitlist({ blogId: "b1", userId: "u1", email: "a@x.test" }, db);
    await joinDomainWaitlist({ blogId: "b2", userId: "u2", email: "b@x.test" }, db);
    expect(await countDomainWaitlist(db)).toBe(2);
  });
});
