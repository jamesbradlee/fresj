import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { App } from "@fresh/core";
import { getSetCookies } from "@std/http/cookie";
import {
  signCookie,
  verifySignedCookie,
} from "@std/http/unstable-signed-cookie";
import {
  type CookieKeyState,
  cookiesMw,
  type CookieState,
  setSignedCookie,
  setUnsignedCookie,
  signedCookies,
  unsignedCookies,
} from "./mod.ts";

Deno.test("cookies middleware parses unsigned cookies and adds to state", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (ctx) => {
      const cookies = ctx.state[unsignedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "theme=dark; session_id=abc123",
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {
    theme: "dark",
    session_id: "abc123",
  });
});

Deno.test("cookies middleware handles missing cookies header", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (ctx) => {
      const cookies = ctx.state[unsignedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/"),
  );

  const body = await res.json();
  assertObjectMatch(body, {});
});

Deno.test("cookies middleware handles malformed cookies header", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (ctx) => {
      const cookies = ctx.state[unsignedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "this_is_not_a_valid_cookie_header",
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {});
});

Deno.test("cookies middleware handles empty cookies header", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (ctx) => {
      const cookies = ctx.state[unsignedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "",
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {});
});

Deno.test("cookies middleware handles cookies with no value", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (ctx) => {
      const cookies = ctx.state[unsignedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "empty_cookie=; valid_cookie=value",
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {
    empty_cookie: "",
    valid_cookie: "value",
  });
});

Deno.test("cookies middleware handles cookies with no name", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (ctx) => {
      const cookies = ctx.state[unsignedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "=no_name; valid_cookie=value",
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {
    valid_cookie: "value",
  });
});

Deno.test("cookies middleware handles signed cookies", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const cookieKey = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );

  const handler = new App<CookieState & CookieKeyState>()
    .use(cookiesMw({ key: cookieKey }))
    .get("/", (ctx) => {
      const cookies = ctx.state[signedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "s.signed_cookie=" + await signCookie("value", cookieKey),
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {
    signed_cookie: "value",
  });
});

Deno.test("cookies middleware handles invalid signed cookies", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const cookieKey = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );

  const handler = new App<CookieState & CookieKeyState>()
    .use(cookiesMw({ key: cookieKey }))
    .get("/", (ctx) => {
      const cookies = ctx.state[signedCookies];
      return ctx.json(cookies);
    })
    .handler();

  const res = await handler(
    new Request("http://localhost/", {
      headers: {
        cookie: "s.signed_cookie=invalid_signed_value",
      },
    }),
  );

  const body = await res.json();
  assertObjectMatch(body, {});
});

Deno.test("handles setting cookies", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const handler = new App<CookieState>()
    .use(cookiesMw())
    .get("/", (_ctx) => {
      const res = new Response("Hello, world!", { status: 200 });
      setUnsignedCookie(res.headers, {
        name: "theme",
        value: "dark",
      });
      return res;
    })
    .handler();

  const res = await handler(new Request("http://localhost/"));
  const setCookies = getSetCookies(res.headers);

  assertEquals(setCookies, [{
    name: "theme",
    value: "dark",
  }]);
});

Deno.test("handles setting signed cookies", {
  permissions: {
    env: ["DENO_DEPLOYMENT_ID", "GITHUB_SHA", "CI_COMMIT_SHA"],
  },
}, async () => {
  const cookieKey = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );

  const handler = new App<CookieState & CookieKeyState>()
    .use(cookiesMw({ key: cookieKey }))
    .get("/", async (ctx) => {
      const res = new Response("Hello, world!", { status: 200 });
      await setSignedCookie(ctx, res.headers, {
        name: "session_id",
        value: "abc123",
      });
      return res;
    })
    .handler();

  const res = await handler(new Request("http://localhost/"));
  const setCookies = getSetCookies(res.headers);

  assertEquals(setCookies.length, 1);
  assertEquals(setCookies[0].name, "s.session_id");
  assert(
    setCookies[0].value.startsWith("abc123."),
    "value should start with 'abc123.'",
  );
  assert(
    await verifySignedCookie(setCookies[0].value, cookieKey),
    "value should be a valid signed cookie",
  );
});
