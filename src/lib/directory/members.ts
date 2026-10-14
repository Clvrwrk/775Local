import { createServerFn } from "@tanstack/react-start";
import { fetchPublicMember } from "@/lib/directory/member-read.mjs";
import {
  handleAttachExperiencePhoto,
  handleGetMyLocalMember,
  handleSaveLocalMember,
  handleSubmitExperience,
  handleWithdrawExperience,
} from "@/lib/directory/member-handler.mjs";

const preserveUntrustedInput = (input: unknown) => input;

export type MemberProfile = {
  displayName: string;
  handle: string;
  town: string;
  bio: string;
  memberSince: string;
};

export type MemberExperience = {
  reviewId: string;
  listingId?: string;
  listingSlug: string;
  listingName: string;
  rating: number;
  body: string;
  status?: string;
  createdAt: string;
  photos: string[];
};

export type MyMember = {
  profile: MemberProfile | null;
  experiences: MemberExperience[];
};

export const getMyLocalMember = createServerFn({ method: "GET" }).handler(
  () => handleGetMyLocalMember() as Promise<{ ok: true; member: MyMember } | { ok: false; code: string }>,
);

export const saveLocalMember = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(
    ({ data }) =>
      handleSaveLocalMember(data) as Promise<
        { ok: true; profile: MemberProfile } | { ok: false; code: string }
      >,
  );

export const getPublicMember = createServerFn({ method: "GET" })
  .validator((handle: string) => handle)
  .handler(async ({ data }) => fetchPublicMember(data));

export const submitExperience = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(
    ({ data }) =>
      handleSubmitExperience(data) as Promise<
        { ok: true; experience: MemberExperience } | { ok: false; code: string }
      >,
  );

export const withdrawExperience = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(
    ({ data }) =>
      handleWithdrawExperience(data) as Promise<
        { ok: true; receipt: { reviewId: string; status: string } } | { ok: false; code: string }
      >,
  );

export const attachExperiencePhoto = createServerFn({ method: "POST" })
  .validator(preserveUntrustedInput)
  .handler(
    ({ data }) =>
      handleAttachExperiencePhoto(data) as Promise<
        { ok: true; photoUrl: string } | { ok: false; code: string }
      >,
  );
