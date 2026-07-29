import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { settingsRoutes } from "../src/modules/settings/settings.route";
import { signToken } from "../src/lib/jwt";

describe("Settings Routes Unit Test", () => {
  it("should handle GET /settings with token", async () => {
    const token = await signToken({ sub: 1, email: "test@test.com", role: "reseller" });
    const app = new Elysia().use(settingsRoutes);

    const res = await app.handle(
      new Request("http://localhost/settings", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json).toHaveProperty("data");
    expect(json.data).toHaveProperty("brand_name");
  });
});
