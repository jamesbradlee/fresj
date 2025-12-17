/**
 * A Fresh middleware to parse cookies and set cookies on
 * the response.
 *
 * ```ts
 * import { App, createDefine } from "fresh";
 * import { env, required, Sha256CryptoKey } from "@all/env";
 * import {
 *   type CookieState,
 *   type CookieKeyState,
 *   cookiesMw,
 *   signedCookies,
 *   unsignedCookies,
 *   deleteCookie,
 *   setSignedCookie,
 *   setUnsignedCookie,
 * } from "@fresj/cookies";
 *
 * type State = CookieState & CookieKeyState;
 *
 * const define = createDefine<State>();
 *
 * const app = new App<State>();
 *
 * // Generate or import a CryptoKey for signing cookies
 * const cookieKey = await env(
 *   "COOKIE_KEY",
 *   required(Sha256CryptoKey),
 * );
 *
 * app.use(cookiesMw({ key: cookieKey }));
 *
 * app.get("/", define.handler(async (ctx) => {
 *   const unsigned = ctx.state[unsignedCookies];
 *   const signed = ctx.state[signedCookies];
 *
 *   const headers = new Headers();
 *
 *   // Set a signed cookie
 *   await setSignedCookie(headers, {
 *     name: "session_id",
 *     value: "abc123",
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: "Lax",
 *   });
 *
 *   // Set an unsigned cookie
 *   setUnsignedCookie(headers, {
 *     name: "theme",
 *     value: "dark",
 *   });
 *
 *   // Delete a cookie
 *   deleteCookie(ctx, headers, "old_cookie");
 *
 *   return new Response(
 *     `Unsigned Cookies: ${JSON.stringify(unsigned)}\n` +
 *     `Signed Cookies: ${JSON.stringify(signed)}`,
 *     { headers },
 *   );
 * });
 * ```
 *
 * @module
 */

import type { Context, Middleware } from "@fresh/core";
import {
  type Cookie,
  deleteCookie as stdDeleteCookie,
  getCookies,
  setCookie as stdSetCookie,
} from "@std/http/cookie";
import {
  parseSignedCookie,
  signCookie,
  verifySignedCookie,
} from "@std/http/unstable-signed-cookie";

const COOKIE_KEY: unique symbol = Symbol("COOKIE_KEY");

/**
 * The unique symbol key for unsigned cookies in the Fresh
 * App State.
 */
export const unsignedCookies: unique symbol = Symbol("unsignedCookies");

/**
 * The unique symbol key for signed cookies in the Fresh
 * App State.
 */
export const signedCookies: unique symbol = Symbol("signedCookies");

/**
 * The Fresh App State addition for the Cookies middleware.
 */
export interface CookieState {
  /** The unsigned cookies object. */
  [unsignedCookies]: Record<string, string>;
}

/**
 * The Fresh App State addition for the Cookie HMAC key.
 *
 * This is added by the Cookies middleware when a cookie
 * HMAC key is provided in the middleware options.
 */
export interface CookieKeyState {
  /** The cookie HMAC key. */
  [COOKIE_KEY]: CryptoKey;
  /** The signed cookies object. */
  [signedCookies]: Record<string, string>;
}

/**
 * The options that can be passed to the Cookies middleware.
 */
export interface CookiesMiddlewareOptions {
  /**
   * The HMAC key used to sign and verify cookies.
   */
  key: CryptoKey;
}

/**
 * A Fresh middleware that parses cookies from the request
 * headers and adds them to the Fresh App State.
 *
 * @param options The Cookies middleware options.
 * @returns The Cookies middleware.
 */
export function cookiesMw(): Middleware<CookieState>;

/**
 * A Fresh middleware that parses cookies from the request
 * headers and adds them to the Fresh App State.
 *
 * @param options The Cookies middleware options.
 * @returns The Cookies middleware.
 */
export function cookiesMw(
  options: CookiesMiddlewareOptions,
): Middleware<CookieState & CookieKeyState>;

