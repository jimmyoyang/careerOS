import { useEffect } from "react";

// Capture before React's delegated handlers, so a cancelled navigation cannot
// reach Next Link or Header's router.push handler.
export function useUnsavedRecruitingChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const confirmNavigation = (event: Event) => {
      if (window.confirm("求职资料有未保存的修改。刷新、关闭页面或退出登录会丢失这些修改，确定离开吗？")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return; // Browser beforeunload handles external departures.
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      confirmNavigation(event);
    };
    const guardSearch = (event: SubmitEvent) => {
      const form = event.target;
      // This is the Header search form, whose submit handler uses router.push.
      // Other forms may save settings in place and must keep working normally.
      if (event.defaultPrevented || !(form instanceof HTMLFormElement) || !form.querySelector("#global-job-search")) return;
      if (form.target && form.target !== "_self") return;
      confirmNavigation(event);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", guardLink, true);
    document.addEventListener("submit", guardSearch, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", guardLink, true);
      document.removeEventListener("submit", guardSearch, true);
    };
  }, [dirty]);
}
