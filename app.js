(function () {
  "use strict";

  var STORAGE_KEY = "teamTodoList.v1";
  var DAY_MS = 24 * 60 * 60 * 1000;

  var state = {
    tasks: [],
    collaborators: [],
    folder: "todo",
    view: "list",
    calendarDate: new Date()
  };

  var elements = {
    pageTitle: document.getElementById("pageTitle"),
    taskForm: document.getElementById("taskForm"),
    inviteForm: document.getElementById("inviteForm"),
    eventType: document.getElementById("eventType"),
    startDate: document.getElementById("startDate"),
    dueDate: document.getElementById("dueDate"),
    composerPanel: document.getElementById("composerPanel"),
    viewToolbar: document.getElementById("viewToolbar"),
    toolbarMeta: document.getElementById("toolbarMeta"),
    listPanel: document.getElementById("listPanel"),
    calendarPanel: document.getElementById("calendarPanel"),
    reminderPanel: document.getElementById("reminderPanel"),
    collaborationPanel: document.getElementById("collaborationPanel"),
    taskList: document.getElementById("taskList"),
    reminderList: document.getElementById("reminderList"),
    calendarGrid: document.getElementById("calendarGrid"),
    calendarTitle: document.getElementById("calendarTitle"),
    todoCount: document.getElementById("todoCount"),
    completedCount: document.getElementById("completedCount"),
    reminderCount: document.getElementById("reminderCount"),
    collaboratorCount: document.getElementById("collaboratorCount"),
    collaboratorList: document.getElementById("collaboratorList"),
    dueSoonMini: document.getElementById("dueSoonMini"),
    toast: document.getElementById("toast"),
    notificationButton: document.getElementById("notificationButton"),
    shareButton: document.getElementById("shareButton"),
    copyInviteButton: document.getElementById("copyInviteButton"),
    prevMonth: document.getElementById("prevMonth"),
    nextMonth: document.getElementById("nextMonth")
  };

  init();

  function init() {
    loadState();
    importSharedData();
    setDefaultDates();
    bindEvents();
    render();
    runDailyReminderCheck();
  }

  function bindEvents() {
    elements.taskForm.addEventListener("submit", addTask);
    elements.inviteForm.addEventListener("submit", sendInvite);

    elements.eventType.addEventListener("change", function () {
      if (elements.eventType.value === "single" && elements.dueDate.value) {
        elements.startDate.value = elements.dueDate.value;
      }
    });

    elements.dueDate.addEventListener("change", function () {
      if (elements.eventType.value === "single") {
        elements.startDate.value = elements.dueDate.value;
      }
    });

    document.querySelectorAll("[data-folder]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.folder = button.dataset.folder;
        render();
      });
    });

    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.view = button.dataset.view;
        render();
      });
    });

    elements.prevMonth.addEventListener("click", function () {
      state.calendarDate = new Date(
        state.calendarDate.getFullYear(),
        state.calendarDate.getMonth() - 1,
        1
      );
      renderCalendar();
    });

    elements.nextMonth.addEventListener("click", function () {
      state.calendarDate = new Date(
        state.calendarDate.getFullYear(),
        state.calendarDate.getMonth() + 1,
        1
      );
      renderCalendar();
    });

    elements.shareButton.addEventListener("click", copyShareLink);
    elements.copyInviteButton.addEventListener("click", copyShareLink);
    elements.notificationButton.addEventListener("click", requestNotifications);

    document.addEventListener("change", function (event) {
      if (!event.target.matches("[data-complete]")) {
        return;
      }
      var task = findTask(event.target.dataset.complete);
      if (!task) {
        return;
      }
      task.completed = event.target.checked;
      task.completedAt = task.completed ? new Date().toISOString() : "";
      saveState();
      render();
      showToast(task.completed ? "已移入已完成" : "已恢复到待办");
    });

    document.addEventListener("click", function (event) {
      var actionButton = event.target.closest("[data-action]");
      if (!actionButton) {
        return;
      }
      var task = findTask(actionButton.dataset.id);
      if (!task) {
        return;
      }
      if (actionButton.dataset.action === "delete") {
        state.tasks = state.tasks.filter(function (item) {
          return item.id !== task.id;
        });
        saveState();
        render();
        showToast("已删除");
      }
    });
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
      state.collaborators = Array.isArray(saved.collaborators) ? saved.collaborators : [];
    } catch (_error) {
      state.tasks = [];
      state.collaborators = [];
    }
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: state.tasks,
        collaborators: state.collaborators
      })
    );
  }

  function importSharedData() {
    var params = new URLSearchParams(window.location.search);
    var payload = params.get("workspace");
    if (!payload) {
      return;
    }
    try {
      var imported = JSON.parse(decodeBase64Url(payload));
      if (Array.isArray(imported.tasks)) {
        state.tasks = imported.tasks;
      }
      if (Array.isArray(imported.collaborators)) {
        state.collaborators = imported.collaborators;
      }
      saveState();
      window.history.replaceState({}, document.title, cleanUrl());
      showToast("已导入共享 workspace");
    } catch (_error) {
      showToast("分享链接无法读取");
    }
  }

  function setDefaultDates() {
    var today = toDateKey(new Date());
    elements.dueDate.value = today;
    elements.startDate.value = today;
  }

  function addTask(event) {
    event.preventDefault();
    var form = new FormData(elements.taskForm);
    var type = form.get("type");
    var dueDate = form.get("dueDate");
    var startDate = type === "range" ? form.get("startDate") || dueDate : dueDate;
    var title = String(form.get("title") || "").trim();

    if (!title) {
      showToast("请输入事件名称");
      return;
    }

    if (startDate && dueDate && parseDate(startDate) > parseDate(dueDate)) {
      showToast("开始日期不能晚于截止日期");
      return;
    }

    state.tasks.push({
      id: createId(),
      title: title,
      description: String(form.get("description") || "").trim(),
      type: type,
      startDate: startDate,
      dueDate: dueDate,
      startTime: String(form.get("startTime") || ""),
      endTime: String(form.get("endTime") || ""),
      owner: String(form.get("owner") || "Me").trim() || "Me",
      completed: false,
      completedAt: "",
      createdAt: new Date().toISOString(),
      lastReminderDate: ""
    });

    elements.taskForm.reset();
    setDefaultDates();
    saveState();
    state.folder = "todo";
    state.view = "list";
    render();
    showToast("已新增");
  }

  function sendInvite(event) {
    event.preventDefault();
    var form = new FormData(elements.inviteForm);
    var email = String(form.get("email") || "").trim();
    var name = String(form.get("name") || "").trim() || email || "Coworker";
    if (!email) {
      showToast("请输入 Email");
      return;
    }

    if (!state.collaborators.some(function (person) { return person.email === email; })) {
      state.collaborators.push({ email: email, name: name, invitedAt: new Date().toISOString() });
      saveState();
      render();
    }

    var subject = encodeURIComponent("To-do List workspace invite");
    var body = encodeURIComponent("Join this to-do workspace:\n\n" + buildShareUrl());
    window.location.href = "mailto:" + encodeURIComponent(email) + "?subject=" + subject + "&body=" + body;
  }

  function render() {
    renderCounts();
    renderNavigation();
    renderLayout();
    renderMiniReminders();
    renderCollaborators();

    if (state.folder === "reminders") {
      renderReminders();
      return;
    }

    if (state.folder === "collaboration") {
      return;
    }

    if (state.view === "calendar") {
      renderCalendar();
    } else {
      renderList();
    }
  }

  function renderCounts() {
    elements.todoCount.textContent = String(getTodoTasks().length);
    elements.completedCount.textContent = String(getCompletedTasks().length);
    elements.reminderCount.textContent = String(getReminderTasks().length);
    elements.collaboratorCount.textContent = String(state.collaborators.length);
  }

  function renderNavigation() {
    document.querySelectorAll("[data-folder]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.folder === state.folder);
    });
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.view === state.view);
    });
  }

  function renderLayout() {
    var titles = {
      todo: "待办",
      completed: "已完成",
      reminders: "提醒",
      collaboration: "协作"
    };
    elements.pageTitle.textContent = titles[state.folder] || "待办";

    var taskFolder = state.folder === "todo" || state.folder === "completed";
    elements.composerPanel.classList.toggle("is-hidden", state.folder !== "todo");
    elements.viewToolbar.classList.toggle("is-hidden", !taskFolder);
    elements.listPanel.classList.toggle("is-hidden", !taskFolder || state.view !== "list");
    elements.calendarPanel.classList.toggle("is-hidden", !taskFolder || state.view !== "calendar");
    elements.reminderPanel.classList.toggle("is-hidden", state.folder !== "reminders");
    elements.collaborationPanel.classList.toggle("is-hidden", state.folder !== "collaboration");

    var tasks = state.folder === "completed" ? getCompletedTasks() : getTodoTasks();
    elements.toolbarMeta.textContent = tasks.length + " items";
  }

  function renderList() {
    var tasks = state.folder === "completed" ? getCompletedTasks() : getTodoTasks();
    elements.taskList.innerHTML = tasks.length
      ? tasks.map(renderTaskRow).join("")
      : '<div class="empty">没有事件</div>';
  }

  function renderReminders() {
    var reminders = getReminderTasks();
    elements.reminderList.innerHTML = reminders.length
      ? reminders.map(renderTaskRow).join("")
      : '<div class="empty">没有截止日期提示</div>';
  }

  function renderTaskRow(task) {
    var due = dueLabel(task);
    var statusClass = "";
    var diff = daysUntil(task.dueDate);
    if (!task.completed && diff < 0) {
      statusClass = " is-overdue";
    } else if (!task.completed && diff <= 3) {
      statusClass = " is-soon";
    }

    return [
      '<article class="task-row' + statusClass + '">',
      '<input class="tick" type="checkbox" data-complete="' + task.id + '"' + (task.completed ? " checked" : "") + ' aria-label="Complete task">',
      '<div class="task-main">',
      '<div class="task-title-line">',
      '<span class="task-title">' + escapeHtml(task.title) + "</span>",
      '<span class="badge ' + task.type + '">' + (task.type === "range" ? "连续" : "单一") + "</span>",
      "</div>",
      '<div class="task-meta">',
      '<span>' + escapeHtml(due) + "</span>",
      task.startTime ? '<span>' + escapeHtml(timeLabel(task)) + "</span>" : "",
      '<span>' + escapeHtml(task.owner || "Me") + "</span>",
      "</div>",
      task.description ? '<p class="task-description">' + escapeHtml(task.description) + "</p>" : "",
      "</div>",
      '<div class="row-actions">',
      '<button class="text-button" type="button" data-action="delete" data-id="' + task.id + '">删除</button>',
      "</div>",
      "</article>"
    ].join("");
  }

  function renderCalendar() {
    var year = state.calendarDate.getFullYear();
    var month = state.calendarDate.getMonth();
    var first = new Date(year, month, 1);
    var firstGridDay = new Date(first);
    var mondayOffset = (first.getDay() + 6) % 7;
    firstGridDay.setDate(first.getDate() - mondayOffset);

    elements.calendarTitle.textContent = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long"
    }).format(first);

    var cells = [];
    for (var i = 0; i < 42; i += 1) {
      var date = new Date(firstGridDay);
      date.setDate(firstGridDay.getDate() + i);
      cells.push(renderDayCell(date, month));
    }
    elements.calendarGrid.innerHTML = cells.join("");
  }

  function renderDayCell(date, activeMonth) {
    var key = toDateKey(date);
    var dayTasks = getCalendarTasksForDate(key);
    var visibleTasks = dayTasks.slice(0, 4);
    var extra = dayTasks.length - visibleTasks.length;
    var classes = ["day-cell"];
    if (date.getMonth() !== activeMonth) {
      classes.push("is-muted");
    }
    if (key === toDateKey(new Date())) {
      classes.push("is-today");
    }

    return [
      '<div class="' + classes.join(" ") + '">',
      '<div class="day-number"><span>' + date.getDate() + "</span><span>" + dayTasks.length + "</span></div>",
      '<div class="day-events">',
      visibleTasks.map(renderCalendarChip).join(""),
      extra > 0 ? '<span class="calendar-chip">+' + extra + "</span>" : "",
      "</div>",
      "</div>"
    ].join("");
  }

  function renderCalendarChip(task) {
    return [
      '<span class="calendar-chip' + (task.completed ? " done" : "") + '">',
      task.startTime ? '<span class="time">' + escapeHtml(timeLabel(task)) + "</span>" : "",
      escapeHtml(task.title),
      "</span>"
    ].join("");
  }

  function renderMiniReminders() {
    var reminders = getReminderTasks().slice(0, 4);
    elements.dueSoonMini.innerHTML = reminders.length
      ? reminders.map(function (task) {
        return [
          '<div class="mini-item">',
          '<strong class="mini-title">' + escapeHtml(task.title) + "</strong>",
          '<span class="muted">' + escapeHtml(dueLabel(task)) + "</span>",
          "</div>"
        ].join("");
      }).join("")
      : '<div class="muted">没有提醒</div>';
  }

  function renderCollaborators() {
    elements.collaboratorList.innerHTML = state.collaborators.length
      ? state.collaborators.map(function (person) {
        return '<span class="collaborator-pill">' + escapeHtml(person.name) + '<span class="muted">' + escapeHtml(person.email) + "</span></span>";
      }).join("")
      : '<div class="empty">没有协作者</div>';
  }

  function getTodoTasks() {
    return state.tasks
      .filter(function (task) { return !task.completed; })
      .sort(compareByDueDate);
  }

  function getCompletedTasks() {
    return state.tasks
      .filter(function (task) { return task.completed; })
      .sort(function (a, b) {
        return String(b.completedAt || "").localeCompare(String(a.completedAt || ""));
      });
  }

  function getReminderTasks() {
    return getTodoTasks().filter(function (task) {
      return daysUntil(task.dueDate) <= 3;
    });
  }

  function getCalendarTasksForDate(dateKey) {
    var tasks = state.folder === "completed" ? getCompletedTasks() : getTodoTasks();
    return tasks.filter(function (task) {
      if (task.type === "range") {
        return dateKey >= task.startDate && dateKey <= task.dueDate;
      }
      return dateKey === task.dueDate;
    }).sort(function (a, b) {
      return String(a.startTime || "99:99").localeCompare(String(b.startTime || "99:99")) || compareByDueDate(a, b);
    });
  }

  function compareByDueDate(a, b) {
    return String(a.dueDate).localeCompare(String(b.dueDate)) ||
      String(a.startTime || "").localeCompare(String(b.startTime || "")) ||
      String(a.title).localeCompare(String(b.title));
  }

  function runDailyReminderCheck() {
    var today = toDateKey(new Date());
    var reminders = getReminderTasks().filter(function (task) {
      return task.lastReminderDate !== today;
    });
    if (!reminders.length) {
      return;
    }

    reminders.forEach(function (task) {
      task.lastReminderDate = today;
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("截止日期提示", {
          body: task.title + " · " + dueLabel(task)
        });
      }
    });
    saveState();
    showToast("有 " + reminders.length + " 个截止日期提醒");
  }

  function requestNotifications() {
    if (!("Notification" in window)) {
      showToast("当前浏览器不支持系统提醒");
      return;
    }
    if (Notification.permission === "granted") {
      showToast("提醒已开启");
      runDailyReminderCheck();
      return;
    }
    Notification.requestPermission().then(function (permission) {
      showToast(permission === "granted" ? "提醒已开启" : "提醒未开启");
      if (permission === "granted") {
        runDailyReminderCheck();
      }
    });
  }

  function copyShareLink() {
    var url = buildShareUrl();
    copyText(url).then(function () {
      showToast("分享链接已复制");
    }).catch(function () {
      showToast("复制失败");
    });
  }

  function buildShareUrl() {
    var payload = {
      tasks: state.tasks,
      collaborators: state.collaborators,
      exportedAt: new Date().toISOString()
    };
    return cleanUrl() + "?workspace=" + encodeBase64Url(JSON.stringify(payload));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "readonly");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(input);
      }
    });
  }

  function findTask(id) {
    return state.tasks.find(function (task) {
      return task.id === id;
    });
  }

  function dueLabel(task) {
    var dueText = task.type === "range"
      ? formatDate(task.startDate) + " - " + formatDate(task.dueDate)
      : formatDate(task.dueDate);
    var diff = daysUntil(task.dueDate);
    if (task.completed) {
      return dueText;
    }
    if (diff < 0) {
      return dueText + " · 已逾期 " + Math.abs(diff) + " 天";
    }
    if (diff === 0) {
      return dueText + " · 今天截止";
    }
    if (diff <= 3) {
      return dueText + " · " + diff + " 天后截止";
    }
    return dueText;
  }

  function timeLabel(task) {
    return task.startTime + (task.endTime ? " - " + task.endTime : "");
  }

  function daysUntil(dateKey) {
    return Math.floor((parseDate(dateKey) - startOfToday()) / DAY_MS);
  }

  function startOfToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function parseDate(key) {
    var parts = String(key).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function toDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function formatDate(key) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric"
    }).format(parseDate(key));
  }

  function createId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "task-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function cleanUrl() {
    return window.location.href.split("?")[0].split("#")[0];
  }

  function encodeBase64Url(text) {
    return btoa(unescape(encodeURIComponent(text)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeBase64Url(text) {
    var normalized = text.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) {
      normalized += "=";
    }
    return decodeURIComponent(escape(atob(normalized)));
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 2600);
  }
}());
