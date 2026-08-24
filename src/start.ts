import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";
import { isWorkosServerConfigured } from "@/lib/auth/policy.mjs";

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    ...(isWorkosServerConfigured(process.env) ? [authkitMiddleware()] : []),
  ],
}));
