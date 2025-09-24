(function () {
  // กลุ่มเมนู: ชนะแมตช์เมื่อ path ปัจจุบันขึ้นต้นด้วย prefix ใด ๆ ด้านล่าง
  const groups = [
    { prefix: "/chem",  navRoot: "/chem"  },
    { prefix: "/brand", navRoot: "/brand" },
    { prefix: "/product", navRoot: "/product" },
    { prefix: "/productdetail", navRoot: "/productdetail" },
    // เพิ่มได้ เช่น { prefix: "/orders", navRoot: "/orders" },
  ];

  // คลาสสีเขียว custom (ต้องมีใน CSS: .text-brand-green { color:#00d312 !important; })
  const ACTIVE_CLASS = "text-brand-green";

  function pickHeaderLinkByPrefix(prefix) {
    // หา <a> ทุกตัวใน #site-header แล้วเทียบจาก URL.pathname
    const anchors = document.querySelectorAll("#site-header a[href]");
    for (const a of anchors) {
      try {
        const url = new URL(a.href, window.location.origin);
        if (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) {
          return a; // คืนลิงก์แรกที่อยู่ในกลุ่มเมนูนั้น
        }
      } catch { /* ignore malformed href */ }
    }
    return null;
  }

  function highlightMenu() {
    const pathname = window.location.pathname;
    let did = false;

    for (const { prefix } of groups) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        const link = pickHeaderLinkByPrefix(prefix);
        if (link) {
          // เอาสีเดิมของบาร์ออก แล้วใส่สีเขียวเรา
          link.classList.remove("text-white", "text-success");
          link.classList.add(ACTIVE_CLASS);
          did = true;
        }
      }
    }
    return did;
  }

  function whenHeaderReady() {
    if (highlightMenu()) return;

    document.addEventListener("header:loaded", () => {
      highlightMenu();
    }, { once: true });

    const host = document.getElementById("site-header");
    if (!host) return;
    const obs = new MutationObserver(() => {
      if (highlightMenu()) obs.disconnect();
    });
    obs.observe(host, { childList: true, subtree: true });

    setTimeout(highlightMenu, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", whenHeaderReady);
  } else {
    whenHeaderReady();
  }
})();
