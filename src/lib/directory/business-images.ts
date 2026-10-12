import { createServerFn } from "@tanstack/react-start";
import { runAuthenticated } from "./claim-handler.mjs";
import {
  uploadBusinessImage,
  runBusinessImageCommand,
  publishedBusinessImages,
} from "../supabase/business-image-commands.mjs";
import type { BusinessDetail } from "./types";

export type BusinessImage = {
  id: string;
  listingId?: string;
  listingName?: string;
  kind: "logo" | "image";
  status: string;
  alt: string;
  reason?: string;
  rightsBasis?: string;
  source?: string;
  url?: string;
  width?: number;
  height?: number;
};
export type MediaResult =
  | { ok: true; receipt: BusinessImage[] | { id?: string; status?: string; dataUrl?: string } }
  | { ok: false; code: string };
export const uploadImage = createServerFn({ method: "POST" })
  .validator((d: unknown) => d)
  .handler(({ data }) => runAuthenticated(data, uploadBusinessImage) as Promise<MediaResult>);
export const imageCommand = createServerFn({ method: "POST" })
  .validator((d: unknown) => d)
  .handler(({ data }) => runAuthenticated(data, runBusinessImageCommand) as Promise<MediaResult>);
export const getPublishedImages = createServerFn({ method: "GET" })
  .validator((d: string) => d)
  .handler(
    ({ data }) =>
      publishedBusinessImages(data) as Promise<NonNullable<BusinessDetail["businessImages"]>>,
  );
