import { component$, Slot } from "@builder.io/qwik";
import { SiteFooter } from "~/components/site-footer/site-footer";

export default component$(() => {
  return (
    <div class="flex min-h-screen flex-col">
      <div class="flex-1">
        <Slot />
      </div>
      <SiteFooter />
    </div>
  );
});
