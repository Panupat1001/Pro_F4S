// /public/js/productdetail-edit.js
document.addEventListener("DOMContentLoaded", function () {
  // ----------- อ่าน product id ให้ครอบคลุม -----------
  var qs = new URLSearchParams(location.search);
  var pid =
    Number(qs.get("id")) ||
    Number(qs.get("productId")) ||
    Number(qs.get("product_id")) || 0;

  // ----------- โหลด/สร้าง draft ให้ตรงสินค้าที่กำลังแก้ -----------
  var draft = null;
  try { draft = JSON.parse(sessionStorage.getItem("productdetailDraft") || "null"); } catch (e) {}

  if (!pid && draft && draft.product_id) pid = Number(draft.product_id);

  // ถ้าไม่มี id ชัวร์ๆ → กลับหน้า index
  if (!pid || Number.isNaN(pid)) {
    showAlert("danger", "ไม่พบรหัสสินค้า (id)");
    setTimeout(function(){ location.href = "/productdetail/index.html"; }, 800);
    return;
  }

  if (!draft || Number(draft.product_id) !== pid) {
    fetch("/product/" + pid, { headers: { Accept: "application/json" } })
      .then(function(res){
        if (!res.ok) throw new Error("โหลดรายละเอียดสินค้าไม่สำเร็จ");
        return res.json();
      })
      .then(function(p){
        draft = {
          product_id: Number(p.product_id || pid),
          product_name: p.product_name || "",
          product_code: p.product_code || p.product_id || "",
          brand_name: p.brand_name || "",
          notify_text: (p.product_fdanum && p.product_fdadate) ? (p.product_fdanum + " · " + p.product_fdadate) : "",
          status: false,
          chems: [],
          remain_percent: 100,
          _ts: Date.now(),
          _chemsLoaded: false
        };
        sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
        afterDraftReady();
      })
      .catch(function(err){
        console.error(err);
        showAlert("danger", "ไม่สามารถเตรียมข้อมูลสำหรับเพิ่มสูตรได้");
        setTimeout(function(){ location.href = "/productdetail/index.html"; }, 800);
      });
  } else {
    afterDraftReady();
  }

  function afterDraftReady() {
    // ===================== DOM =====================
    var pName    = document.getElementById("p_name");
    var pCode    = document.getElementById("p_code");
    var pStatus  = document.getElementById("p_status");
    var pBrand   = document.getElementById("p_brand");
    var pNotify  = document.getElementById("p_notify");

    // (เอาช่องเลือกสาร/ปุ่มเพิ่มออกแล้ว)
    var tbody      = document.getElementById("chemTableBody");
    var remainText = document.getElementById("remainText");
    var btnSave    = document.getElementById("btnSave"); // ถ้าไม่มีในหน้า ก็ไม่เป็นไร
    var btnAddLegacy = document.getElementById("btnAddChem");
    if (btnAddLegacy) { btnAddLegacy.disabled = true; btnAddLegacy.classList.add("d-none"); }
    var chemSelectLegacy = document.getElementById("chem_id");
    if (chemSelectLegacy) chemSelectLegacy.closest(".form-group, .mb-3, .col, .row")?.classList.add("d-none");

    // Confirm Modal (ถ้ามีในหน้า)
    var modalEl    = document.getElementById("confirmModal");
    var confirmBtn = document.getElementById("confirmSave");
    var hasModal   = (typeof bootstrap !== "undefined" && modalEl && confirmBtn);

    // ===================== เติมหัวข้อสินค้า =====================
    if (pName)   pName.value   = draft.product_name || "";
    if (pCode)   pCode.value   = draft.product_code || draft.product_id || "";
    if (pBrand)  pBrand.value  = draft.brand_name || "";
    if (pNotify) pNotify.textContent = draft.notify_text || "-";
    if (remainText) remainText.textContent = String(draft.remain_percent != null ? draft.remain_percent : 100);
    if (pStatus)  pStatus.value = draft.status ? "เสร็จสิ้น" : "ยังไม่เสร็จ";

    // ===================== จัดการชื่อสาร (สำหรับแสดงผล) =====================
    var chemNameCache   = {};
    var chemNamePending = {};

    function fetchChemNameById(chemId) {
      var urls = [
        "/chem/detail?id=" + chemId,
        "/chem/read/" + chemId,
        "/chem/" + chemId
      ];
      var i = 0;
      function next() {
        if (i >= urls.length) return Promise.resolve(null);
        var url = urls[i++];
        return fetch(url, { headers: { Accept: "application/json" } })
          .then(function(res){
            if (!res.ok) return next();
            return res.json();
          })
          .then(function(data){
            if (!data) return next();
            var c = Array.isArray(data) ? (data[0] || null) : data;
            if (!c) return next();
            var name = c.chem_name || (c.chem && c.chem.chem_name) || c.name || "";
            var inci = c.inci_name || "";
            var label = name || "";
            if (label && inci) label += " (" + inci + ")";
            return label || null;
          })
          .catch(function(){ return next(); });
      }
      return next();
    }

    function resolveChemName(chemId) {
      if (!chemId) return;
      if (chemNameCache[chemId] || chemNamePending[chemId]) return;
      chemNamePending[chemId] = true;

      fetchChemNameById(chemId)
        .then(function(label){
          if (!label) label = "ID " + chemId;
          chemNameCache[chemId] = label;

          var changed = false;
          var list = draft.chems || [];
          for (var i=0;i<list.length;i++) {
            var r = list[i];
            if (Number(r.chem_id) === Number(chemId) && (!r.chem_name || (""+r.chem_name).trim() === "")) {
              r.chem_name = label;
              changed = true;
            }
          }
          if (changed) sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
          renderTable();
        })
        .catch(function(){
          chemNameCache[chemId] = "ID " + chemId;
        })
        .then(function(){
          delete chemNamePending[chemId];
        });
    }

    function ensureChemNamesForDraft() {
      var list = draft.chems || [];
      for (var i=0;i<list.length;i++) {
        var r = list[i];
        var hasName = r.chem_name && (""+r.chem_name).trim() !== "";
        if (!hasName) resolveChemName(r.chem_id);
      }
    }

    function getDisplayChemName(row) {
      var hasName = row.chem_name && (""+row.chem_name).trim() !== "";
      if (hasName) return row.chem_name;
      var cached = chemNameCache[row.chem_id];
      if (cached) return cached;
      resolveChemName(row.chem_id);
      return "กำลังโหลดชื่อ…";
    }

    // ===================== ตาราง / รวมเปอร์เซ็นต์ =====================
    function sumPercent() {
      var list = draft.chems || [];
      var s = 0;
      for (var i=0;i<list.length;i++) s += Number(list[i].chem_percent || 0);
      return s;
    }

    function refreshHeaderStatus() {
      // เสร็จสิ้นถ้า: มีแถวใดๆ ที่ productdetail_status = 1 หรือ เปอร์เซ็นต์รวม = 100
      var hasDoneRow = Array.isArray(draft.chems) && draft.chems.some(function(r){
        return Number(r.productdetail_status) === 1;
      });
      var byTotal = Math.abs(sumPercent() - 100) <= 1e-6;
      draft.status = !!(hasDoneRow || byTotal);
      if (pStatus) pStatus.value = draft.status ? "เสร็จสิ้น" : "ยังไม่เสร็จ";
    }

    function renderTable() {
      if (!tbody) return;

      if (!draft.chems || draft.chems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">ยังไม่มีรายการ</td></tr>';
        draft.remain_percent = 100;
        if (remainText) remainText.textContent = "100";
        sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
        refreshHeaderStatus();
        return;
      }

      var html = "";
      for (var i=0;i<draft.chems.length;i++) {
        var row = draft.chems[i];
        var displayName = getDisplayChemName(row);
        html += '' +
          '<tr>' +
            '<td>' + escapeHtml(displayName) + '</td>' +
            '<td class="text-end">' + String(Number(row.chem_percent)) + '</td>' +
          '</tr>';
      }
      tbody.innerHTML = html;

      var remain = Math.max(0, 100 - sumPercent());
      draft.remain_percent = remain;
      if (remainText) remainText.textContent = String(remain);
      sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));

      refreshHeaderStatus();
    }

    // ===================== บันทึก (ถ้ามีปุ่ม) =====================
    if (btnSave) {
      btnSave.addEventListener("click", function () {
        var total = sumPercent();
        if (total > 100 + 1e-9) {
          showAlert("warning", "เปอร์เซ็นต์รวมเกิน 100% กรุณาปรับให้ไม่เกิน 100");
          return;
        }

        var confirmMsg = (Math.abs(total - 100) <= 1e-6)
          ? "ยืนยันบันทึกรายการสารเคมี?"
          : ("ยืนยันบันทึก? (เปอร์เซ็นต์รวมปัจจุบัน = " + total + "%)");

        confirmAsync(confirmMsg, hasModal, modalEl, confirmBtn)
          .then(function(){ return saveProductDetailDraft(); })
          .then(function(){
            showAlert("success", "บันทึกสำเร็จ");
            setTimeout(function(){ location.href = "/productdetail/index.html"; }, 800);
          })
          .catch(function(err){
            if (err === "__CANCELLED__") return;
            console.error("บันทึก error:", err);
            showAlert("danger", (err && err.message) ? err.message : "บันทึกไม่สำเร็จ");
          });
      });
    }

    // ===================== โหลดสูตรเดิมจาก DB แล้วแสดง =====================
    (function initExistingChems() {
      if (!draft._chemsLoaded || !Array.isArray(draft.chems) || draft.chems.length === 0) {
        fetchExistingProductChems(pid)
          .then(function (rows) {
            if (Array.isArray(rows) && rows.length > 0) {
              draft.chems = rows;                      // rows มี productdetail_status ติดมาด้วย
              draft._chemsLoaded = true;
              draft.remain_percent = Math.max(0, 100 - sumPercent());
              sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
            }
          })
          .catch(function (e) {
            console.warn("โหลดสูตรจาก DB ไม่สำเร็จ:", e);
          })
          .then(function () {
            renderTable();
            ensureChemNamesForDraft();  // เติมชื่อสารให้ครบถ้าไม่มี
          });
      } else {
        renderTable();
        ensureChemNamesForDraft();
      }
    })();
  } // end afterDraftReady

  // ===================== Helpers (global to this file) =====================
  function confirmAsync(message, hasModal, modalEl, confirmBtn) {
    return new Promise(function(resolve, reject){
      if (hasModal) {
        var modal = new bootstrap.Modal(modalEl);
        var bodyEl = modalEl.querySelector(".modal-body");
        if (bodyEl) bodyEl.textContent = message;

        function onConfirm() { cleanup(); modal.hide(); resolve(); }
        function onHide()    { cleanup(); reject("__CANCELLED__"); }
        function cleanup() {
          confirmBtn.removeEventListener("click", onConfirm);
          modalEl.removeEventListener("hidden.bs.modal", onHide);
        }
        confirmBtn.addEventListener("click", onConfirm, { once: true });
        modalEl.addEventListener("hidden.bs.modal", onHide, { once: true });
        modal.show();
        return;
      }
      if (window.confirm(message)) resolve(); else reject("__CANCELLED__");
    });
  }

  function saveProductDetailDraft() {
    var latestStr = sessionStorage.getItem("productdetailDraft");
    if (!latestStr) return Promise.reject(new Error("ไม่พบข้อมูลร่างใน sessionStorage"));
    var latest = JSON.parse(latestStr);

    var product_id = latest.product_id || latest.productId || latest.p_id;
    if (!product_id) return Promise.reject(new Error("ไม่พบ product_id ในร่างข้อมูล"));

    var chems = Array.isArray(latest.chems) ? latest.chems : [];
    if (chems.length === 0) return Promise.reject(new Error("ไม่มีรายการสารเคมีให้บันทึก"));

    // ไม่ส่ง productdetail_status จากฝั่งหน้าเว็บ
    var payload = {
      product_id: Number(product_id),
      chems: chems.map(function(x){
        return {
          chem_id: Number(x.chem_id),
          chem_percent: Number(x.chem_percent)
        };
      })
    };

    return fetch("/productdetail/save-chems", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
    .then(function(res){
      if (!res.ok) return res.json().catch(function(){ return {}; }).then(function(j){
        throw new Error(j && j.message ? j.message : ("บันทึกไม่สำเร็จ (" + res.status + ")"));
      });
      return res.json();
    });
  }

  function fetchExistingProductChems(productId) {
    var urls = [
      "/productdetail/read?product_id=" + productId,
      "/productdetail/detail?product_id=" + productId,
      "/productdetail/chems?product_id=" + productId,
      "/productdetail/read/" + productId,
      "/productdetail/detail/" + productId,
      "/productdetail/chems/" + productId
    ];

    var i = 0;
    function tryNext() {
      if (i >= urls.length) return Promise.resolve([]);
      var url = urls[i++];
      return fetch(url, { headers: { Accept: "application/json" } })
        .then(function(res){
          if (!res.ok) return tryNext();
          return res.json();
        })
        .then(function(data){
          if (!data) return [];
          var items = Array.isArray(data) ? data : (data.items || data.chems || data.rows || []);
          if (!Array.isArray(items) || items.length === 0) return [];

          // กรองเฉพาะ product_id ตรง
          var filtered = items.filter(function(n){
            var pid2 = Number(
              (n.product_id != null ? n.product_id :
              (n.p_id != null ? n.p_id :
              (n.productId != null ? n.productId : n.productid)))
            );
            return Number.isFinite(pid2) && pid2 === Number(productId);
          });
          if (filtered.length === 0) return [];

          // ทำให้รูปแบบข้อมูลเป็นมาตรฐาน + ดึง productdetail_status
          var normalized = filtered.map(function(n){
            return {
              chem_id: Number((n.chem_id != null ? n.chem_id : n.id)),
              chem_percent: Number(
                (n.chem_percent != null ? n.chem_percent :
                (n.percent != null ? n.percent :
                (n.percentage != null ? n.percentage : 0)))
              ),
              chem_name: (n.chem_name != null ? n.chem_name : (n.name != null ? n.name : "")),
              product_id: Number(
                (n.product_id != null ? n.product_id :
                (n.p_id != null ? n.p_id :
                (n.productId != null ? n.productId : n.productid)))
              ),
              productdetail_status: Number(
                n.productdetail_status != null ? n.productdetail_status :
                (n.status != null ? n.status : 0)
              )
            };
          }).filter(function(it){
            return it.chem_id && Number.isFinite(it.chem_percent);
          });

          return normalized;
        })
        .catch(function(){
          return tryNext();
        });
    }
    return tryNext();
  }

  function escapeHtml(s) {
    s = String(s);
    s = s.replace(/&/g, '&amp;');
    s = s.replace(/</g, '&lt;');
    s = s.replace(/>/g, '&gt;');
    s = s.replace(/"/g, '&quot;');
    s = s.replace(/'/g, '&#39;');
    return s;
  }
});

// ===== helper alert (Bootstrap) =====
function showAlert(type, msg) {
  var alertBox = document.getElementById("alertBox");
  if (!alertBox) { alert(msg); return; }
  alertBox.className = "alert alert-" + type;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
}
