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

  // ถ้า URL ไม่มี id แต่ draft มี → ใช้ draft
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

    var chemSelectEl = document.getElementById("chem_id");
    var chemInfoBox  = document.getElementById("chem_info");
    var percentInput = document.getElementById("chem_percent");
    var btnAdd       = document.getElementById("btnAddChem");

    var tbody      = document.getElementById("chemTableBody");
    var remainText = document.getElementById("remainText");
    var btnSave    = document.getElementById("btnSave");

    // Confirm Modal (ถ้ามีในหน้า)
    var modalEl    = document.getElementById("confirmModal");
    var confirmBtn = document.getElementById("confirmSave");
    var hasModal   = (typeof bootstrap !== "undefined" && modalEl && confirmBtn);

    // ===================== เติมหัวข้อสินค้า =====================
    if (pName)   pName.value   = draft.product_name || "";
    if (pCode)   pCode.value   = draft.product_code || draft.product_id || "";
    if (pStatus) pStatus.value = draft.status ? "เสร็จสิ้น" : "ยังไม่เสร็จ";
    if (pBrand)  pBrand.value  = draft.brand_name || "";
    if (pNotify) pNotify.textContent = draft.notify_text || "-";
    if (remainText) remainText.textContent = String(draft.remain_percent != null ? draft.remain_percent : 100);

    // ===================== ชื่อสาร: แคช + ดึงชื่อเมื่อขาด =====================
    var chemNameCache   = {};   // { [chem_id]: "ชื่อสาร (INCI)" }
    var chemNamePending = {};   // ป้องกันยิงซ้ำ

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

          // อัปเดต draft ถ้าช่อง chem_name ว่าง
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
      // ยังไม่มี -> trigger fetch แล้วโชว์สถานะชั่วคราว
      resolveChemName(row.chem_id);
      return "กำลังโหลดชื่อ…";
    }

    // ===================== Tom Select ค้นหาสาร =====================
    var chemSelectTS = null;

    function renderChemInfo(selected) {
      if (!chemInfoBox) return;
      if (!selected) { chemInfoBox.innerHTML = ""; return; }
      var inci = selected.inci_name ? (" (" + selected.inci_name + ")") : "";
      var unit = selected.chem_unit ? (" • หน่วย: " + selected.chem_unit) : "";
      var type = selected.chem_type ? (" • ชนิด: " + selected.chem_type) : "";
      chemInfoBox.innerHTML =
        '<div class="alert alert-secondary py-2 mb-0">' +
          '<div><strong>' + escapeHtml(selected.chem_name || "-") + '</strong>' + inci + '</div>' +
          '<div class="small text-muted">' + unit + type + '</div>' +
        '</div>';
    }

    (function initChemSearch() {
      if (!chemSelectEl || typeof TomSelect === "undefined") return;

      chemSelectEl.innerHTML = '<option value="">-- เลือกสารเคมี --</option>';
      if (chemSelectTS) { try { chemSelectTS.destroy(); } catch (e) {} chemSelectTS = null; }

      chemSelectTS = new TomSelect(chemSelectEl, {
        valueField: "id",
        labelField: "label",
        searchField: ["label", "chem_name", "inci_name", "chem_unit", "chem_type"],
        maxOptions: 200,
        preload: true,
        allowEmptyOption: true,
        plugins: ["dropdown_input","clear_button"],
        placeholder: "พิมพ์ชื่อสารหรือ INCI เพื่อค้นหา…",
        load: function (query, callback) {
          var url = (query && query.trim().length > 0)
            ? ("/chem/search?q=" + encodeURIComponent(query) + "&limit=50")
            : "/chem/read-all?limit=200";

          fetch(url, { headers: { Accept: "application/json" } })
            .then(function(res){ return res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status)); })
            .then(function(list){
              var options = (list || []).map(function(c){
                return {
                  id: Number((c.id != null ? c.id : c.chem_id)),
                  chem_name: c.chem_name || "",
                  inci_name: c.inci_name || "",
                  chem_unit: c.chem_unit || "",
                  chem_type: c.chem_type || "",
                  label: (c.chem_name || "-") + (c.inci_name ? (" (" + c.inci_name + ")") : "")
                };
              });
              callback(options);
            })
            .catch(function(err){
              console.error("chem load error:", err);
              callback();
            });
        },
        render: {
          option: function (data, escape) {
            return '' +
              '<div>' +
                '<div class="fw-semibold">' + escape(data.chem_name || "-") + '</div>' +
                '<div class="small text-muted">' +
                  (data.inci_name ? (escape(data.inci_name) + " · ") : "") +
                  (data.chem_unit ? ("หน่วย: " + escape(data.chem_unit) + " · ") : "") +
                  (data.chem_type ? ("ชนิด: " + escape(data.chem_type)) : "") +
                '</div>' +
              '</div>';
          },
          item: function (data, escape) {
            return '<div>' + escape(data.chem_name || data.label) + '</div>';
          }
        },
        onChange: function (value) {
          var id = Number(value || 0);
          var raw = null;
          if (id && chemSelectTS && chemSelectTS.options) {
            raw = chemSelectTS.options[String(id)] || null;
          }
          renderChemInfo(raw);
        }
      });
    })();

    // ===================== ตาราง / รวมเปอร์เซ็นต์ =====================
    function sumPercent() {
      var list = draft.chems || [];
      var s = 0;
      for (var i=0;i<list.length;i++) s += Number(list[i].chem_percent || 0);
      return s;
    }

    function renderTable() {
      if (!tbody) return;

      if (!draft.chems || draft.chems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">ยังไม่มีรายการ</td></tr>';
        if (remainText) remainText.textContent = "100";
        draft.remain_percent = 100;
        sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
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
            '<td class="text-center">' +
              '<button class="btn btn-sm btn-outline-danger" data-idx="' + i + '">' +
                '<i class="bi bi-x-lg"></i>' +
              '</button>' +
            '</td>' +
          '</tr>';
      }
      tbody.innerHTML = html;

      var remain = Math.max(0, 100 - sumPercent());
      draft.remain_percent = remain;
      if (remainText) remainText.textContent = String(remain);
      sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
    }

    // ลบรายการสาร
    if (tbody) {
      tbody.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-idx]");
        if (!btn) return;
        var idx = Number(btn.getAttribute("data-idx"));
        draft.chems.splice(idx, 1);
        renderTable();
      });
    }

    // เพิ่มรายการสาร
    if (btnAdd) {
      btnAdd.addEventListener("click", function () {
        var chem_id = 0, chem_name = "";

        if (chemSelectTS) {
          var val = chemSelectTS.getValue();
          chem_id = Number(val || 0);
          if (chem_id) {
            var opt = chemSelectTS.options && chemSelectTS.options[String(chem_id)];
            if (opt) {
              chem_name = opt.chem_name || opt.label || ("ID " + chem_id);
            } else {
              var itemEl = chemSelectTS.getItem && chemSelectTS.getItem(String(chem_id));
              chem_name = (itemEl && itemEl.textContent ? itemEl.textContent.trim() : ("ID " + chem_id));
            }
          }
        } else if (chemSelectEl) {
          chem_id = Number(chemSelectEl.value);
          var optEl = chemSelectEl.options[chemSelectEl.selectedIndex];
          chem_name = optEl ? optEl.textContent : ("ID " + chem_id);
        }

        var chem_percent = parseFloat(percentInput ? percentInput.value : "");

        if (!chem_id) { showAlert("warning", "กรุณาเลือกสารเคมี"); return; }
        if (isNaN(chem_percent) || chem_percent <= 0) { showAlert("warning", "กรุณากรอกเปอร์เซ็นต์ให้ถูกต้อง"); return; }

        var currentSum = sumPercent();
        if (currentSum + chem_percent > 100 + 1e-9) {
          showAlert("warning", "เปอร์เซ็นต์รวมเกิน 100%");
          return;
        }

        draft.chems = draft.chems || [];
        draft.chems.push({ chem_id: chem_id, chem_name: chem_name, chem_percent: chem_percent });

        if (percentInput) percentInput.value = "";
        if (chemSelectTS && chemSelectTS.clear) chemSelectTS.clear();
        renderChemInfo(null);
        renderTable();
      });
    }

    // ===================== บันทึก (ยืนยันก่อน) =====================
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
          .then(function(){
            return saveProductDetailDraft();
          })
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

