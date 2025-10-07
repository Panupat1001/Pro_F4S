// /public/js/productorderdetail-edit.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const toNum = (v, d = 0) => {
    if (typeof v === "string") v = v.replace(/,/g, "");
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getParam = (k, d = null) => new URLSearchParams(location.search).get(k) ?? d;

  function enableLink(aEl, url) {
    if (!aEl) return;
    if (url) {
      aEl.href = url;
      aEl.removeAttribute("disabled");
      aEl.classList.remove("disabled");
    } else {
      aEl.removeAttribute("href");
      aEl.setAttribute("disabled", "true");
      aEl.classList.add("disabled");
    }
  }

  // ===== Back button =====
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorderdetail/index.html";
  });

  // ===== reorder =====
  async function updateChemReorder(chemId) {
    const help = $("orderbuy_help");
    if (!help) return;
    if (!chemId) {
      help.textContent = "reorder: -";
      return;
    }
    try {
      const res = await fetch(`/chem/detail?id=${chemId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      const reorder = row?.chem_reorder ?? row?.CHEM_REORDER ?? null;
      help.textContent = reorder ? `reorder: ${fmt(reorder)} กรัม` : "reorder: -";
    } catch {
      help.textContent = "reorder: -";
    }
  }

  // ===== robust loaders (ลองหลาย endpoint) =====
  async function tryFetchJson(url, opt) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, ...(opt || {}) });
      console.log("[edit] fetch", url, "->", res.status);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn("[edit] fetch error", url, e);
      return null;
    }
  }

  async function loadDetailByPodId(podId) {
    const urls = [
      `/productorderdetail/read/${podId}`,
      `/productorderdetail/detail?id=${podId}`,
      `/productorderdetail/${podId}`,
      `/productorderdetail/read?pod_id=${podId}`,         // fallback แบบ query
      `/productorderdetail/readone/${podId}`,            // เผื่อมี readone
      `/productorderdetail/get?id=${podId}`,             // เผื่อมี get?id
    ];
    for (const u of urls) {
      const raw = await tryFetchJson(u);
      if (!raw) continue;
      const row = Array.isArray(raw) ? raw[0] : (raw.data?.[0] ?? raw.rows?.[0] ?? raw.item ?? raw);
      if (row) return row;
    }
    return null;
  }

  async function loadLatestByChemId(chemId) {
    const raw = await tryFetchJson(`/productorderdetail/read`);
    if (!raw) return null;
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.rows)
      ? raw.rows
      : Array.isArray(raw.items)
      ? raw.items
      : [];
    const rows = arr
      .filter((x) => Number(x.chem_id ?? x.CHEM_ID) === Number(chemId))
      .map((x) => ({
        pod_id: x.pod_id ?? x.POD_ID ?? null,
        chem_id: x.chem_id ?? x.CHEM_ID ?? null,
        chem_name: x.chem_name ?? x.CHEM_NAME ?? null,
        company_id: x.company_id ?? x.COMPANY_ID ?? null,
        company_name: x.company_name ?? x.COMPANY_NAME ?? null,
        orderbuy: x.orderbuy ?? x.ORDERBUY ?? null,
        chem_price: x.chem_price ?? x.CHEM_PRICE ?? null,
        coa: x.coa ?? x.COA ?? null,
        msds: x.msds ?? x.MSDS ?? null,
      }));
    if (!rows.length) return null;
    rows.sort((a, b) => (b.pod_id || 0) - (a.pod_id || 0));
    return rows[0];
  }

  function getPodIdFromPath() {
    const segs = location.pathname.split("/").filter(Boolean);
    for (let i = segs.length - 1; i >= 0; i--) {
      const n = Number(segs[i]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  }

  // ===== Initial =====
  let podId = Number(getParam("pod_id", 0)) || getPodIdFromPath() || 0;
  let chemId = Number(getParam("chem_id", 0)) || 0;
  let chemName = getParam("chem_name", "") || "";
  console.log("[edit] init podId=", podId, "chemId=", chemId, "chemName=", chemName);

  (async () => {
    let data = null;

    if (podId) {
      data = await loadDetailByPodId(podId);
    } else if (chemId) {
      data = await loadLatestByChemId(chemId);
      if (data?.pod_id) podId = Number(data.pod_id);
    }

    if (!data) {
      alert("ไม่พบข้อมูล (pod_id/chem_id ไม่ถูกต้อง หรือ API ไม่รองรับ)");
      location.href = "/productorderdetail/index.html";
      return;
    }

    // map fields
    const pod_id = data.pod_id ?? data.POD_ID ?? podId;
    const mapChemId = data.chem_id ?? data.CHEM_ID ?? chemId;
    const mapChemName = data.chem_name ?? data.CHEM_NAME ?? chemName ?? "-";

    const company_id = data.company_id ?? data.COMPANY_ID ?? null;
    const company_name = data.company_name ?? data.COMPANY_NAME ?? "-";

    const orderbuy = toNum(data.orderbuy ?? data.ORDERBUY ?? 0);
    const chem_price = toNum(data.chem_price ?? data.CHEM_PRICE ?? 0);
    const price_gram =
      toNum(data.price_gram ?? data.PRICE_GRAM, 0) ||
      (orderbuy > 0 ? round2(chem_price / orderbuy) : 0);

    const coa = data.coa ?? data.COA ?? "";
    const msds = data.msds ?? data.MSDS ?? "";

    // hidden
    let hidPod = $("pod_id");
    if (!hidPod) {
      hidPod = document.createElement("input");
      hidPod.type = "hidden";
      hidPod.id = "pod_id";
      hidPod.name = "pod_id";
      $("formEdit")?.appendChild(hidPod);
    }
    hidPod.value = pod_id;

    let hidChem = $("chem_id");
    if (!hidChem) {
      hidChem = document.createElement("input");
      hidChem.type = "hidden";
      hidChem.id = "chem_id";
      hidChem.name = "chem_id";
      $("formEdit")?.appendChild(hidChem);
    }
    hidChem.value = mapChemId || "";

    // fill disabled boxes
    $("chem_name") && ( $("chem_name").value = mapChemName );
    $("company_name") && ( $("company_name").value = company_name );
    $("orderbuy") && ( $("orderbuy").value = orderbuy ? fmt(orderbuy) : "" );
    $("chem_price") && ( $("chem_price").value = chem_price ? fmtMoney(chem_price) : "" );
    $("price_gram") && ( $("price_gram").value = fmtMoney(price_gram) );

    $("coa") && ( $("coa").value = coa || "" );
    $("msds") && ( $("msds").value = msds || "" );
    enableLink($("coa_link"), coa || null);
    enableLink($("msds_link"), msds || null);

    await updateChemReorder(mapChemId);
  })();

  // ===== Submit (update เฉพาะ COA/MSDS แต่ส่ง payload ครบ) =====
  $("formEdit")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const pod_id = Number($("pod_id")?.value || 0);
    const chem_id = Number($("chem_id")?.value || 0);
    if (!pod_id || !chem_id) return alert("ไม่พบ pod_id/chem_id");

    const orderbuy = toNum(($("orderbuy")?.value || "0"));
    const chem_price = toNum(($("chem_price")?.value || "0"));
    const price_gram = orderbuy > 0 ? round2(chem_price / orderbuy) : 0;

    // ดึง company_id จาก detail เพื่อให้ payload ครบ
    let company_id = 0;
    const detail = await loadDetailByPodId(pod_id);
    company_id = Number(detail?.company_id ?? detail?.COMPANY_ID ?? 0) || 0;

    const payload = {
      pod_id,
      chem_id,
      company_id,
      orderbuy,
      chem_price,
      price_gram,
      coa: ($("coa")?.value || "").trim() || null,
      msds: ($("msds")?.value || "").trim() || null,
    };

    try {
      const res = await fetch(`/productorderdetail/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `อัปเดตไม่สำเร็จ (${res.status})`);
      alert("บันทึกเรียบร้อย");
      location.href = "/productorderdetail/index.html";
    } catch (err) {
      console.error(err);
      alert(err.message || "อัปเดตไม่สำเร็จ");
    }
  });

  // ===== Upload buttons =====
  $("btnUploadCoa")?.addEventListener("click", () => uploadPdf("coa"));
  $("btnUploadMsds")?.addEventListener("click", () => uploadPdf("msds"));
});

