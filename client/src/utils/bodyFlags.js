let selectNoneCount = 0;
let cursorColResizeCount = 0;

export function addBodySelectNone() {
  if (selectNoneCount === 0) {
    document.body.classList.add("select-none");
  }
  selectNoneCount++;
}

export function removeBodySelectNone() {
  if (selectNoneCount <= 0) return;
  selectNoneCount--;
  if (selectNoneCount === 0) {
    document.body.classList.remove("select-none");
  }
}

export function addBodyCursorColResize() {
  if (cursorColResizeCount === 0) {
    document.body.classList.add("cursor-col-resize");
  }
  cursorColResizeCount++;
}

export function removeBodyCursorColResize() {
  if (cursorColResizeCount <= 0) return;
  cursorColResizeCount--;
  if (cursorColResizeCount === 0) {
    document.body.classList.remove("cursor-col-resize");
  }
}

export function addBodyResizeFlags() {
  addBodySelectNone();
  addBodyCursorColResize();
}

export function removeBodyResizeFlags() {
  removeBodySelectNone();
  removeBodyCursorColResize();
}

export function resetBodyFlags() {
  if (selectNoneCount > 0) {
    document.body.classList.remove("select-none");
    selectNoneCount = 0;
  }
  if (cursorColResizeCount > 0) {
    document.body.classList.remove("cursor-col-resize");
    cursorColResizeCount = 0;
  }
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}
