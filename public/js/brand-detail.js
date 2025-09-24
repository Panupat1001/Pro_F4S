document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const API = "/api/brand";

  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    alert("ไม่พบพารามิเตอร์ id");
    return;
  }

  const setVal = (elId, v) => {
    const el = $(elId);
    if (!el) return;
    el.value = v ?? "";
  };

  async function fetchDetail() {
    const url = `${API}/read/${encodeURIComponent(id)}`;
    const r = await fetch(url);
    if (r.status === 404) throw new Error("ไม่พบรายการนี้ (404)");
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return r.json();
  }

  async function load() {
    try {
      const data = await fetchDetail();
      console.log("brand-detail:", data);

      const brandId = data.brand_id ?? data.id ?? id;

      setVal("brand_id", brandId);
      setVal("brand_name", data.brand_name ?? data.name);
      setVal("owner_name", data.owner_name ?? data.owner);
      setVal("brand_line", data.brand_line ?? data.line);
      setVal("brand_phonenumber", data.brand_phonenumber ?? data.phone ?? data.phone_number);
      setVal("brand_facebook", data.brand_facebook ?? data.facebook ?? data.facebook_url);
      setVal("brand_email", data.brand_email ?? data.email ?? data.contact_email);
      setVal("brand_note", data.brand_note ?? data.note ?? data.remark);

      const backBtn = $("btnBack");
      if (backBtn) backBtn.href = "/brand/index.html";

      const editBtn = $("btnEdit");
      if (editBtn) editBtn.href = `/brand/edit.html?id=${encodeURIComponent(brandId)}`;
    } catch (err) {
      console.error(err);
      alert("โหลดรายละเอียดไม่สำเร็จ: " + err.message);
    }
  }

  load();
});