// ===================== โหลดสูตรเดิมจาก DB แล้วแสดง + เติมชื่อสารให้ครบ =====================
(function initExistingChems() {
  // ถ้ายังไม่เคยโหลด หรือยังไม่มีรายการ → ไปโหลดจาก DB
  if (!draft._chemsLoaded || !Array.isArray(draft.chems) || draft.chems.length === 0) {
    fetchExistingProductChems(pid)
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length > 0) {
          draft.chems = rows;                      // อาจมีบาง record มีแค่ chem_id
          draft._chemsLoaded = true;
          draft.remain_percent = Math.max(0, 100 - sumPercent());
          sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
        }
      })
      .catch(function (e) {
        console.warn("โหลดสูตรจาก DB ไม่สำเร็จ:", e);
      })
      .then(function () {
        // ⚡ เรียกหลัง fetch เสร็จทั้งกรณีสำเร็จ/ล้มเหลว
        renderTable();
        ensureChemNamesForDraft();  // ถ้า row ไหนยังไม่มีชื่อ ไปดึงชื่อมาเติม
      });
  } else {
    // ถ้ามีอยู่แล้ว ก็เรนเดอร์เลย
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
    if (chems.length === 0) return Promise.reject(new Error("กรุณาเพิ่มรายการสารเคมีก่อนบันทึก"));

    var payload = {
      product_id: Number(product_id),
      chems: chems.map(function(x){
        return {
          chem_id: Number(x.chem_id),
          chem_percent: Number(x.chem_percent)
        };
      }),
      productdetail_status: 1
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

          // กรองให้เหลือเฉพาะ product_id ตรง
          var filtered = items.filter(function(n){
            var pid2 = Number(
              (n.product_id != null ? n.product_id :
              (n.p_id != null ? n.p_id :
              (n.productId != null ? n.productId : n.productid)))
            );
            return Number.isFinite(pid2) && pid2 === Number(productId);
          });
          if (filtered.length === 0) return [];

          // ทำให้รูปแบบข้อมูลเป็นมาตรฐาน
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