/**
 * A Fresh middleware that parses cookies from the request
 * headers and adds them to the Fresh App State.
 *
 * @param options The Cookies middleware options.
 * @returns The Cookies middleware.
 */
export function cookiesMw(
  options?: CookiesMiddlewareOptions,
): Middleware<CookieState & Partial<CookieKeyState>>;

export function cookiesMw(
  options?: CookiesMiddlewareOptions,
  // deno-lint-ignore no-explicit-any
): Middleware<any> {
  const COOKIE_KEY = options?.key;

  return async (ctx) =>
    await cookiesMwImpl(
      ctx as unknown as Context<CookieState & CookieKeyState>,
      COOKIE_KEY,
    );
}

export default cookiesMw;

async function cookiesMwImpl(
  ctx: Context<CookieState & CookieKeyState>,
  cookieKey?: CryptoKey,
): Promise<Response> {
  const cookies = getCookies(ctx.req.headers);

  const unsigned: Record<string, string> = {};
  const signed: Record<string, string> = {};

  ctx.state[unsignedCookies] = unsigned;
  ctx.state[signedCookies] = signed;

  if (cookieKey) {
    ctx.state[COOKIE_KEY] = cookieKey;
  }

  for (const [key, value] of Object.entries(cookies)) {
    if (key.startsWith("s.")) {
      if (!cookieKey || !await verifySignedCookie(value, cookieKey)) continue;
      signed[key.substring(2)] = parseSignedCookie(value);
    } else {
      unsigned[key] = value;
    }
  }

  return ctx.next();
}

/**
 * Deletes a cookie by setting its expiration date to a time
 * in the past. Also deletes the signed version of the
 * cookie (if it exists).
 *
 * @remarks
 * This function only deletes cookies that were present in
 * the request. It will not delete cookies that were not
 * sent by the client.
 *
 * @param headers The headers object to modify.
 * @param name The name of the cookie to delete.
 * @param attributes Optional attributes for the cookie deletion.
 */
export function deleteCookie<T extends CookieState>(
  ctx: Context<T>,
  headers: Headers,
  name: string,
  attributes?: Pick<
    Cookie,
    "path" | "domain" | "secure" | "httpOnly" | "partitioned"
  >,
) {
  if (name in ctx.state[unsignedCookies]) {
    stdDeleteCookie(headers, name, attributes);
  }

  const state = ctx.state as unknown as CookieKeyState;
  const signedName = `s.${name}`;
  if (
    signedCookies in state &&
    (signedName in state[signedCookies])
  ) {
    stdDeleteCookie(headers, signedName, attributes);
  }
}

/**
 * Sets an unsigned cookie in the response headers.
 *
 * @param headers The headers object to modify.
 * @param cookie The cookie to set.
 */
export function setUnsignedCookie(
  headers: Headers,
  cookie: Cookie,
): void {
  if (cookie.name.startsWith("s.")) {
    throw new Error(
      'Unsigned cookie name cannot start with "s.". This prefix is reserved for signed cookies.',
    );
  }

  stdSetCookie(headers, cookie);
}

/**
 * Sets a signed cookie in the response headers.
 *
 * @param ctx The Fresh context.
 * @param headers The headers object to modify.
 * @param cookie The cookie to set.
 */
export async function setSignedCookie<T extends CookieKeyState>(
  ctx: Context<T>,
  headers: Headers,
  cookie: Cookie,
): Promise<void> {
  if (cookie.name.startsWith("s.")) {
    throw new Error(
      'Signed cookie name cannot start with "s.". This prefix is added automatically.',
    );
  }

  if (!(COOKIE_KEY in ctx.state)) {
    throw new Error(
      "Cannot set signed cookie without a cookie key in the context state.",
    );
  }

  stdSetCookie(headers, {
    ...cookie,
    name: `s.${cookie.name}`,
    value: await signCookie(cookie.value, ctx.state[COOKIE_KEY]),
  });
}
