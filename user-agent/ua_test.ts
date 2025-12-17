import { assertEquals } from "@std/assert";
import { App } from "@fresh/core";
import { userAgent, userAgentMw, type UserAgentState } from "./mod.ts";

Deno.test("user agent is parsed and added to state", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<UserAgentState>()
    .use(userAgentMw)
    .get("/", (ctx) => {
      const ua = ctx.state[userAgent];
      return new Response(ua.toString());
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        "user-agent": "test-agent/1.0",
      },
    }),
  );

  const body = await res.text();
  assertEquals(body, "test-agent/1.0");
});
