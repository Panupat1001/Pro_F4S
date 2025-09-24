// /public/js/product-create.js
document.addEventListener("DOMContentLoaded", () => {
  // --------- DOMs ---------
  const form = document.getElementById("productForm");
  const brandSelect = document.getElementById("brand_id");
  const productName = document.getElementById("product_name");
  const fdaNum = document.getElementById("product_fdanum");
  const fdaDate = document.getElementById("product_fdadate");
  const expDate = document.getElementById("product_exp");
  const obsolete = document.getElementById("product_obsolete");

  const file1 = document.getElementById("file_picture1");
  const file2 = document.getElementById("file_picture2");
  const file3 = document.getElementById("file_picture3");
  const preview1 = document.getElementById("preview_picture1");
  const preview2 = document.getElementById("preview_picture2");
  const preview3 = document.getElementById("preview_picture3");
  const pic1 = document.getElementById("product_picture1"); // hidden url
  const pic2 = document.getElementById("product_picture2");
  const pic3 = document.getElementById("product_picture3");

  // --------- Helpers ---------
  const safe = (v) =>
    String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

  function btnBusy(busy) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy) {
      btn.dataset._label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...`;
    } else {
      btn.disabled = false;
      if (btn.dataset._label) btn.innerHTML = btn.dataset._label;
    }
  }

  function ensureAlertBox() {
    let box = document.getElementById("formAlert");
    if (!box) {
      box = document.createElement("div");
      box.id = "formAlert";
      form.prepend(box);
    }
    return box;
  }

  function toast(msg, cls = "alert-danger") {
    const box = ensureAlertBox();
    if (!msg) {
      box.className = "d-none";
      box.textContent = "";
      return;
    }
    box.className = `alert ${cls}`;
    box.textContent = msg;
  }

  // ---------- FDA number: mask + validate ----------
  // รูปแบบที่ต้องการ: xx-x-xxxxxxxxxx (2-1-10 ตัวเลข)
  const FDA_REGEX = /^\d{2}-\d-\d{10}$/;

  // ใส่ placeholder ให้ช่อง input (เผื่อไม่ได้ใส่ใน HTML)
  if (fdaNum) {
    fdaNum.setAttribute("placeholder", "xx-x-xxxxxxxxxx");
    fdaNum.setAttribute("autocomplete", "off");
    // ยอมให้เว้นว่างได้ (แล้วแต่กติกา) — ถ้าต้องการบังคับกรอกให้ใส่ required ใน HTML
    fdaNum.setAttribute("inputmode", "numeric");
  }

  function formatFda(valueDigitsOnly) {
    // ตัดทุกอย่างนอกจากตัวเลข
    let v = (valueDigitsOnly || "").replace(/\D/g, "").slice(0, 13); // 2 + 1 + 10 = 13 digits
    // ใส่ขีด: 2 หลักแรก, 1 หลักถัดมา, 10 หลักสุดท้าย
    if (v.length > 2) v = v.slice(0, 2) + "-" + v.slice(2);
    if (v.length > 4) v = v.slice(0, 4) + "-" + v.slice(4);
    return v;
  }

  function fdaSetInvalidState(isInvalid) {
    if (!fdaNum) return;
    if (isInvalid) {
      fdaNum.classList.add("is-invalid");
      fdaNum.classList.remove("is-valid");
    } else {
      fdaNum.classList.remove("is-invalid");
      if (fdaNum.value) fdaNum.classList.add("is-valid");
      else fdaNum.classList.remove("is-valid");
    }
  }

  if (fdaNum) {
    // พิมพ์แล้วใส่ขีดอัตโนมัติ
    fdaNum.addEventListener("input", (e) => {
      const caret = e.target.selectionStart;
      const before = e.target.value;
      const after = formatFda(before);
      e.target.value = after;

      // ตรวจรูปแบบเบื้องต้น
      fdaSetInvalidState(after.length > 0 && !FDA_REGEX.test(after));

      // พยายามคง cursor ไว้ให้ใกล้เคียงเดิม
      let newPos = caret;
      // ถ้าเพิ่มขีดเข้ามา อาจต้องเลื่อนตำแหน่ง 1
      if (after.length > before.length && (after[2] === "-" || after[4] === "-") && caret >= after.length - 1) {
        newPos = caret + 1;
      }
      e.target.setSelectionRange(newPos, newPos);
    });

    // blur แล้วเช็คอีกครั้ง
    fdaNum.addEventListener("blur", () => {
      const v = fdaNum.value.trim();
      if (!v) {
        fdaSetInvalidState(false); // ว่าง = ไม่เตือน (ถ้าต้องบังคับกรอก ใส่ required)
        return;
      }
      fdaSetInvalidState(!FDA_REGEX.test(v));
    });
  }

  // --------- Load brands (for select) ---------
  const BRAND_ENDPOINTS = ["/brand/read", "/api/brand/read", "/api/brand/list", "/brand/list"];

  function normalizeBrand(row) {
    const id = row.id ?? row.brand_id ?? row.ID_ ?? row.BRAND_ID_;
    const name = row.brand_name ?? row.BRAND_NAME ?? row.name ?? row.NAME_;
    return { id, name };
  }

  async function tryFetch(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : null;
    if (!list) throw new Error("Unexpected payload");
    return list.map(normalizeBrand).filter((b) => b.id && b.name);
  }

  async function loadBrands() {
    let lastErr;
    for (const ep of BRAND_ENDPOINTS) {
      try {
        const list = await tryFetch(ep);
        // เติมลง select
        brandSelect.length = 1; // เว้น placeholder
        list.forEach((b) => {
          const opt = document.createElement("option");
          opt.value = b.id;
          opt.textContent = safe(b.name);
          brandSelect.appendChild(opt);
        });
        // preselect จาก ?brand_id=
        const pre = new URLSearchParams(location.search).get("brand_id");
        if (pre) brandSelect.value = pre;
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    console.error("Load brands failed:", lastErr);
    toast("โหลดรายชื่อแบรนด์ไม่สำเร็จ", "alert-warning");
  }

  // --------- Upload images with preview ---------
  const UPLOAD_ENDPOINT = "/upload/product-image";
  const ALLOW_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE = 5 * 1024 * 1024;

  async function uploadOneFile(file) {
    if (!file) return null;
    if (!ALLOW_TYPES.includes(file.type)) throw new Error("ชนิดไฟล์ไม่รองรับ (JPG/PNG/WEBP/GIF)");
    if (file.size > MAX_SIZE) throw new Error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)");

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: fd });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`อัพโหลดไม่สำเร็จ: HTTP ${res.status} ${t}`);
    }
    const data = await res.json();
    if (!data?.url) throw new Error("รูปแบบการตอบกลับไม่ถูกต้อง");
    return data.url;
  }

  function bindUploader(fileEl, previewEl, hiddenUrlEl) {
    if (!fileEl || !previewEl || !hiddenUrlEl) return;
    fileEl.addEventListener("change", async () => {
      const file = fileEl.files?.[0];
      if (!file) return;
      // preview local
      const localUrl = URL.createObjectURL(file);
      previewEl.src = localUrl;
      previewEl.classList.remove("d-none");
      try {
        const url = await uploadOneFile(file);
        hiddenUrlEl.value = url;
        previewEl.src = url; // สลับเป็น URL จริงหลังอัพโหลดเสร็จ
      } catch (err) {
        alert(err.message || "อัพโหลดรูปภาพไม่สำเร็จ");
        previewEl.src = "";
        previewEl.classList.add("d-none");
        hiddenUrlEl.value = "";
        fileEl.value = "";
      }
    });
  }

  bindUploader(file1, preview1, pic1);
  bindUploader(file2, preview2, pic2);
  bindUploader(file3, preview3, pic3);

  // --------- Submit form to backend ---------
  const PRODUCT_CREATE_ENDPOINTS = ["/product/create", "/api/product/create"];

  async function tryPostJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json().catch(() => ({}));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ตรวจค่าเบื้องต้น
    if (!brandSelect.value) {
      toast("กรุณาเลือกแบรนด์", "alert-danger");
      brandSelect.focus();
      return;
    }
    if (!productName.value.trim()) {
      toast("กรุณากรอกชื่อผลิตภัณฑ์", "alert-danger");
      productName.focus();
      return;
    }

    // ตรวจเลข อย. ถ้ามีค่า → ต้องตรงรูปแบบ xx-x-xxxxxxxxxx
    if (fdaNum && fdaNum.value.trim()) {
      const val = fdaNum.value.trim();
      if (!FDA_REGEX.test(val)) {
        toast("กรุณากรอกเลขที่จดแจ้ง (อย.) ตามรูปแบบ xx-x-xxxxxxxxxx", "alert-danger");
        fdaSetInvalidState(true);
        fdaNum.focus();
        return;
      }
    }

    // เตรียม payload
    const payload = {
      brand_id: brandSelect.value,
      product_name: productName.value.trim(),
      product_picture1: pic1.value || null,
      product_picture2: pic2.value || null,
      product_picture3: pic3.value || null,
      product_fdanum: fdaNum?.value?.trim() || null,
      product_fdadate: fdaDate.value || null,
      product_exp: expDate.value || null,
      product_obsolete: Number(obsolete.value ?? 0),
    };

    btnBusy(true);
    toast("", "alert-info"); // เคลียร์

    let lastErr;
    for (const ep of PRODUCT_CREATE_ENDPOINTS) {
      try {
        await tryPostJson(ep, payload);
        // สำเร็จ -> ไปหน้า index
        location.href = "/product/index.html";
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    btnBusy(false);
    console.error("Create product failed:", lastErr);
    toast("บันทึกไม่สำเร็จ กรุณาลองใหม่ หรือแจ้งผู้ดูแลระบบ", "alert-danger");
  });

  // start
  loadBrands();
});
