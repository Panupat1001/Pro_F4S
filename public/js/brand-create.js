// /js/brand-create.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("brandForm") || document.querySelector("form");
  const btnSave = document.getElementById("btnSave");
  const alertBox = document.getElementById("alertBox");
  const confirmBtn = document.getElementById("confirmSave");
  const confirmModalEl = document.getElementById("confirmModal");

  if (!form || !btnSave || !alertBox || !confirmBtn || !confirmModalEl) return;

  const confirmModal = new bootstrap.Modal(confirmModalEl, { backdrop: "static", keyboard: false });
  const ENDPOINT = "/brand/create"; // ปรับให้ตรงกับ backend ของคุณ

  function showAlert(type, message) {
    alertBox.className = `alert alert-${type} mt-3`;
    alertBox.innerHTML = message;
  }
  function hideAlert() {
    alertBox.className = "alert mt-3 d-none";
    alertBox.innerHTML = "";
  }

  const clean = (v) => String(v ?? "").trim();
  const digits = (v) => String(v ?? "").replace(/\D+/g, "");

  function buildPayload(fd) {
    return {
      brand_name: clean(fd.get("brand_name")),
      owner_name: clean(fd.get("owner_name")),
      brand_line: clean(fd.get("brand_line")),
      brand_facebook: clean(fd.get("brand_facebook")),
      brand_email: clean(fd.get("brand_email")).toLowerCase(),
      brand_phonenumber: digits(fd.get("brand_phonenumber")),
      brand_note: clean(fd.get("brand_note")),
    };
  }

  function validate(p) {
    const errs = [];
    if (!p.brand_name) errs.push("กรุณากรอก ‘ชื่อแบรนด์’");
    if (!p.owner_name) errs.push("กรุณากรอก ‘เจ้าของแบรนด์’");
    if (p.brand_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.brand_email)) {
      errs.push("รูปแบบอีเมลไม่ถูกต้อง");
    }
    if (p.brand_phonenumber && !/^\d{9,10}$/.test(p.brand_phonenumber)) {
      errs.push("เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก");
    }
    return errs;
  }

  function setLoading(button, loading, labelWhenDone = "ยืนยัน") {
    if (!button) return;
    if (loading) {
      button.disabled = true;
      button.dataset.prev = button.innerHTML;
      button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> กำลังบันทึก…`;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.prev || labelWhenDone;
      delete button.dataset.prev;
    }
  }

  // intercept submit → เปิดโมดัลก่อนเสมอ
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    hideAlert();
    confirmModal.show();
  });

  // กดยืนยัน → ส่งจริง
  confirmBtn.addEventListener("click", async () => {
    hideAlert();

    const fd = new FormData(form);
    const payload = buildPayload(fd);
    const errors = validate(payload);
    if (errors.length) {
      confirmModal.hide();
      showAlert("danger", errors.map((e) => `• ${e}`).join("<br/>"));
      return;
    }

    setLoading(confirmBtn, true);

    try {
      confirmModal.hide();

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showAlert("success", "บันทึกสำเร็จ! กำลังพากลับไปหน้ารายการแบรนด์…");
        setTimeout(() => (window.location.href = "/brand/index.html"), 800);
      } else if (res.status === 409) {
        const msg = await res.text().catch(() => "");
        showAlert("warning", msg || "มีชื่อแบรนด์นี้อยู่แล้ว กรุณาตรวจสอบอีกครั้ง");
      } else {
        const text = await res.text().catch(() => "");
        showAlert("danger", `บันทึกไม่สำเร็จ (HTTP ${res.status})${text ? `: ${text}` : ""}`);
      }
    } catch (err) {
      console.error(err);
      showAlert("danger", "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(confirmBtn, false);
    }
  });

  // ปุ่มบันทึกหลักปล่อยให้ submit form จัดการ (เพื่อเด้งโมดัล)
  btnSave.addEventListener("click", () => {});
});
