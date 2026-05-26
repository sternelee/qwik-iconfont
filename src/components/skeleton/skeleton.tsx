import { component$ } from "@builder.io/qwik";

export const SkeletonProjectCard = component$(() => {
  return (
    <div class="card bg-base-100 shadow animate-pulse">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div class="h-5 bg-base-300 rounded w-2/3"></div>
          <div class="h-6 bg-base-300 rounded w-10"></div>
        </div>
        <div class="h-4 bg-base-300 rounded w-full mt-2"></div>
        <div class="h-4 bg-base-300 rounded w-3/4 mt-1"></div>
        <div class="flex flex-wrap gap-2 mt-3">
          <div class="h-5 bg-base-300 rounded w-16"></div>
          <div class="h-5 bg-base-300 rounded w-20"></div>
          <div class="h-5 bg-base-300 rounded w-14"></div>
        </div>
        <div class="h-3 bg-base-300 rounded w-24 mt-3"></div>
      </div>
    </div>
  );
});

export const SkeletonIconCard = component$(() => {
  return (
    <div class="card bg-base-100 shadow animate-pulse">
      <div class="card-body p-3 items-center text-center">
        <div class="absolute top-2 left-2 w-5 h-5 bg-base-300 rounded"></div>
        <div class="w-14 h-14 bg-base-300 rounded mt-1"></div>
        <div class="h-3 bg-base-300 rounded w-16 mt-2"></div>
        <div class="h-3 bg-base-300 rounded w-10 mt-1"></div>
        <div class="flex gap-1 mt-1">
          <div class="h-6 bg-base-300 rounded w-6"></div>
          <div class="h-6 bg-base-300 rounded w-6"></div>
          <div class="h-6 bg-base-300 rounded w-6"></div>
        </div>
      </div>
    </div>
  );
});

export const SkeletonNavbar = component$(() => {
  return (
    <div class="navbar bg-base-100 shadow-sm px-4 animate-pulse">
      <div class="flex-1 flex items-center gap-3">
        <div class="w-6 h-6 bg-base-300 rounded"></div>
        <div class="h-6 bg-base-300 rounded w-24"></div>
        <div class="h-5 bg-base-300 rounded w-12"></div>
      </div>
      <div class="h-8 bg-base-300 rounded w-20"></div>
    </div>
  );
});
