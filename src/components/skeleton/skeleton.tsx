import { component$ } from "@builder.io/qwik";

export const SkeletonProjectCard = component$(() => {
  return (
    <div class="card bg-base-100 animate-pulse shadow">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div class="bg-base-300 h-5 w-2/3 rounded"></div>
          <div class="bg-base-300 h-6 w-10 rounded"></div>
        </div>
        <div class="bg-base-300 mt-2 h-4 w-full rounded"></div>
        <div class="bg-base-300 mt-1 h-4 w-3/4 rounded"></div>
        <div class="mt-3 flex flex-wrap gap-2">
          <div class="bg-base-300 h-5 w-16 rounded"></div>
          <div class="bg-base-300 h-5 w-20 rounded"></div>
          <div class="bg-base-300 h-5 w-14 rounded"></div>
        </div>
        <div class="bg-base-300 mt-3 h-3 w-24 rounded"></div>
      </div>
    </div>
  );
});

export const SkeletonIconCard = component$(() => {
  return (
    <div class="card bg-base-100 animate-pulse shadow">
      <div class="card-body items-center p-3 text-center">
        <div class="bg-base-300 absolute top-2 left-2 h-5 w-5 rounded"></div>
        <div class="bg-base-300 mt-1 h-14 w-14 rounded"></div>
        <div class="bg-base-300 mt-2 h-3 w-16 rounded"></div>
        <div class="bg-base-300 mt-1 h-3 w-10 rounded"></div>
        <div class="mt-1 flex gap-1">
          <div class="bg-base-300 h-6 w-6 rounded"></div>
          <div class="bg-base-300 h-6 w-6 rounded"></div>
          <div class="bg-base-300 h-6 w-6 rounded"></div>
        </div>
      </div>
    </div>
  );
});

export const SkeletonNavbar = component$(() => {
  return (
    <div class="navbar bg-base-100 animate-pulse px-4 shadow-sm">
      <div class="flex flex-1 items-center gap-3">
        <div class="bg-base-300 h-6 w-6 rounded"></div>
        <div class="bg-base-300 h-6 w-24 rounded"></div>
        <div class="bg-base-300 h-5 w-12 rounded"></div>
      </div>
      <div class="bg-base-300 h-8 w-20 rounded"></div>
    </div>
  );
});
