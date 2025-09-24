// public/js/brand-edit.js
document.addEventListener("DOMContentLoaded", () => {
  const brandForm = document.getElementById("brandForm");
  const alertBox = document.getElementById("alertBox");
  const btnSave = document.getElementById("btnSave");
  const confirmSaveBtn = document.getElementById("confirmSave");
  const modalEl = document.getElementById("confirmModal");
  const modal = new bootstrap.Modal(modalEl);

  // อ่าน id จาก query string
  const params = new URLSearchParams(window.location.search);
  const brandId = params.get("id");

  if (!brandId) {
    showAlert("ไม่พบรหัสแบรนด์ (id)", "danger");
    btnSave.disabled = true;
    return;
  }

  // โหลดข้อมูลแบรนด์
  async function loadBrand() {
    try {
      const res = await fetch(`/api/brand/read/${brandId}`);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();

      // map ค่าใส่ฟอร์ม
      setValue("brand_id", data.brand_id);
      setValue("brand_name", data.brand_name);
      setValue("owner_name", data.owner_name);
      setValue("brand_line", data.brand_line);
      setValue("brand_phonenumber", data.brand_phonenumber);
      setValue("brand_facebook", data.brand_facebook);
      setValue("brand_email", data.brand_email);
      setValue("brand_note", data.brand_note);
    } catch (err) {
      showAlert(err.message || "ไม่สามารถโหลดข้อมูลแบรนด์ได้", "danger");
    }
  }

  function setValue(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  }

  loadBrand();

  // submit ฟอร์ม → เปิด modal ยืนยัน
  brandForm.addEventListener("submit", (e) => {
    e.preventDefault();
    modal.show();
  });

  // ยืนยันบันทึก → PATCH
  confirmSaveBtn.addEventListener("click", async () => {
    // กัน aria-hidden warning
    confirmSaveBtn.blur();
    modal.hide();

    const payload = {
      brand_name: getVal("brand_name"),
      owner_name: getVal("owner_name"),
      brand_line: getVal("brand_line"),
      brand_phonenumber: getVal("brand_phonenumber"),
      brand_facebook: getVal("brand_facebook"),
      brand_email: getVal("brand_email"),
      brand_note: getVal("brand_note"),
    };

    try {
      const res = await fetch(`/api/brand/update/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "บันทึกการแก้ไขไม่สำเร็จ";
        try {
          const j = await res.json();
          if (j && j.message) msg = j.message;
        } catch {}
        throw new Error(msg);
      }

      showAlert("บันทึกการแก้ไขเรียบร้อยแล้ว", "success");
      setTimeout(() => (location.href = '/brand/index.html'), 800);
    } catch (err) {
      showAlert(err.message || "เกิดข้อผิดพลาดระหว่างบันทึก", "danger");
    }
  });

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function showAlert(message, type = "info") {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type} mt-3`;
    alertBox.classList.remove("d-none");
  }
});
