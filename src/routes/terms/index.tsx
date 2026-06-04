import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import { UserMenu } from "~/components/user-menu/user-menu";

export const head: DocumentHead = {
  title: "服务条款 - Iconfont",
  meta: [
    {
      name: "description",
      content: "Iconfont 平台服务条款，规定用户与平台之间的权利与义务。",
    },
  ],
};

export default component$(() => {
  return (
    <div class="min-h-screen">
      {/* Navbar */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="/" class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-rose-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span class="text-lg font-extrabold tracking-tight text-rose-600">
              Iconfont
            </span>
          </a>
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/explore"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              探索
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div class="mb-10 text-center">
          <h1 class="text-3xl font-black tracking-tight text-[var(--color-neutral)] sm:text-4xl">
            服务条款
          </h1>
          <p class="mt-3 text-sm text-[var(--color-base-400)]">
            最后更新日期：2026年6月3日
          </p>
        </div>

        <article class="prose prose-sm max-w-none text-[var(--color-base-400)]">
          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              1. 接受条款
            </h2>
            <p class="mt-2 leading-relaxed">
              欢迎使用
              Iconfont（"平台"）。访问或使用本平台即表示您同意受本服务条款（"条款"）的约束。如果您不同意这些条款，请勿使用本平台。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              2. 服务描述
            </h2>
            <p class="mt-2 leading-relaxed">
              Iconfont 是一个在线 SVG
              图标管理与图标字体生成平台。我们提供的服务包括：项目创建与管理、SVG
              上传与编辑、字体文件生成（TTF、CSS、Symbol
              SVG）、公开图标集浏览与收藏、AI
              辅助图标设计等。服务的具体功能和可用性可能随时调整。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              3. 用户账户
            </h2>
            <p class="mt-2 leading-relaxed">
              您可以通过邮箱注册或第三方
              OAuth（GitHub、Google）创建账户。您有责任维护账户密码的保密性，并对在您账户下发生的所有活动负责。如发现未经授权的使用，请立即通知我们。
            </p>
            <p class="mt-2 leading-relaxed">
              平台也支持匿名（本地）模式使用，但此模式下数据仅保存在您的浏览器中，我们无法保证数据安全与持久性。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              4. 用户内容
            </h2>
            <p class="mt-2 leading-relaxed">
              您保留对您上传至平台的所有 SVG
              图标及相关内容的完整所有权。您授予平台一项有限的、非独占的许可，仅用于存储、处理和展示您的内容，以向您提供服务。
            </p>
            <p class="mt-2 leading-relaxed">
              您不得上传包含恶意代码、侵犯第三方知识产权、违反法律法规或包含不当内容（如色情、暴力、仇恨言论）的
              SVG 文件。我们有权删除违规内容并暂停相关账户。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              5. 公开项目与社区内容
            </h2>
            <p class="mt-2 leading-relaxed">
              当您将项目设置为"公开"时，即表示您允许其他用户浏览、收藏和
              Fork（复制）您的图标集。公开项目的内容将在平台内被索引和展示。您应确保公开项目中的内容不侵犯任何第三方的权利。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              6. 服务限制与配额
            </h2>
            <p class="mt-2 leading-relaxed">
              平台可能对免费账户的项目数量、图标数量和 API
              调用频率设置限制。具体配额以平台实际展示为准。我们保留调整配额政策的权利，重大调整将提前通知用户。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              7. 知识产权
            </h2>
            <p class="mt-2 leading-relaxed">
              平台本身的软件、界面设计、品牌标识及相关技术均受知识产权法保护。平台生成的字体文件（基于您上传的
              SVG）归您所有，但平台保留生成工具与算法的所有权。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              8. 免责声明
            </h2>
            <p class="mt-2 leading-relaxed">
              平台按"现状"和"可用性"提供，不作出任何明示或暗示的保证。我们不保证服务将
              uninterrupted（不间断）、timely（及时）、secure（安全）或
              error-free（无错误）。您使用平台生成和分发的字体文件由您自行承担责任。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              9. 责任限制
            </h2>
            <p class="mt-2 leading-relaxed">
              在适用法律允许的最大范围内，平台及其运营方不对任何间接、附带、特殊或后果性损害承担责任，包括但不限于利润损失、数据丢失或业务中断。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              10. 条款变更
            </h2>
            <p class="mt-2 leading-relaxed">
              我们保留随时修改本条款的权利。重大变更将通过平台公告或邮件通知。变更后的条款在发布后立即生效。继续使用平台即表示您接受修改后的条款。
            </p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              11. 联系我们
            </h2>
            <p class="mt-2 leading-relaxed">
              如有任何关于服务条款的问题，请通过 GitHub Issues 与我们联系。
            </p>
          </section>
        </article>
      </main>
    </div>
  );
});
