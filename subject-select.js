(function () {
  const select = document.getElementById("subject");
  const dropdown = document.querySelector("[data-subject-dropdown]");
  if (!select || !dropdown) return;
  const control = dropdown.querySelector("[data-subject-control]");
  const button = document.getElementById("subject-button");
  const list = document.getElementById("subject-listbox");
  const value = document.getElementById("subject-value");
  const label = document.getElementById("subject-label");
  // @license lucide-static v0.469.0 - ISC
  const icons = {
    "English": [
        "english",
        "<path d=\"M12 7v14\" /> <path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\" />"
    ],
    "Maths": [
        "maths",
        "<rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\" /> <line x1=\"8\" x2=\"16\" y1=\"6\" y2=\"6\" /> <line x1=\"16\" x2=\"16\" y1=\"14\" y2=\"18\" /> <path d=\"M16 10h.01\" /> <path d=\"M12 10h.01\" /> <path d=\"M8 10h.01\" /> <path d=\"M12 14h.01\" /> <path d=\"M8 14h.01\" /> <path d=\"M12 18h.01\" /> <path d=\"M8 18h.01\" />"
    ],
    "Science": [
        "science",
        "<path d=\"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2\" /> <path d=\"M6.453 15h11.094\" /> <path d=\"M8.5 2h7\" />"
    ],
    "Languages": [
        "languages",
        "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /> <path d=\"M2 12h20\" />"
    ],
    "Psychology": [
        "psychology",
        "<path d=\"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z\" /> <path d=\"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z\" /> <path d=\"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4\" /> <path d=\"M17.599 6.5a3 3 0 0 0 .399-1.375\" /> <path d=\"M6.003 5.125A3 3 0 0 0 6.401 6.5\" /> <path d=\"M3.477 10.896a4 4 0 0 1 .585-.396\" /> <path d=\"M19.938 10.5a4 4 0 0 1 .585.396\" /> <path d=\"M6 18a4 4 0 0 1-1.967-.516\" /> <path d=\"M19.967 17.484A4 4 0 0 1 18 18\" />"
    ],
    "Art & design": [
        "art",
        "<circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" /> <path d=\"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z\" />"
    ],
    "Exam preparation": [
        "exam",
        "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /> <path d=\"m9 14 2 2 4-4\" />"
    ],
    "SEN support": [
        "sen",
        "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\" /> <path d=\"M20 3v4\" /> <path d=\"M22 5h-4\" /> <path d=\"M4 17v2\" /> <path d=\"M5 18H3\" />"
    ],
    "Other": [
        "other",
        "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />"
    ]
};
  const options = Array.from(select.options);
  const rows = options.map((option, index) => {
    const row = document.createElement("li");
    row.id = "subject-option-" + index;
    row.setAttribute("role", "option");
    const text = document.createElement("span");
    text.textContent = option.textContent;
    row.append(text);
    const icon = icons[option.value];
    if (icon) {
      row.className = "subject-option--" + icon[0];
      row.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + icon[1] + '</svg>');
    }
    row.addEventListener("click", () => choose(index));
    list.append(row);
    return row;
  });
  let active = 0;
  function sync() {
    value.textContent = options[select.selectedIndex]?.textContent || options[0].textContent;
    rows.forEach((row, index) => row.setAttribute("aria-selected", String(index === select.selectedIndex)));
  }
  function highlight(index) {
    active = Math.max(0, Math.min(rows.length - 1, index));
    rows.forEach((row, index) => row.classList.toggle("is-active", index === active));
    list.setAttribute("aria-activedescendant", rows[active].id);
    rows[active].scrollIntoView({ block: "nearest" });
  }
  function open(index = Math.max(0, select.selectedIndex)) {
    sync();
    list.hidden = false;
    dropdown.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    list.focus({ preventScroll: true });
    highlight(index);
  }
  function close(restoreFocus = true) {
    list.hidden = true;
    dropdown.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus({ preventScroll: true });
  }
  function choose(index) {
    select.value = options[index].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }
  button.addEventListener("click", () => list.hidden ? open() : close());
  button.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    open(event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, select.selectedIndex));
  });
  list.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown": highlight(active + 1); break;
      case "ArrowUp": highlight(active - 1); break;
      case "Home": highlight(0); break;
      case "End": highlight(rows.length - 1); break;
      case "Enter": case " ": choose(active); break;
      case "Escape": close(); break;
      // Restore the tab stop before the browser advances to the next field.
      case "Tab": close(); return;
      default: return;
    }
    event.preventDefault();
  });
  document.addEventListener("click", (event) => {
    if (!list.hidden && !dropdown.contains(event.target)) close();
  });
  select.addEventListener("change", sync);
  window.addEventListener("pageshow", sync);
  select.form.addEventListener("reset", () => {
    close(false);
    window.setTimeout(sync, 0);
  });
  sync();
  control.hidden = false;
  select.hidden = true;
  label.setAttribute("for", button.id);
})();
