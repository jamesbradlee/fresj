/**
 * A Fresh middleware that parses the User-Agent header and
 * adds a {@link UserAgent} instance to the Fresh App State.
 *
 * ```ts
 * import { App, createDefine } from "fresh";
 * import {
 *   type UserAgentState,
 *   userAgent,
 *   userAgentMw
 * } from "@fresj/user-agent";
 *
 * type State = UserAgentState;
 *
 * const define = createDefine<State>();
 *
 * const app = new App<State>();
 *
 * app.use(userAgentMw);
 *
 * app.get("/", define.handler((req, ctx) => {
 *   const ua = ctx.state[userAgent];
 *   return new Response(`Hello, your user agent is: ${ua.toString()}`);
 * }))
 * ```
 *
 * @module
 */

import type { Middleware } from "@fresh/core";
import { UserAgent } from "@std/http/user-agent";

/**
 * The unique symbol key for the User-Agent instance in the
 * Fresh App State.
 */
export const userAgent: unique symbol = Symbol("userAgent");

/**
 * The Fresh App State addition for the User-Agent
 * middlware.
 */
export interface UserAgentState {
  /** The parsed User-Agent instance. */
  [userAgent]: UserAgent;
}

/**
 * A Fresh middleware that parses the User-Agent header and
 * adds a {@link UserAgent} instance to the Fresh App State.
 *
 * @param ctx The Fresh middleware context.
 * @return The response from the next middleware.
 */
export const userAgentMw: Middleware<UserAgentState> = (ctx) => {
  ctx.state[userAgent] = new UserAgent(ctx.req.headers.get("user-agent") || "");
  return ctx.next();
};

export default userAgentMw;
