import { component$ } from "@builder.io/qwik";

export const SkeletonProjectCard = component$(() => {
  return (
    <div class="clay-card animate-pulse">
      <div class="p-5">
        <div class="flex items-start justify-between">
          <div class="h-5 w-2/3 rounded bg-[var(--color-base-300)]"></div>
          <div class="h-6 w-10 rounded bg-[var(--color-base-300)]"></div>
        </div>
        <div class="mt-2 h-4 w-full rounded bg-[var(--color-base-300)]"></div>
        <div class="mt-1 h-4 w-3/4 rounded bg-[var(--color-base-300)]"></div>
        <div class="mt-3 flex flex-wrap gap-2">
          <div class="h-5 w-16 rounded bg-[var(--color-base-300)]"></div>
          <div class="h-5 w-20 rounded bg-[var(--color-base-300)]"></div>
          <div class="h-5 w-14 rounded bg-[var(--color-base-300)]"></div>
        </div>
        <div class="mt-3 h-3 w-24 rounded bg-[var(--color-base-300)]"></div>
      </div>
    </div>
  );
});

export const SkeletonIconCard = component$(() => {
  return (
    <div class="clay-icon-card animate-pulse">
      <div class="relative flex flex-col items-center p-3 text-center">
        <div class="absolute top-2 left-2 h-5 w-5 rounded bg-[var(--color-base-300)]"></div>
        <div class="mt-1 h-14 w-14 rounded bg-[var(--color-base-300)]"></div>
        <div class="mt-2 h-3 w-16 rounded bg-[var(--color-base-300)]"></div>
        <div class="mt-1 h-3 w-10 rounded bg-[var(--color-base-300)]"></div>
        <div class="mt-1 flex gap-1">
          <div class="h-6 w-6 rounded bg-[var(--color-base-300)]"></div>
          <div class="h-6 w-6 rounded bg-[var(--color-base-300)]"></div>
          <div class="h-6 w-6 rounded bg-[var(--color-base-300)]"></div>
        </div>
      </div>
    </div>
  );
});

export const SkeletonNavbar = component$(() => {
  return (
    <div class="clay-navbar animate-pulse px-4">
      <div class="flex flex-1 items-center gap-3">
        <div class="h-6 w-6 rounded bg-[var(--color-base-300)]"></div>
        <div class="h-6 w-24 rounded bg-[var(--color-base-300)]"></div>
        <div class="h-5 w-12 rounded bg-[var(--color-base-300)]"></div>
      </div>
      <div class="h-8 w-20 rounded bg-[var(--color-base-300)]"></div>
    </div>
  );
});