// ===== upload helpers =====
async function uploadPdf(fieldName) {
  const podId = Number(document.getElementById("pod_id")?.value || 0);
  if (!podId) return alert("ยังไม่พบ pod_id ของรายการนี้ (ยังไม่โหลดข้อมูลเสร็จ?)");

  const fileInput = document.getElementById(fieldName + "_file");
  const textBox   = document.getElementById(fieldName);
  const linkBtn   = document.getElementById(fieldName + "_link");

  const file = fileInput?.files?.[0];
  if (!file) return alert("กรุณาเลือกไฟล์ก่อน");
  if (file.type !== "application/pdf") return alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
  if (file.size > 10 * 1024 * 1024) return alert("ไฟล์เกิน 10MB");

  const fd = new FormData();
  fd.append("pod_id", String(podId));
  fd.append(fieldName, file);

  try {
    const res = await fetch("/upload/coa-msds", { method: "PUT", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `อัปโหลดไม่สำเร็จ (${res.status})`);

    const url = data[fieldName] || null;
    if (url) {
      if (textBox) textBox.value = url;
      if (linkBtn) {
        linkBtn.href = url;
        linkBtn.classList.remove("disabled");
        linkBtn.removeAttribute("disabled");
      }
      alert(`อัปโหลด ${fieldName.toUpperCase()} สำเร็จ`);
    } else {
      alert(`อัปโหลดสำเร็จ แต่ไม่พบ URL ของ ${fieldName.toUpperCase()}`);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "อัปโหลดไม่สำเร็จ");
  } finally {
    if (fileInput) fileInput.value = "";
  }
}
