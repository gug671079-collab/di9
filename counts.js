"use strict";
(() => {
  const seatKey = "oncloud-nine:school-seat:1";
  const ticketKey = seatKey + ":tab";
  const scriptEndpoint = document.currentScript?.dataset.resultsApi;
  let ticket;

  function resultsEndpoint() {
    const configured = document.documentElement.dataset.resultsApi || scriptEndpoint;
    if (!configured) return "/api/results";
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid results endpoint");
    return url.href;
  }

  function newRun() {
    ticket = null;
    try { sessionStorage.removeItem(ticketKey); } catch {}
  }

  // Serialize the short read/update across tabs even on WebViews without Web Locks.
  function withSeatLock(readWrite) {
    if (navigator.locks) return navigator.locks.request(seatKey, readWrite);
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(seatKey, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("locks");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("locks", "readwrite");
        let value;
        tx.objectStore("locks").get("seat").onsuccess = () => {
          try { value = readWrite(); }
          catch (error) { tx.abort(); reject(error); }
        };
        tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }

  function prepareSeat(schoolId, signature) {
    return withSeatLock(() => {
      const stored = localStorage.getItem(seatKey);
      let seat = stored && JSON.parse(stored);
      if (!seat) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const browserId = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
        seat = {browserId, revision: 0};
      }
      if (!/^[0-9a-f]{32}$/.test(seat.browserId) || !Number.isSafeInteger(seat.revision) || seat.revision < 0) {
        throw new Error("Invalid stored seat");
      }
      if (ticket === undefined) {
        try { ticket = JSON.parse(sessionStorage.getItem(ticketKey)); } catch { ticket = null; }
      }
      const bankRevision = window.CloudQuiz.revision;
      // Reloading an old result page must not overwrite a newer result from another tab.
      if (ticket?.browserId === seat.browserId && ticket.bankRevision === bankRevision &&
          ticket.signature === signature && ticket.expectedId === schoolId &&
          Number.isSafeInteger(ticket.revision) && ticket.revision > 0) return ticket;

      if (seat.bankRevision !== bankRevision || seat.schoolId !== schoolId) {
        seat = {browserId: seat.browserId, revision: seat.revision + 1, bankRevision, schoolId};
        localStorage.setItem(seatKey, JSON.stringify(seat));
      }
      ticket = {browserId: seat.browserId, revision: seat.revision, bankRevision, expectedId: schoolId, signature};
      try { sessionStorage.setItem(ticketKey, JSON.stringify(ticket)); } catch {}
      return ticket;
    });
  }

  function attach(panel, item, answers) {
    const notice = document.createElement("p");
    notice.className = "result-count";
    notice.setAttribute("role", "status");
    panel.append(notice);
    if (!window.CloudQuiz.ready || !item?.id) {
      notice.textContent = "试玩模式 · 校友统计暂未开放";
      return;
    }
    if (location.protocol === "file:" || document.documentElement.hasAttribute("data-portable")) {
      notice.textContent = "离线试玩 · 校友统计暂未开放";
      return;
    }

    const submitted = [...answers];
    let body;
    async function submit() {
      notice.textContent = "正在读取校友人数…";
      if (!body) {
        try {
          const {browserId, revision, bankRevision, expectedId} = await prepareSeat(item.id, submitted.join(","));
          body = JSON.stringify({browserId, revision, bankRevision, expectedId, answers: submitted});
        } catch {
          notice.textContent = "浏览器未能保存席位，本次未计入统计。";
          return;
        }
      }
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 10000);
      try {
        const response = await fetch(resultsEndpoint(), {
          method: "POST", headers: {"Content-Type": "application/json"}, body, signal: abort.signal,
          credentials: "omit"
        });
        if (response.status === 409) {
          const failure = await response.json();
          notice.textContent = failure.error === "result_changed"
            ? "题库已更新，刷新页面后可重新测试。"
            : "你已在另一轮测试中更新了分院。";
          return;
        }
        if (!response.ok) throw new Error("Unavailable statistics");
        const data = await response.json();
        if (data.mode === "rehearsal") {
          notice.textContent = "试玩模式 · 校友统计暂未开放";
        } else if (data.mode === "live" && data.id === item.id && Number.isSafeInteger(data.peers) && data.peers >= 0) {
          notice.textContent = "你的校友已有 " + data.peers + " 人";
        } else { throw new Error("Invalid alumni count"); }
      } catch {
        notice.textContent = "暂时读不到校友人数。";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "quiet";
        retry.textContent = "重试";
        retry.addEventListener("click", submit, {once: true});
        notice.append(retry);
      } finally { clearTimeout(timeout); }
    }
    submit();
  }
  window.QuizCounts = {attach, newRun};
})();
